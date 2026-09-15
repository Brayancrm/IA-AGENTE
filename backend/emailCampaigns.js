/**
 * Campanhas de email em massa (só master) via AWS SES.
 * Listas importadas (CSV/XLSX) em chunks — preparado para ~50k–100k emails.
 * Tracking: SNS + open/click + unsubscribe.
 */
const crypto = require('crypto');
const multer = require('multer');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const admin = require('firebase-admin');
const { SendEmailCommand } = require('@aws-sdk/client-ses');

const TRACK_SECRET =
  process.env.EMAIL_TRACKING_SECRET ||
  process.env.AWS_SECRET_ACCESS_KEY ||
  'ia-agente-email-track';

const SEND_INTERVAL_MS = Math.max(
  80,
  parseInt(process.env.EMAIL_CAMPAIGN_INTERVAL_MS || '120', 10) || 120
);

const LIST_CHUNK_SIZE = Math.max(
  100,
  parseInt(process.env.EMAIL_LIST_CHUNK_SIZE || '400', 10) || 400
);

const MAX_LIST_ROWS = Math.max(
  1000,
  parseInt(process.env.EMAIL_LIST_MAX_ROWS || '100000', 10) || 100000
);

/** @type {Map<string, { timer: NodeJS.Timeout|null, busy: boolean }>} */
const campaignWorkers = new Map();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 }
});

function mimeFromPath(path) {
  const p = String(path || '').toLowerCase();
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
  if (p.endsWith('.gif')) return 'image/gif';
  if (p.endsWith('.webp')) return 'image/webp';
  if (p.endsWith('.svg')) return 'image/svg+xml';
  if (p.endsWith('.bmp')) return 'image/bmp';
  return 'application/octet-stream';
}

function normalizeZipPath(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

/**
 * BeeFree ZIP → HTML com imagens em URLs públicas (Firebase Storage).
 * Gmail não gosta de data:base64 (corta o email e quebra imagens).
 */
async function htmlPackFromZipBuffer(buffer, userId) {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.keys(zip.files || {}).filter((k) => !zip.files[k].dir);

  const htmlEntry =
    entries.find((k) => /(^|\/)index\.html?$/i.test(k)) ||
    entries.find((k) => /\.html?$/i.test(k) && !/__MACOSX/i.test(k));

  if (!htmlEntry) {
    throw Object.assign(new Error('ZIP sem ficheiro HTML (index.html)'), { status: 400 });
  }

  let html = await zip.files[htmlEntry].async('string');
  const htmlDir = htmlEntry.includes('/')
    ? htmlEntry.slice(0, htmlEntry.lastIndexOf('/') + 1)
    : '';

  const imageEntries = entries.filter(
    (k) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(k) && !/__MACOSX/i.test(k)
  );

  const bucket = admin.storage().bucket();
  const packId = crypto.randomBytes(8).toString('hex');
  const urlByRel = new Map();

  for (const imgPath of imageEntries) {
    const bytes = await zip.files[imgPath].async('nodebuffer');
    const mime = mimeFromPath(imgPath);
    const fileName = normalizeZipPath(imgPath).split('/').pop();
    const dest = `email-assets/${userId}/${packId}/${fileName}`;
    const token = crypto.randomUUID();
    const file = bucket.file(dest);
    await file.save(bytes, {
      resumable: false,
      metadata: {
        contentType: mime,
        cacheControl: 'public, max-age=31536000',
        metadata: {
          firebaseStorageDownloadTokens: token
        }
      }
    });
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      dest
    )}?alt=media&token=${token}`;

    const norm = normalizeZipPath(imgPath);
    const relFromHtml = normalizeZipPath(
      htmlDir && norm.startsWith(htmlDir) ? norm.slice(htmlDir.length) : norm
    );
    [norm, relFromHtml, `./${relFromHtml}`, fileName, `images/${fileName}`]
      .filter(Boolean)
      .forEach((key) => urlByRel.set(String(key).toLowerCase(), publicUrl));
  }

  const replaceRef = (ref) => {
    const raw = String(ref || '').trim();
    if (!raw || /^https?:\/\//i.test(raw) || /^cid:/i.test(raw) || /^data:/i.test(raw)) {
      return raw;
    }
    const cleaned = normalizeZipPath(raw.split('?')[0].split('#')[0]);
    return (
      urlByRel.get(cleaned.toLowerCase()) ||
      urlByRel.get(cleaned.split('/').pop().toLowerCase()) ||
      raw
    );
  };

  html = html.replace(/(src|href)\s*=\s*(["'])([^"']+)\2/gi, (full, attr, quote, ref) => {
    if (attr.toLowerCase() === 'href' && !/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(ref)) {
      return full;
    }
    return `${attr}=${quote}${replaceRef(ref)}${quote}`;
  });

  html = html.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, q, ref) => {
    return `url(${q || ''}${replaceRef(ref)}${q || ''})`;
  });

  html = html.replace(
    /background\s*=\s*(["'])([^"']+)\1/gi,
    (full, quote, ref) => `background=${quote}${replaceRef(ref)}${quote}`
  );

  // Remove data-URIs acidentais enormes se existirem (não devem)
  // Mantém HTML fluido
  if (!/name=["']viewport["']/i.test(html)) {
    const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>';
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${viewport}`);
    }
  }

  return {
    html,
    imageCount: imageEntries.length,
    htmlFile: htmlEntry,
    packId
  };
}

function publicBaseUrl() {
  return String(
    process.env.PUBLIC_SERVER_URL || process.env.BACKEND_URL || ''
  ).replace(/\/$/, '');
}

function hashEmail(email) {
  return crypto
    .createHash('sha256')
    .update(String(email || '').trim().toLowerCase())
    .digest('hex')
    .slice(0, 32);
}

function signPayload(obj) {
  const body = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sig = crypto.createHmac('sha256', TRACK_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const expect = crypto.createHmac('sha256', TRACK_SECRET).update(body).digest('base64url');
    if (sig !== expect) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function replaceVars(text, vars) {
  let out = String(text || '');
  Object.entries(vars || {}).forEach(([k, v]) => {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v ?? ''));
  });
  return out;
}

/**
 * Melhora HTML exportado (BeeFree etc.) para clientes móveis:
 * viewport + imagens/tabelas fluidas. Não reescreve o design.
 */
function normalizeEmailHtml(html) {
  let out = String(html || '');
  if (!out.trim()) return out;

  const fluidCss = `
<style type="text/css">
  /* dadosIA mobile helpers */
  img { max-width: 100% !important; height: auto !important; }
  table { max-width: 100% !important; }
  .rge-mobile-hide { display: none !important; }
  @media only screen and (max-width: 620px) {
    .container, .wrapper, .email-container { width: 100% !important; max-width: 100% !important; }
    td, th { box-sizing: border-box !important; }
  }
</style>`;

  if (!/name=["']viewport["']/i.test(out)) {
    const viewport =
      '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>';
    if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${viewport}`);
    } else if (/<html[^>]*>/i.test(out)) {
      out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${viewport}</head>`);
    } else {
      out = `<head>${viewport}</head>${out}`;
    }
  }

  if (!out.includes('dadosIA mobile helpers')) {
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `${fluidCss}\n</head>`);
    } else if (/<body[^>]*>/i.test(out)) {
      out = out.replace(/<body[^>]*>/i, (m) => `${fluidCss}\n${m}`);
    } else {
      out = `${fluidCss}${out}`;
    }
  }

  return out;
}

function injectTracking(html, { openUrl, unsubUrl, clickBase, campaignId, recipientId }) {
  let out = normalizeEmailHtml(html);
  out = out.replace(/href\s*=\s*["'](https?:\/\/[^"']+)["']/gi, (full, url) => {
    const lower = String(url).toLowerCase();
    if (
      lower.includes('/api/email/t/') ||
      lower.includes('unsubscribe') ||
      lower.startsWith('mailto:') ||
      lower.startsWith('tel:')
    ) {
      return full;
    }
    const token = signPayload({ t: 'c', c: campaignId, r: recipientId, u: url });
    return `href="${clickBase}/api/email/t/c/${token}"`;
  });

  const pixel = `<img src="${openUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;
  const unsub = `
<p style="margin-top:24px;font-size:12px;color:#6b7280;text-align:center;line-height:1.4;">
  Se não quiser receber estes emails,
  <a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline;">cancele a inscrição</a>.
</p>`;

  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${pixel}${unsub}</body>`);
  } else {
    out = `${out}${pixel}${unsub}`;
  }
  return out;
}

async function assertMaster(db, userId) {
  const snap = await db.ref('users/registered').once('value');
  if (!snap.exists()) return false;
  const entry = Object.values(snap.val()).find((u) => u && u.uid === userId);
  if (!entry) return false;
  return (
    entry.isMaster === true ||
    String(entry.email || '').toLowerCase() === 'brayan.italy@gmail.com'
  );
}

async function isUnsubscribed(db, email) {
  const key = hashEmail(email);
  const snap = await db.ref(`email_unsubscribes/${key}`).once('value');
  return snap.exists();
}

function looksLikeEmail(v) {
  const e = String(v || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Extrai {email,name}[] de buffer CSV/XLSX */
function parseEmailFileBuffer(buffer, originalName = '') {
  const wb = XLSX.read(buffer, { type: 'buffer', raw: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], skipped: 0 };
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  if (!Array.isArray(json) || !json.length) {
    // fallback: sem header — primeira coluna = email
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    const rows = [];
    const seen = new Set();
    let skipped = 0;
    for (const line of aoa || []) {
      if (!Array.isArray(line) || !line.length) continue;
      const email = String(line[0] || '').trim().toLowerCase();
      if (!looksLikeEmail(email)) {
        skipped += 1;
        continue;
      }
      if (seen.has(email)) {
        skipped += 1;
        continue;
      }
      seen.add(email);
      rows.push({
        email,
        name: String(line[1] || '').trim() || email.split('@')[0]
      });
      if (rows.length >= MAX_LIST_ROWS) break;
    }
    return { rows, skipped, fileName: originalName };
  }

  const headers = Object.keys(json[0] || {}).map(normalizeHeader);
  let emailKey = Object.keys(json[0] || {}).find((k) => {
    const h = normalizeHeader(k);
    return h === 'email' || h === 'e-mail' || h === 'mail' || h === 'correo' || h.includes('email');
  });
  let nameKey = Object.keys(json[0] || {}).find((k) => {
    const h = normalizeHeader(k);
    return h === 'name' || h === 'nome' || h === 'nombre' || h === 'full name' || h === 'cliente';
  });

  if (!emailKey) {
    // primeira coluna que parecer email nos dados
    for (const k of Object.keys(json[0] || {})) {
      const sample = json.slice(0, 20).some((r) => looksLikeEmail(r[k]));
      if (sample) {
        emailKey = k;
        break;
      }
    }
  }

  if (!emailKey) {
    const err = new Error(
      'Coluna de email não encontrada. Use cabeçalho "email" (e opcional "name"/"nome").'
    );
    err.status = 400;
    throw err;
  }

  const rows = [];
  const seen = new Set();
  let skipped = 0;
  for (const row of json) {
    const email = String(row[emailKey] || '').trim().toLowerCase();
    if (!looksLikeEmail(email)) {
      skipped += 1;
      continue;
    }
    if (seen.has(email)) {
      skipped += 1;
      continue;
    }
    seen.add(email);
    const name = nameKey ? String(row[nameKey] || '').trim() : '';
    rows.push({ email, name: name || email.split('@')[0] });
    if (rows.length >= MAX_LIST_ROWS) break;
  }

  return { rows, skipped, headers, fileName: originalName };
}

async function writeListChunks(db, listId, rows) {
  const chunkCount = Math.ceil(rows.length / LIST_CHUNK_SIZE) || 0;
  for (let i = 0; i < chunkCount; i++) {
    const slice = rows.slice(i * LIST_CHUNK_SIZE, (i + 1) * LIST_CHUNK_SIZE);
    const key = String(i).padStart(5, '0');
    await db.ref(`email_list_chunks/${listId}/${key}`).set({
      items: slice.map((r) => ({ e: r.email, n: r.name || '' })),
      n: slice.length,
      i
    });
  }
  return chunkCount;
}

async function createListFromRows(db, { masterUid, name, rows, fileName, skipped }) {
  const listRef = db.ref('email_lists').push();
  const listId = listRef.key;
  const now = new Date().toISOString();
  await listRef.set({
    masterUid,
    name: name || fileName || 'Lista importada',
    count: rows.length,
    skipped: skipped || 0,
    chunkSize: LIST_CHUNK_SIZE,
    chunkCount: 0,
    status: 'writing',
    fileName: fileName || null,
    createdAt: now,
    updatedAt: now
  });

  const chunkCount = await writeListChunks(db, listId, rows);
  await listRef.update({
    status: 'ready',
    chunkCount,
    updatedAt: new Date().toISOString()
  });

  return {
    listId,
    count: rows.length,
    skipped: skipped || 0,
    chunkCount
  };
}

async function getNextFromList(db, listId, cursor) {
  const metaSnap = await db.ref(`email_lists/${listId}`).once('value');
  if (!metaSnap.exists()) return { done: true };
  const meta = metaSnap.val();
  const chunkCount = Number(meta.chunkCount) || 0;
  let chunk = Number(cursor?.chunk) || 0;
  let index = Number(cursor?.index) || 0;

  while (chunk < chunkCount) {
    const key = String(chunk).padStart(5, '0');
    const snap = await db.ref(`email_list_chunks/${listId}/${key}`).once('value');
    const data = snap.val();
    const items = (data && data.items) || [];
    if (index < items.length) {
      const item = items[index];
      return {
        done: false,
        contact: {
          email: item.e,
          name: item.n || String(item.e || '').split('@')[0]
        },
        nextCursor: { chunk, index: index + 1 }
      };
    }
    chunk += 1;
    index = 0;
  }
  return { done: true };
}

async function collectAudience(db, masterUid, audience) {
  const list = [];
  const seen = new Set();

  const pushOne = (email, name, meta = {}) => {
    const e = String(email || '').trim().toLowerCase();
    if (!e || !e.includes('@') || seen.has(e)) return;
    seen.add(e);
    list.push({
      email: e,
      name: name || e.split('@')[0],
      ...meta
    });
  };

  if (audience === 'crm' || audience === 'all') {
    const snap = await db.ref(`customerData/${masterUid}`).once('value');
    if (snap.exists()) {
      const data = snap.val();
      Object.entries(data).forEach(([key, c]) => {
        if (!c || c.mirroredFromChatKey) return;
        pushOne(c.email, c.name, { phoneKey: key, source: 'crm' });
      });
    }
  }

  if (audience === 'users' || audience === 'all') {
    const snap = await db.ref('users/registered').once('value');
    if (snap.exists()) {
      Object.values(snap.val()).forEach((u) => {
        if (!u) return;
        pushOne(u.email, u.name || u.displayName, { uid: u.uid, source: 'users' });
      });
    }
  }

  if (Array.isArray(audience)) {
    audience.forEach((row) => {
      if (typeof row === 'string') pushOne(row, null, { source: 'custom' });
      else if (row && row.email) pushOne(row.email, row.name, { source: 'custom', uid: row.uid });
    });
  }

  return list;
}

async function bumpStat(db, campaignId, field, delta = 1) {
  const ref = db.ref(`email_campaigns/${campaignId}/stats/${field}`);
  await ref.transaction((cur) => Math.max(0, (Number(cur) || 0) + delta));
}

function stopWorker(campaignId) {
  const w = campaignWorkers.get(campaignId);
  if (w?.timer) clearInterval(w.timer);
  campaignWorkers.delete(campaignId);
}

function startWorker(db, sesClient, campaignId) {
  if (campaignWorkers.has(campaignId)) return;
  const state = { timer: null, busy: false };
  campaignWorkers.set(campaignId, state);

  state.timer = setInterval(async () => {
    if (state.busy) return;
    state.busy = true;
    try {
      const campSnap = await db.ref(`email_campaigns/${campaignId}`).once('value');
      const camp = campSnap.val();
      if (!camp || camp.status === 'cancelled' || camp.status === 'completed') {
        stopWorker(campaignId);
        return;
      }
      if (camp.status !== 'sending' && camp.status !== 'queued') {
        stopWorker(campaignId);
        return;
      }
      if (camp.status === 'queued') {
        await db.ref(`email_campaigns/${campaignId}`).update({
          status: 'sending',
          startedAt: new Date().toISOString()
        });
      }

      // Campanha baseada em lista importada (cursor) — não pré-carrega 50k nós
      if (camp.listId) {
        const next = await getNextFromList(db, camp.listId, camp.listCursor || { chunk: 0, index: 0 });
        if (next.done) {
          await db.ref(`email_campaigns/${campaignId}`).update({
            status: 'completed',
            completedAt: new Date().toISOString()
          });
          stopWorker(campaignId);
          return;
        }

        await db.ref(`email_campaigns/${campaignId}`).update({
          listCursor: next.nextCursor
        });

        const contact = next.contact;
        const recRef = db.ref(`email_campaign_recipients/${campaignId}`).push();
        const recipientId = recRef.key;
        const recipient = {
          email: contact.email,
          name: contact.name || '',
          source: 'list',
          listId: camp.listId,
          status: 'queued',
          createdAt: new Date().toISOString()
        };
        await recRef.set(recipient);
        await bumpStat(db, campaignId, 'queued', 1);
        await sendOne(db, sesClient, campaignId, camp, recipientId, recipient);
        return;
      }

      // Campanha clássica (CRM/users) com recipients pré-criados
      const recSnap = await db.ref(`email_campaign_recipients/${campaignId}`).once('value');
      if (!recSnap.exists()) {
        await db.ref(`email_campaigns/${campaignId}`).update({
          status: 'completed',
          completedAt: new Date().toISOString()
        });
        stopWorker(campaignId);
        return;
      }

      let recipientId = null;
      let recipient = null;
      recSnap.forEach((c) => {
        const v = c.val();
        if (!recipientId && v && v.status === 'queued') {
          recipientId = c.key;
          recipient = v;
        }
      });
      if (!recipientId || !recipient) {
        await db.ref(`email_campaigns/${campaignId}`).update({
          status: 'completed',
          completedAt: new Date().toISOString()
        });
        stopWorker(campaignId);
        return;
      }

      await sendOne(db, sesClient, campaignId, camp, recipientId, recipient);
    } catch (e) {
      console.error(`❌ [email-campaign] worker ${campaignId}:`, e.message);
    } finally {
      state.busy = false;
    }
  }, SEND_INTERVAL_MS);

  console.log(`📬 [email-campaign] worker ativo: ${campaignId} (a cada ${SEND_INTERVAL_MS}ms)`);
}

async function sendOne(db, sesClient, campaignId, camp, recipientId, recipient) {
  const email = recipient.email;
  const recRef = db.ref(`email_campaign_recipients/${campaignId}/${recipientId}`);

  if (await isUnsubscribed(db, email)) {
    await recRef.update({
      status: 'unsubscribed',
      skippedAt: new Date().toISOString()
    });
    await bumpStat(db, campaignId, 'unsubscribed');
    await bumpStat(db, campaignId, 'queued', -1);
    return;
  }

  if (!sesClient) {
    await recRef.update({
      status: 'failed',
      error: 'SES não configurado',
      failedAt: new Date().toISOString()
    });
    await bumpStat(db, campaignId, 'failed');
    await bumpStat(db, campaignId, 'queued', -1);
    return;
  }

  const base = publicBaseUrl();
  if (!base) {
    await recRef.update({
      status: 'failed',
      error: 'PUBLIC_SERVER_URL / BACKEND_URL não configurado',
      failedAt: new Date().toISOString()
    });
    await bumpStat(db, campaignId, 'failed');
    await bumpStat(db, campaignId, 'queued', -1);
    return;
  }

  const openToken = signPayload({ t: 'o', c: campaignId, r: recipientId });
  const unsubToken = signPayload({ t: 'u', c: campaignId, r: recipientId, e: email });
  const openUrl = `${base}/api/email/t/o/${openToken}.gif`;
  const unsubUrl = `${base}/api/email/t/u/${unsubToken}`;

  let companyName = 'dadosIA';
  try {
    const companySnap = await db.ref(`users/data/${camp.masterUid}/company_profile`).once('value');
    if (companySnap.exists() && companySnap.val().companyName) {
      companyName = companySnap.val().companyName;
    }
  } catch (_) {
    /* ignore */
  }

  const vars = {
    clientName: recipient.name || email.split('@')[0],
    clientEmail: email,
    companyName,
    unsubscribeUrl: unsubUrl
  };

  let subject = replaceVars(camp.subject, vars);
  let html = replaceVars(camp.html, vars);
  html = injectTracking(html, {
    openUrl,
    unsubUrl,
    clickBase: base,
    campaignId,
    recipientId
  });

  const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@dadosia.com.br';
  const fromName = process.env.AWS_SES_FROM_NAME || companyName;
  const source = fromName ? `"${fromName.replace(/"/g, '')}" <${fromEmail}>` : fromEmail;

  try {
    const commandPayload = {
      Source: source,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: html, Charset: 'UTF-8' } }
      }
    };
    if (process.env.AWS_SES_CONFIGURATION_SET) {
      commandPayload.ConfigurationSetName = process.env.AWS_SES_CONFIGURATION_SET;
    }
    const command = new SendEmailCommand(commandPayload);

    const result = await sesClient.send(command);
    const messageId = result?.MessageId || null;

    await recRef.update({
      status: 'sent',
      messageId,
      sentAt: new Date().toISOString()
    });
    await bumpStat(db, campaignId, 'sent');
    await bumpStat(db, campaignId, 'queued', -1);

    if (messageId) {
      await db.ref(`email_ses_messages/${encodeSesKey(messageId)}`).set({
        campaignId,
        recipientId,
        email,
        at: new Date().toISOString()
      });
    }

    console.log(`✅ [email-campaign] enviado → ${email} (${campaignId})`);
  } catch (e) {
    await recRef.update({
      status: 'failed',
      error: e.message,
      failedAt: new Date().toISOString()
    });
    await bumpStat(db, campaignId, 'failed');
    await bumpStat(db, campaignId, 'queued', -1);
    console.error(`❌ [email-campaign] falha → ${email}:`, e.message);
  }
}

function encodeSesKey(messageId) {
  return String(messageId || '')
    .replace(/[.#$\[\]]/g, '_')
    .slice(0, 200);
}

async function writeRecipientsInBatches(db, campaignId, filtered, now) {
  const BATCH = 400;
  for (let i = 0; i < filtered.length; i += BATCH) {
    const slice = filtered.slice(i, i + BATCH);
    const updates = {};
    slice.forEach((r) => {
      const id = db.ref(`email_campaign_recipients/${campaignId}`).push().key;
      updates[`email_campaign_recipients/${campaignId}/${id}`] = {
        email: r.email,
        name: r.name || '',
        phoneKey: r.phoneKey || null,
        uid: r.uid || null,
        source: r.source || 'crm',
        status: 'queued',
        createdAt: now
      };
    });
    await db.ref().update(updates);
  }
}

async function createAndQueueCampaign(
  db,
  sesClient,
  { masterUid, name, subject, html, audience, listId }
) {
  if (!(await assertMaster(db, masterUid))) {
    const err = new Error('Apenas o utilizador master pode criar campanhas.');
    err.status = 403;
    throw err;
  }
  if (!subject || !html) {
    const err = new Error('Assunto e HTML são obrigatórios.');
    err.status = 400;
    throw err;
  }

  const campRef = db.ref('email_campaigns').push();
  const campaignId = campRef.key;
  const now = new Date().toISOString();

  // Lista importada
  if (listId || (typeof audience === 'string' && audience.startsWith('list:'))) {
    const lid = listId || String(audience).slice(5);
    const listSnap = await db.ref(`email_lists/${lid}`).once('value');
    if (!listSnap.exists() || listSnap.val().masterUid !== masterUid) {
      const err = new Error('Lista não encontrada.');
      err.status = 404;
      throw err;
    }
    const list = listSnap.val();
    if (list.status !== 'ready' || !list.count) {
      const err = new Error('Lista ainda não está pronta ou está vazia.');
      err.status = 400;
      throw err;
    }

    await campRef.set({
      masterUid,
      name: name || subject.slice(0, 80),
      subject,
      html,
      audience: `list:${lid}`,
      listId: lid,
      listCursor: { chunk: 0, index: 0 },
      status: 'queued',
      createdAt: now,
      stats: {
        total: list.count,
        queued: 0,
        sent: 0,
        delivered: 0,
        bounced: 0,
        complained: 0,
        opened: 0,
        clicked: 0,
        failed: 0,
        unsubscribed: 0
      }
    });

    startWorker(db, sesClient, campaignId);
    return { campaignId, total: list.count, status: 'queued', listId: lid };
  }

  const recipients = await collectAudience(db, masterUid, audience || 'crm');
  const filtered = [];
  for (const r of recipients) {
    if (!(await isUnsubscribed(db, r.email))) filtered.push(r);
  }

  if (!filtered.length) {
    const err = new Error('Nenhum destinatário com email válido (ou todos cancelaram inscrição).');
    err.status = 400;
    throw err;
  }

  await campRef.set({
    masterUid,
    name: name || subject.slice(0, 80),
    subject,
    html,
    audience: typeof audience === 'string' ? audience : 'custom',
    status: 'queued',
    createdAt: now,
    stats: {
      total: filtered.length,
      queued: filtered.length,
      sent: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
      unsubscribed: 0
    }
  });

  await writeRecipientsInBatches(db, campaignId, filtered, now);
  startWorker(db, sesClient, campaignId);

  return {
    campaignId,
    total: filtered.length,
    status: 'queued'
  };
}

async function handleOpen(db, token) {
  const payload = verifyToken(token.replace(/\.gif$/i, ''));
  if (!payload || payload.t !== 'o') return false;
  const { c: campaignId, r: recipientId } = payload;
  const recRef = db.ref(`email_campaign_recipients/${campaignId}/${recipientId}`);
  const snap = await recRef.once('value');
  if (!snap.exists()) return false;
  const rec = snap.val();
  if (rec.openedAt) return true;
  await recRef.update({
    openedAt: new Date().toISOString(),
    status: rec.status === 'sent' || rec.status === 'delivered' ? 'opened' : rec.status
  });
  await bumpStat(db, campaignId, 'opened');
  return true;
}

async function handleClick(db, token) {
  const payload = verifyToken(token);
  if (!payload || payload.t !== 'c' || !payload.u) return null;
  const { c: campaignId, r: recipientId, u: url } = payload;
  const recRef = db.ref(`email_campaign_recipients/${campaignId}/${recipientId}`);
  const snap = await recRef.once('value');
  if (snap.exists()) {
    const rec = snap.val();
    const patch = { lastClickedAt: new Date().toISOString() };
    if (!rec.clickedAt) {
      patch.clickedAt = patch.lastClickedAt;
      await bumpStat(db, campaignId, 'clicked');
    }
    await recRef.update(patch);
  }
  return url;
}

async function handleUnsubscribe(db, token) {
  const payload = verifyToken(token);
  if (!payload || payload.t !== 'u') return { ok: false };
  const email = payload.e || null;
  const campaignId = payload.c;
  const recipientId = payload.r;
  if (!email) return { ok: false };

  const key = hashEmail(email);
  await db.ref(`email_unsubscribes/${key}`).set({
    email,
    at: new Date().toISOString(),
    campaignId: campaignId || null
  });

  if (campaignId && recipientId) {
    await db.ref(`email_campaign_recipients/${campaignId}/${recipientId}`).update({
      status: 'unsubscribed',
      unsubscribedAt: new Date().toISOString()
    });
    await bumpStat(db, campaignId, 'unsubscribed');
  }

  return { ok: true, email };
}

async function handleSesSns(db, body) {
  let msg = body;
  if (typeof body === 'string') {
    try {
      msg = JSON.parse(body);
    } catch {
      return { ok: false, error: 'invalid json' };
    }
  }

  if (msg.Type === 'SubscriptionConfirmation' && msg.SubscribeURL) {
    try {
      const axios = require('axios');
      await axios.get(msg.SubscribeURL);
      console.log('✅ [email-campaign] SNS subscription confirmada');
      return { ok: true, confirmed: true };
    } catch (e) {
      console.warn('⚠️ [email-campaign] SNS confirm falhou:', e.message);
      return { ok: false, error: e.message };
    }
  }

  if (msg.Type !== 'Notification') {
    return { ok: true, ignored: true };
  }

  let notification;
  try {
    notification = typeof msg.Message === 'string' ? JSON.parse(msg.Message) : msg.Message;
  } catch {
    return { ok: false, error: 'invalid SES message' };
  }

  const type = notification.notificationType || notification.eventType;
  const mail = notification.mail || {};
  const messageId = mail.messageId;
  if (!messageId) return { ok: true, ignored: true };

  const mapSnap = await db.ref(`email_ses_messages/${encodeSesKey(messageId)}`).once('value');
  if (!mapSnap.exists()) {
    return { ok: true, unmatched: true };
  }
  const { campaignId, recipientId } = mapSnap.val();
  const recRef = db.ref(`email_campaign_recipients/${campaignId}/${recipientId}`);
  const now = new Date().toISOString();

  if (type === 'Delivery') {
    await recRef.update({ status: 'delivered', deliveredAt: now });
    await bumpStat(db, campaignId, 'delivered');
  } else if (type === 'Bounce') {
    const bounce = notification.bounce || {};
    await recRef.update({
      status: 'bounced',
      bouncedAt: now,
      bounceType: bounce.bounceType || null,
      bounceSubType: bounce.bounceSubType || null
    });
    await bumpStat(db, campaignId, 'bounced');
  } else if (type === 'Complaint') {
    await recRef.update({ status: 'complained', complainedAt: now });
    await bumpStat(db, campaignId, 'complained');
    const dest = (mail.destination && mail.destination[0]) || null;
    if (dest) {
      await db.ref(`email_unsubscribes/${hashEmail(dest)}`).set({
        email: dest,
        at: now,
        reason: 'complaint',
        campaignId
      });
    }
  }

  return { ok: true, type, campaignId };
}

function registerEmailCampaignRoutes(app, { db, sesClient }) {
  const PIXEL_GIF = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );

  // ---- Listas importadas ----
  app.get('/api/email/lists/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      if (!(await assertMaster(db, userId))) {
        return res.status(403).json({ success: false, error: 'Apenas master' });
      }
      const snap = await db.ref('email_lists').once('value');
      const lists = [];
      if (snap.exists()) {
        Object.entries(snap.val()).forEach(([id, L]) => {
          if (L && L.masterUid === userId) lists.push({ id, ...L });
        });
      }
      lists.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      res.json({ success: true, lists });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/email/lists/import', upload.single('file'), async (req, res) => {
    try {
      const userId = String(req.body?.userId || '').trim();
      const name = String(req.body?.name || '').trim();
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId obrigatório' });
      }
      if (!(await assertMaster(db, userId))) {
        return res.status(403).json({ success: false, error: 'Apenas master' });
      }
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          error: 'Envie um ficheiro .csv, .xlsx ou .ods no campo "file"'
        });
      }

      const parsed = parseEmailFileBuffer(req.file.buffer, req.file.originalname || '');
      if (!parsed.rows.length) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum email válido encontrado no ficheiro'
        });
      }

      console.log(
        `📥 [email-list] import ${parsed.rows.length} emails (skip ${parsed.skipped}) por ${userId.slice(0, 8)}…`
      );

      const result = await createListFromRows(db, {
        masterUid: userId,
        name: name || req.file.originalname || 'Lista importada',
        rows: parsed.rows,
        fileName: req.file.originalname,
        skipped: parsed.skipped
      });

      res.json({
        success: true,
        ...result,
        maxRows: MAX_LIST_ROWS,
        truncated: parsed.rows.length >= MAX_LIST_ROWS
      });
    } catch (e) {
      console.error('❌ list import:', e);
      res.status(e.status || 500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/email/lists/:userId/:listId', async (req, res) => {
    try {
      const { userId, listId } = req.params;
      if (!(await assertMaster(db, userId))) {
        return res.status(403).json({ success: false, error: 'Apenas master' });
      }
      const snap = await db.ref(`email_lists/${listId}`).once('value');
      if (!snap.exists() || snap.val().masterUid !== userId) {
        return res.status(404).json({ success: false, error: 'Lista não encontrada' });
      }
      await db.ref(`email_list_chunks/${listId}`).remove();
      await db.ref(`email_lists/${listId}`).remove();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/email/templates/:userId/:templateId', async (req, res) => {
    try {
      const { userId, templateId } = req.params;
      if (!(await assertMaster(db, userId))) {
        return res.status(403).json({ success: false, error: 'Apenas master' });
      }
      if (!templateId) {
        return res.status(400).json({ success: false, error: 'templateId obrigatório' });
      }
      const snap = await db.ref(`email_templates/${templateId}`).once('value');
      if (!snap.exists()) {
        return res.status(404).json({ success: false, error: 'Template não encontrado' });
      }
      await db.ref(`email_templates/${templateId}`).remove();
      res.json({ success: true });
    } catch (e) {
      console.error('❌ delete template:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // BeeFree "HTML and images" (.zip) → HTML + imagens no Firebase Storage (URLs https)
  app.post('/api/email/templates/import-zip', upload.single('file'), async (req, res) => {
    try {
      const userId = String(req.body?.userId || '').trim();
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId obrigatório' });
      }
      if (!(await assertMaster(db, userId))) {
        return res.status(403).json({ success: false, error: 'Apenas master' });
      }
      if (!req.file?.buffer) {
        return res.status(400).json({
          success: false,
          error: 'Envie o .zip do BeeFree (HTML and images) no campo "file"'
        });
      }
      const name = String(req.file.originalname || '').toLowerCase();
      if (!name.endsWith('.zip') && req.file.mimetype && !req.file.mimetype.includes('zip')) {
        return res.status(400).json({ success: false, error: 'Ficheiro deve ser .zip' });
      }

      const pack = await htmlPackFromZipBuffer(req.file.buffer, userId);
      console.log(
        `✅ [email-template] ZIP import: ${pack.imageCount} imagens → Storage (${pack.htmlFile})`
      );
      res.json({
        success: true,
        html: pack.html,
        imageCount: pack.imageCount,
        htmlFile: pack.htmlFile
      });
    } catch (e) {
      console.error('❌ import-zip:', e);
      res.status(e.status || 500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/email/campaigns', async (req, res) => {
    try {
      const { userId, name, subject, html, templateId, audience, listId } = req.body || {};
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId obrigatório' });
      }

      let finalHtml = html;
      let finalSubject = subject;
      let finalName = name;

      // Preferir HTML do Firebase (evita POST enorme com imagens base64)
      if (templateId) {
        const tSnap = await db.ref(`email_templates/${templateId}`).once('value');
        if (!tSnap.exists()) {
          return res.status(404).json({ success: false, error: 'Template não encontrado' });
        }
        const t = tSnap.val();
        finalHtml = t.html || finalHtml;
        finalSubject = finalSubject || t.subject;
        finalName = finalName || t.name;
      }

      if (!finalHtml) {
        return res.status(400).json({
          success: false,
          error: 'Template sem HTML. Guarde o template com HTML antes de lançar.'
        });
      }

      // Aviso SES: emails muito grandes falham (~10MB)
      const htmlBytes = Buffer.byteLength(String(finalHtml), 'utf8');
      if (htmlBytes > 9 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: `HTML do template demasiado grande (${Math.round(htmlBytes / 1024 / 1024)}MB). Reduz imagens ou usa URLs em vez de embutir no ZIP.`
        });
      }

      const result = await createAndQueueCampaign(db, sesClient, {
        masterUid: userId,
        name: finalName,
        subject: finalSubject,
        html: finalHtml,
        audience: audience || 'crm',
        listId: listId || null
      });

      res.json({ success: true, ...result });
    } catch (e) {
      console.error('❌ create campaign:', e);
      res.status(e.status || 500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/email/campaigns/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      if (!(await assertMaster(db, userId))) {
        return res.status(403).json({ success: false, error: 'Apenas master' });
      }
      const snap = await db.ref('email_campaigns').once('value');
      const list = [];
      if (snap.exists()) {
        Object.entries(snap.val()).forEach(([id, c]) => {
          if (c && c.masterUid === userId) {
            list.push({ id, ...c, html: undefined });
          }
        });
      }
      list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      res.json({ success: true, campaigns: list });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/email/campaigns/:userId/:campaignId', async (req, res) => {
    try {
      const { userId, campaignId } = req.params;
      if (!(await assertMaster(db, userId))) {
        return res.status(403).json({ success: false, error: 'Apenas master' });
      }
      const snap = await db.ref(`email_campaigns/${campaignId}`).once('value');
      if (!snap.exists() || snap.val().masterUid !== userId) {
        return res.status(404).json({ success: false, error: 'Campanha não encontrada' });
      }
      const camp = snap.val();
      const recSnap = await db.ref(`email_campaign_recipients/${campaignId}`).once('value');
      const recipients = [];
      if (recSnap.exists()) {
        Object.entries(recSnap.val()).forEach(([id, r]) => {
          recipients.push({ id, ...r });
        });
      }
      recipients.sort((a, b) =>
        String(b.sentAt || b.createdAt || '').localeCompare(String(a.sentAt || a.createdAt || ''))
      );
      res.json({
        success: true,
        campaign: { id: campaignId, ...camp },
        recipients: recipients.slice(0, 2000)
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/email/campaigns/:campaignId/cancel', async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { userId } = req.body || {};
      if (!(await assertMaster(db, userId))) {
        return res.status(403).json({ success: false, error: 'Apenas master' });
      }
      const snap = await db.ref(`email_campaigns/${campaignId}`).once('value');
      if (!snap.exists() || snap.val().masterUid !== userId) {
        return res.status(404).json({ success: false, error: 'Campanha não encontrada' });
      }
      await db.ref(`email_campaigns/${campaignId}`).update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });
      stopWorker(campaignId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  async function deleteCampaignData(db, campaignId) {
    stopWorker(campaignId);
    await db.ref(`email_campaign_recipients/${campaignId}`).remove();
    await db.ref(`email_campaigns/${campaignId}`).remove();
  }

  app.delete('/api/email/campaigns/:userId/:campaignId', async (req, res) => {
    try {
      const { userId, campaignId } = req.params;
      if (!(await assertMaster(db, userId))) {
        return res.status(403).json({ success: false, error: 'Apenas master' });
      }
      const snap = await db.ref(`email_campaigns/${campaignId}`).once('value');
      if (!snap.exists() || snap.val().masterUid !== userId) {
        return res.status(404).json({ success: false, error: 'Campanha não encontrada' });
      }
      await deleteCampaignData(db, campaignId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/email/campaigns/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      if (!(await assertMaster(db, userId))) {
        return res.status(403).json({ success: false, error: 'Apenas master' });
      }
      const snap = await db.ref('email_campaigns').once('value');
      let deleted = 0;
      if (snap.exists()) {
        const entries = Object.entries(snap.val()).filter(([, c]) => c && c.masterUid === userId);
        for (const [id] of entries) {
          await deleteCampaignData(db, id);
          deleted += 1;
        }
      }
      res.json({ success: true, deleted });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/email/campaigns/:userId/:campaignId/report', async (req, res) => {
    try {
      const { userId, campaignId } = req.params;
      if (!(await assertMaster(db, userId))) {
        return res.status(403).json({ success: false, error: 'Apenas master' });
      }
      const snap = await db.ref(`email_campaigns/${campaignId}`).once('value');
      if (!snap.exists() || snap.val().masterUid !== userId) {
        return res.status(404).json({ success: false, error: 'Campanha não encontrada' });
      }
      const camp = snap.val();
      const recSnap = await db.ref(`email_campaign_recipients/${campaignId}`).once('value');
      const rows = [['nome', 'email', 'status', 'enviado_em', 'erro']];
      if (recSnap.exists()) {
        const list = Object.values(recSnap.val() || {});
        list.sort((a, b) =>
          String(a.sentAt || a.createdAt || '').localeCompare(String(b.sentAt || b.createdAt || ''))
        );
        for (const r of list) {
          if (!r) continue;
          rows.push([
            r.name || '',
            r.email || '',
            r.status || '',
            r.sentAt || r.openedAt || r.deliveredAt || '',
            r.error || ''
          ]);
        }
      }

      const escapeCsv = (v) => {
        const s = String(v ?? '');
        return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = '\uFEFF' + rows.map((row) => row.map(escapeCsv).join(';')).join('\n');
      const safeName = String(camp.name || campaignId)
        .replace(/[^\w\-]+/g, '_')
        .slice(0, 40);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="relatorio-${safeName}.csv"`
      );
      res.send(csv);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/email/audience-count/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const audience = req.query.audience || 'crm';
      const listId = req.query.listId || null;
      if (!(await assertMaster(db, userId))) {
        return res.status(403).json({ success: false, error: 'Apenas master' });
      }

      if (listId || (typeof audience === 'string' && audience.startsWith('list:'))) {
        const lid = listId || String(audience).slice(5);
        const snap = await db.ref(`email_lists/${lid}`).once('value');
        if (!snap.exists() || snap.val().masterUid !== userId) {
          return res.status(404).json({ success: false, error: 'Lista não encontrada' });
        }
        const count = Number(snap.val().count) || 0;
        return res.json({
          success: true,
          total: count,
          unsubscribed: null,
          sendable: count,
          note: 'Unsubs são filtrados no envio (não pré-contados na lista)'
        });
      }

      const list = await collectAudience(db, userId, audience);
      let unsub = 0;
      for (const r of list) {
        if (await isUnsubscribed(db, r.email)) unsub += 1;
      }
      res.json({
        success: true,
        total: list.length,
        unsubscribed: unsub,
        sendable: list.length - unsub
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/email/t/o/:token', async (req, res) => {
    try {
      await handleOpen(db, req.params.token);
    } catch (e) {
      console.warn('open track:', e.message);
    }
    res.set({
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache'
    });
    res.send(PIXEL_GIF);
  });

  app.get('/api/email/t/c/:token', async (req, res) => {
    try {
      const url = await handleClick(db, req.params.token);
      if (url && /^https?:\/\//i.test(url)) {
        return res.redirect(302, url);
      }
    } catch (e) {
      console.warn('click track:', e.message);
    }
    res.status(404).send('Link inválido');
  });

  app.get('/api/email/t/u/:token', async (req, res) => {
    try {
      const result = await handleUnsubscribe(db, req.params.token);
      if (result.ok) {
        return res
          .status(200)
          .type('html')
          .send(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"><title>Inscrição cancelada</title></head>
<body style="font-family:system-ui;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
  <div style="max-width:420px;padding:32px;background:#1e293b;border-radius:16px;text-align:center">
    <h1 style="font-size:1.25rem;margin:0 0 12px">Inscrição cancelada</h1>
    <p style="color:#94a3b8;margin:0">O email <strong style="color:#fff">${result.email}</strong> não receberá mais campanhas.</p>
  </div>
</body></html>`);
      }
    } catch (e) {
      console.warn('unsub:', e.message);
    }
    res.status(400).type('html').send('<p>Link de cancelamento inválido ou expirado.</p>');
  });

  app.post('/api/email/ses-sns', async (req, res) => {
    try {
      const result = await handleSesSns(db, req.body);
      res.json(result);
    } catch (e) {
      console.error('SES SNS:', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  setTimeout(async () => {
    try {
      const snap = await db.ref('email_campaigns').once('value');
      if (!snap.exists()) return;
      Object.entries(snap.val()).forEach(([id, c]) => {
        if (c && (c.status === 'queued' || c.status === 'sending')) {
          startWorker(db, sesClient, id);
        }
      });
    } catch (e) {
      console.warn('⚠️ resume email workers:', e.message);
    }
  }, 8000);
}

module.exports = {
  registerEmailCampaignRoutes,
  createAndQueueCampaign,
  assertMaster
};
