/**
 * Campanhas de email em massa (só master) via AWS SES.
 * Tracking: delivery/bounce/complaint (SNS) + open/click (pixel + redirect) + unsubscribe.
 */
const crypto = require('crypto');
const { SendEmailCommand } = require('@aws-sdk/client-ses');

const TRACK_SECRET =
  process.env.EMAIL_TRACKING_SECRET ||
  process.env.AWS_SECRET_ACCESS_KEY ||
  'ia-agente-email-track';

const SEND_INTERVAL_MS = Math.max(
  80,
  parseInt(process.env.EMAIL_CAMPAIGN_INTERVAL_MS || '120', 10) || 120
);

/** @type {Map<string, { timer: NodeJS.Timeout|null, busy: boolean }>} */
const campaignWorkers = new Map();

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

function injectTracking(html, { openUrl, unsubUrl, clickBase, campaignId, recipientId }) {
  let out = String(html || '');

  // Wrap http(s) links for click tracking (skip unsubscribe/mailto/tel/#)
  out = out.replace(
    /href\s*=\s*["'](https?:\/\/[^"']+)["']/gi,
    (full, url) => {
      const lower = String(url).toLowerCase();
      if (
        lower.includes('/api/email/t/') ||
        lower.includes('unsubscribe') ||
        lower.startsWith('mailto:') ||
        lower.startsWith('tel:')
      ) {
        return full;
      }
      const token = signPayload({
        t: 'c',
        c: campaignId,
        r: recipientId,
        u: url
      });
      return `href="${clickBase}/api/email/t/c/${token}"`;
    }
  );

  const pixel = `<img src="${openUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;
  const unsub = `
<p style="margin-top:24px;font-size:12px;color:#6b7280;text-align:center;">
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
  await ref.transaction((cur) => (Number(cur) || 0) + delta);
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

async function createAndQueueCampaign(db, sesClient, { masterUid, name, subject, html, audience }) {
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

  const campRef = db.ref('email_campaigns').push();
  const campaignId = campRef.key;
  const now = new Date().toISOString();

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

  const updates = {};
  filtered.forEach((r) => {
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

  // Confirmação de subscription SNS
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

  if (type === 'Delivery' || type === 'DeliveryDelay') {
    if (type === 'Delivery') {
      await recRef.update({ status: 'delivered', deliveredAt: now });
      await bumpStat(db, campaignId, 'delivered');
    }
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

  app.post('/api/email/campaigns', async (req, res) => {
    try {
      const { userId, name, subject, html, templateId, audience } = req.body || {};
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId obrigatório' });
      }

      let finalHtml = html;
      let finalSubject = subject;
      let finalName = name;

      if (templateId && (!finalHtml || !finalSubject)) {
        const tSnap = await db.ref(`email_templates/${templateId}`).once('value');
        if (!tSnap.exists()) {
          return res.status(404).json({ success: false, error: 'Template não encontrado' });
        }
        const t = tSnap.val();
        finalHtml = finalHtml || t.html;
        finalSubject = finalSubject || t.subject;
        finalName = finalName || t.name;
      }

      const result = await createAndQueueCampaign(db, sesClient, {
        masterUid: userId,
        name: finalName,
        subject: finalSubject,
        html: finalHtml,
        audience: audience || 'crm'
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
      recipients.sort((a, b) => String(b.sentAt || b.createdAt || '').localeCompare(String(a.sentAt || a.createdAt || '')));
      res.json({
        success: true,
        campaign: { id: campaignId, ...camp },
        recipients: recipients.slice(0, 500)
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

  app.get('/api/email/audience-count/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const audience = req.query.audience || 'crm';
      if (!(await assertMaster(db, userId))) {
        return res.status(403).json({ success: false, error: 'Apenas master' });
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

  // Tracking: open pixel
  app.get('/api/email/t/o/:token', async (req, res) => {
    try {
      await handleOpen(db, req.params.token);
    } catch (e) {
      console.warn('open track:', e.message);
    }
    res.set({
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache'
    });
    res.send(PIXEL_GIF);
  });

  // Tracking: click
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

  // Unsubscribe
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

  // SES → SNS webhook
  app.post('/api/email/ses-sns', async (req, res) => {
    try {
      const result = await handleSesSns(db, req.body);
      res.json(result);
    } catch (e) {
      console.error('SES SNS:', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Resume workers for queued/sending campaigns after restart
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
