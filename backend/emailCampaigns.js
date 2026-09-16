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
const { SendEmailCommand, SendRawEmailCommand } = require('@aws-sdk/client-ses');

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

  const bucket = getEmailStorageBucket();
  console.log(`📦 [email-template] a usar Storage bucket: ${bucket.name}`);
  const packId = crypto.randomBytes(8).toString('hex');
  const urlByRel = new Map();
  const assetBase = publicBaseUrl();
  let imgIndex = 0;

  for (const imgPath of imageEntries) {
    let bytes = await zip.files[imgPath].async('nodebuffer');
    let mime = mimeFromPath(imgPath);
    const originalName = normalizeZipPath(imgPath).split('/').pop() || `image-${imgIndex}.bin`;
    // Nomes simples — evita 404 no proxy por caracteres estranhos do BeeFree
    const ext =
      (originalName.match(/(\.(png|jpe?g|gif|webp|svg|bmp))$/i) || [])[1] ||
      (mime.includes('gif') ? '.gif' : mime.includes('png') ? '.png' : '.jpg');
    let fileName = `img${imgIndex}${ext.toLowerCase()}`;
    imgIndex += 1;

    // Comprime imagens grandes (Gmail mobile falha com CID de ~2MB)
    if (bytes.length > 350000 && !mime.includes('gif')) {
      try {
        const sharp = require('sharp');
        bytes = await sharp(bytes)
          .rotate()
          .resize({ width: 600, withoutEnlargement: true })
          .jpeg({ quality: 78, mozjpeg: true })
          .toBuffer();
        mime = 'image/jpeg';
        fileName = fileName.replace(/\.\w+$/i, '.jpg');
        console.log(`🗜️ [email-template] ${originalName} → ${fileName} (${bytes.length} bytes)`);
      } catch (compErr) {
        console.warn(`⚠️ [email-template] compress skip ${originalName}:`, compErr.message);
      }
    }

    const dest = `email-assets/${userId}/${packId}/${fileName}`;
    const token = crypto.randomUUID();
    const file = bucket.file(dest);
    await file.save(bytes, {
      resumable: false,
      metadata: {
        contentType: mime,
        cacheControl: 'public, max-age=31536000',
        contentDisposition: 'inline',
        metadata: {
          firebaseStorageDownloadTokens: token,
          originalName
        }
      }
    });

    const [exists] = await file.exists();
    if (!exists) {
      console.error(`❌ [email-template] upload não persistiu: ${dest}`);
    }

    // Proxy no nosso backend = URL estável para Gmail mobile (evita ACL/token do Firebase)
    const tokenUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      dest
    )}?alt=media&token=${token}`;
    const publicUrl = assetBase
      ? `${assetBase}/api/email/assets/${encodeURIComponent(userId)}/${packId}/${encodeURIComponent(fileName)}`
      : tokenUrl;

    if (!assetBase) {
      console.warn(
        '⚠️ [email-template] PUBLIC_SERVER_URL/BACKEND_URL em falta — a usar URL Firebase (pior no mobile)'
      );
    }

    const norm = normalizeZipPath(imgPath);
    const relFromHtml = normalizeZipPath(
      htmlDir && norm.startsWith(htmlDir) ? norm.slice(htmlDir.length) : norm
    );
    [norm, relFromHtml, `./${relFromHtml}`, originalName, fileName, `images/${originalName}`]
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
  const fromEnv = String(
    process.env.PUBLIC_SERVER_URL || process.env.BACKEND_URL || ''
  ).replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const railway = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').replace(/\/$/, '');
  if (railway) return railway.startsWith('http') ? railway : `https://${railway}`;
  return '';
}

function getEmailStorageBucket() {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    admin.app().options.storageBucket ||
    'ia-agente-b2f46.firebasestorage.app';
  return admin.storage().bucket(bucketName);
}

/** Cache de bytes por URL (reutilizado entre destinatários da mesma campanha). */
const assetBytesCache = new Map();

function collectHostedImageUrls(html) {
  const urls = new Set();
  const add = (u) => {
    const url = String(u || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) return;
    if (
      /\/api\/email\/assets\//i.test(url) ||
      /firebasestorage\.googleapis\.com/i.test(url) ||
      /storage\.googleapis\.com\/[^/]+\/email-assets\//i.test(url)
    ) {
      urls.add(url.split('#')[0]);
    }
  };

  String(html || '').replace(
    /(?:src|background)\s*=\s*["']([^"']+)["']/gi,
    (_, u) => {
      add(u);
      return _;
    }
  );
  String(html || '').replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (_, u) => {
    add(u);
    return _;
  });
  return [...urls];
}

async function loadHostedAssetBytes(url) {
  if (assetBytesCache.has(url)) return assetBytesCache.get(url);

  let dest = null;
  const proxy = url.match(/\/api\/email\/assets\/([^/]+)\/([^/]+)\/([^/?#]+)/i);
  if (proxy) {
    dest = `email-assets/${decodeURIComponent(proxy[1])}/${proxy[2]}/${decodeURIComponent(proxy[3])}`;
  } else {
    const fb = url.match(/\/o\/([^?]+)\?/i);
    if (fb) {
      try {
        const path = decodeURIComponent(fb[1]);
        if (path.startsWith('email-assets/')) dest = path;
      } catch {
        /* ignore */
      }
    }
    const gcs = url.match(/storage\.googleapis\.com\/[^/]+\/(email-assets\/[^?#]+)/i);
    if (gcs) dest = decodeURIComponent(gcs[1]);
  }

  if (!dest) {
    assetBytesCache.set(url, null);
    return null;
  }

  try {
    const file = getEmailStorageBucket().file(dest);
    const [exists] = await file.exists();
    if (!exists) {
      console.warn('⚠️ [email-cid] ficheiro em falta:', dest);
      assetBytesCache.set(url, null);
      return null;
    }
    const [bytes] = await file.download();
    const [meta] = await file.getMetadata();
    const packed = {
      bytes,
      contentType: meta.contentType || mimeFromPath(dest)
    };
    assetBytesCache.set(url, packed);
    return packed;
  } catch (e) {
    console.warn('⚠️ [email-cid] download falhou:', dest, e.message);
    assetBytesCache.set(url, null);
    return null;
  }
}

/**
 * Embute imagens hositadas como CID (multipart/related).
 * No Gmail app aparecem sempre — não dependem do proxy externo.
 */
async function embedHostedImagesAsCid(html) {
  const urls = collectHostedImageUrls(html);
  if (!urls.length) return { html, attachments: [] };

  let out = html;
  const attachments = [];
  let idx = 0;

  for (const url of urls) {
    const loaded = await loadHostedAssetBytes(url);
    if (!loaded?.bytes?.length) continue;
    const cid = `img${idx}.${crypto.randomBytes(4).toString('hex')}@dadosia`;
    idx += 1;
    // substitui todas as ocorrências da URL (src, background, css url)
    out = out.split(url).join(`cid:${cid}`);
    attachments.push({
      cid,
      contentType: loaded.contentType,
      bytes: loaded.bytes
    });
  }

  console.log(
    `📎 [email-cid] ${attachments.length}/${urls.length} imagens embutidas no MIME`
  );
  return { html: out, attachments };
}

function encodeRfc2047Subject(subject) {
  const s = String(subject || '');
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

function foldBase64(b64) {
  return String(b64 || '').replace(/.{1,76}/g, (line) => `${line}\r\n`).trim();
}

function buildRawMimeEmail({ from, to, subject, html, attachments, configurationSet }) {
  const relatedBoundary = `----=_Related_${crypto.randomBytes(10).toString('hex')}`;
  const parts = [];

  parts.push(`From: ${from}`);
  parts.push(`To: ${to}`);
  parts.push(`Subject: ${encodeRfc2047Subject(subject)}`);
  parts.push('MIME-Version: 1.0');
  if (configurationSet) {
    parts.push(`X-SES-CONFIGURATION-SET: ${configurationSet}`);
  }

  if (!attachments?.length) {
    parts.push('Content-Type: text/html; charset=UTF-8');
    parts.push('Content-Transfer-Encoding: base64');
    parts.push('');
    parts.push(foldBase64(Buffer.from(String(html || ''), 'utf8').toString('base64')));
    return Buffer.from(parts.join('\r\n'), 'utf8');
  }

  parts.push(
    `Content-Type: multipart/related; type="text/html"; boundary="${relatedBoundary}"`
  );
  parts.push('');
  parts.push(`--${relatedBoundary}`);
  parts.push('Content-Type: text/html; charset=UTF-8');
  parts.push('Content-Transfer-Encoding: base64');
  parts.push('');
  parts.push(foldBase64(Buffer.from(String(html || ''), 'utf8').toString('base64')));

  for (const att of attachments) {
    parts.push(`--${relatedBoundary}`);
    parts.push(`Content-Type: ${att.contentType || 'application/octet-stream'}`);
    parts.push('Content-Transfer-Encoding: base64');
    parts.push(`Content-ID: <${att.cid}>`);
    parts.push('Content-Disposition: inline');
    parts.push('');
    parts.push(foldBase64(Buffer.from(att.bytes).toString('base64')));
  }

  parts.push(`--${relatedBoundary}--`);
  parts.push('');
  return Buffer.from(parts.join('\r\n'), 'utf8');
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
 * Reescreve URLs Firebase → proxy do backend (Gmail mobile busca melhor no nosso domínio).
 */
function rewriteAssetUrlsToProxy(html) {
  const base = publicBaseUrl();
  if (!base) return String(html || '');

  let out = String(html || '');

  out = out.replace(
    /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/"'\s]+\/o\/([^?"'\s]+)\?[^"'\s)]*/gi,
    (full, encodedPath) => {
      try {
        const path = decodeURIComponent(encodedPath);
        const m = path.match(/^email-assets\/([^/]+)\/([^/]+)\/(.+)$/);
        if (!m) return full;
        return `${base}/api/email/assets/${encodeURIComponent(m[1])}/${m[2]}/${encodeURIComponent(m[3])}`;
      } catch {
        return full;
      }
    }
  );

  out = out.replace(
    /https:\/\/storage\.googleapis\.com\/[^/"'\s]+\/email-assets\/([^/"'\s]+)\/([^/"'\s]+)\/([^"'\s)]+)/gi,
    (_, userId, packId, fileName) =>
      `${base}/api/email/assets/${encodeURIComponent(userId)}/${packId}/${encodeURIComponent(fileName)}`
  );

  return out;
}

/**
 * Gmail desktop aceita background-image; Gmail app NÃO.
 * Empresas usam <img src="..."> — convertemos backgrounds https em <img>.
 */
function promoteBackgroundImages(html) {
  let out = String(html || '');

  out = out.replace(/<(td|th|table|div)(\s[^>]*?)>/gi, (full, tag, attrs) => {
    if (/\sdata-dadosia-bg=["']1["']/i.test(attrs)) return full;

    let bgUrl = null;
    const bgAttr = attrs.match(/\bbackground\s*=\s*(["'])([^"']+)\1/i);
    if (bgAttr) {
      const v = bgAttr[2].trim();
      if (/^https?:\/\//i.test(v)) bgUrl = v;
    }
    if (!bgUrl) {
      const styleM = attrs.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i);
      if (styleM) {
        const um = styleM[2].match(
          /background(?:-image)?\s*:\s*[^;]*url\(\s*(['"]?)(https?:\/\/[^'")]+)\1\s*\)/i
        );
        if (um) bgUrl = um[2].trim();
      }
    }
    if (!bgUrl || !/^https?:\/\//i.test(bgUrl)) return full;

    // Evita duplicar se já houver indício de img de fundo tratada
    const safeSrc = bgUrl.replace(/"/g, '&quot;');
    const img =
      `<img src="${safeSrc}" alt="" width="100%" border="0" ` +
      `style="display:block;width:100%;max-width:100%;border:0;outline:none;text-decoration:none;" />`;
    return `<${tag}${attrs} data-dadosia-bg="1">${img}`;
  });

  return out;
}

/**
 * Gmail remove o <style> INTEIRO se tiver url(...) — e aí o layout mobile parte-se.
 * Tiramos só as regras com url(); o resto (media queries) fica.
 */
function stripUrlsFromStyleTags(html) {
  return String(html || '').replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, css) => {
    if (String(attrs).includes('dadosIA')) return full;
    const cleaned = css
      .replace(/background-image\s*:\s*[^;{}]*url\([^)]*\)\s*;?/gi, '')
      .replace(/background\s*:\s*[^;{}]*url\([^)]*\)[^;{}]*;?/gi, '')
      .replace(/list-style-image\s*:\s*[^;{}]*url\([^)]*\)\s*;?/gi, '');
    return `<style${attrs}>${cleaned}</style>`;
  });
}

/** Imagens BeeFree “escondidas” para mobile (display:none / 0px) voltam a aparecer. */
function unhideContentImages(html) {
  return String(html || '').replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    const isPixel =
      /\bwidth=["']1["']/i.test(attrs) ||
      /\bheight=["']1["']/i.test(attrs) ||
      /width:\s*1px/i.test(attrs) ||
      /height:\s*1px/i.test(attrs);
    if (isPixel) return full;

    let a = attrs
      .replace(/display\s*:\s*none\s*!important;?/gi, 'display:block;')
      .replace(/display\s*:\s*none;?/gi, 'display:block;')
      .replace(/visibility\s*:\s*hidden;?/gi, 'visibility:visible;')
      .replace(/max-height\s*:\s*0\s*!important;?/gi, '')
      .replace(/max-height\s*:\s*0px?;?/gi, '')
      .replace(/max-width\s*:\s*0\s*!important;?/gi, '')
      .replace(/overflow\s*:\s*hidden;?/gi, '')
      .replace(/\swidth=["']0["']/gi, ' width="100%"')
      .replace(/\sheight=["']0["']/gi, '');

    if (!/\sstyle=/i.test(a)) {
      a += ` style="display:block;max-width:100%;border:0;"`;
    }
    return `<img${a}>`;
  });
}

/**
 * Gmail app (Android) NÃO renderiza bem HTML BeeFree/RGE (backgrounds + colunas).
 * Não é “plano BeeFree”: é limitação do cliente de email.
 * Montamos versão mobile-safe em coluna única, MANTENDO links/botões <a href>.
 */
function escapeHtmlText(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rebuildMobileSafeEmailHtml(html) {
  const source = String(html || '');
  if (!source.trim()) return source;
  if (/data-dadosia-mobile=["']1["']/i.test(source)) return source;

  const blocks = [];
  const seenImg = new Set();
  const seenText = new Set();

  const pushTextFromHtml = (rawHtml) => {
    const chunk = String(rawHtml || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#(\d+);/g, (_, n) => {
        try {
          return String.fromCharCode(Number(n));
        } catch {
          return ' ';
        }
      });
    chunk.split(/\n+/).forEach((line) => {
      const t = String(line || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (t.length < 2) return;
      if (/^designed with rge/i.test(t)) return;
      if (/cancele a inscrição|unsubscribe|cancelar inscrição/i.test(t)) return;
      const key = t.toLowerCase();
      if (seenText.has(key)) return;
      seenText.add(key);
      blocks.push({ type: 'text', value: t });
    });
  };

  const pushImg = (src) => {
    const s = String(src || '').trim();
    if (!s || /^(data:|javascript:)/i.test(s)) return false;
    if (/spacer|pixel|tracking|1x1|open\.gif|\/t\/o\//i.test(s)) return false;
    if (seenImg.has(s)) return false;
    seenImg.add(s);
    blocks.push({ type: 'img', src: s });
    return true;
  };

  const tokenRe = /<a\b[^>]*>[\s\S]*?<\/a>|<img\b[^>]*>/gi;
  let last = 0;
  let match;
  while ((match = tokenRe.exec(source)) !== null) {
    pushTextFromHtml(source.slice(last, match.index));
    const token = match[0];
    last = match.index + token.length;

    if (/^<a\b/i.test(token)) {
      const hm = token.match(/\bhref\s*=\s*["']([^"']+)["']/i);
      const href = hm ? hm[1].trim() : '';
      const inner = token.replace(/^<a\b[^>]*>/i, '').replace(/<\/a>$/i, '');
      const imgM = inner.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
      const text = inner
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!href || href === '#' || /^javascript:/i.test(href)) {
        if (imgM) pushImg(imgM[1]);
        else pushTextFromHtml(text);
        continue;
      }

      blocks.push({
        type: 'link',
        href,
        img: imgM ? imgM[1].trim() : null,
        text: text || 'Clique aqui'
      });
      if (imgM) seenImg.add(imgM[1].trim());
      if (text) seenText.add(text.toLowerCase());
      continue;
    }

    // <img>
    const isPixel =
      /\bwidth=["']1["']/i.test(token) ||
      /\bheight=["']1["']/i.test(token) ||
      /width:\s*1px/i.test(token);
    if (isPixel) continue;
    const sm = token.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (sm) pushImg(sm[1]);
  }
  pushTextFromHtml(source.slice(last));

  // Backgrounds que ainda não entraram como <img>
  source.replace(/\bbackground\s*=\s*["']([^"']+)["']/gi, (_, u) => {
    if (/^https?:\/\//i.test(u) || /^cid:/i.test(u)) pushImg(u);
    return _;
  });

  if (!blocks.length) return source;

  const imgStyle =
    'display:block;width:100%;max-width:560px;height:auto;margin:12px auto;border:0;outline:none;';
  const textStyle =
    'margin:10px 16px;color:#111111;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.35;text-align:center;font-weight:700;';
  const btnStyle =
    'display:inline-block;padding:14px 22px;border:2px solid #111111;background:#f3f4f6;color:#111111;' +
    'text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;';

  const inner = blocks
    .map((b) => {
      if (b.type === 'img') {
        return `<img src="${escapeHtmlText(b.src)}" width="560" alt="" border="0" style="${imgStyle}" />`;
      }
      if (b.type === 'link') {
        if (b.img) {
          return (
            `<a href="${escapeHtmlText(b.href)}" target="_blank" style="text-decoration:none;">` +
            `<img src="${escapeHtmlText(b.img)}" width="560" alt="${escapeHtmlText(b.text)}" border="0" style="${imgStyle}" />` +
            `</a>`
          );
        }
        return (
          `<p style="margin:18px 16px;text-align:center;">` +
          `<a href="${escapeHtmlText(b.href)}" target="_blank" style="${btnStyle}">${escapeHtmlText(b.text)}</a>` +
          `</p>`
        );
      }
      return `<p style="${textStyle}">${escapeHtmlText(b.value)}</p>`;
    })
    .join('\n');

  console.log(
    `📱 [email-html] mobile-safe: ${blocks.filter((b) => b.type === 'img').length} imgs, ` +
      `${blocks.filter((b) => b.type === 'link').length} links, ` +
      `${blocks.filter((b) => b.type === 'text').length} textos`
  );

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>email</title>
</head>
<body data-dadosia-mobile="1" style="margin:0;padding:0;background:#000000;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000000;width:100%;">
<tr><td align="center" style="padding:16px 8px;background:#000000;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-collapse:collapse;">
<tr><td align="center" style="padding:20px 12px;background:#ffffff;">
${inner}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * HTML BeeFree/RGE → versão que o Gmail app consegue mostrar (com links).
 */
function normalizeEmailHtml(html) {
  let out = String(html || '');
  if (!out.trim()) return out;

  out = rewriteAssetUrlsToProxy(out);
  out = unhideContentImages(out);
  // Mobile-safe COM botões/links (Gmail app não aguenta layout BeeFree original)
  out = rebuildMobileSafeEmailHtml(out);

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
    // CID = imagens dentro do email (Gmail mobile mostra; outras empresas fazem assim)
    const { html: htmlCid, attachments } = await embedHostedImagesAsCid(html);
    const configurationSet = process.env.AWS_SES_CONFIGURATION_SET || undefined;

    let result;
    if (attachments.length > 0) {
      const raw = buildRawMimeEmail({
        from: source,
        to: email,
        subject,
        html: htmlCid,
        attachments,
        configurationSet
      });
      result = await sesClient.send(
        new SendRawEmailCommand({
          RawMessage: { Data: raw },
          Destinations: [email],
          Source: fromEmail,
          ...(configurationSet ? { ConfigurationSetName: configurationSet } : {})
        })
      );
    } else {
      const commandPayload = {
        Source: source,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Html: { Data: html, Charset: 'UTF-8' } }
        }
      };
      if (configurationSet) {
        commandPayload.ConfigurationSetName = configurationSet;
      }
      result = await sesClient.send(new SendEmailCommand(commandPayload));
      const sample = [...String(html).matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
        .map((m) => m[1])
        .slice(0, 5);
      console.warn('⚠️ [email-cid] nenhuma imagem embutida; srcs=', sample);
    }

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

  // Imagens do template (proxy público) — Gmail mobile precisa de URL estável no nosso domínio
  app.get('/api/email/assets/:userId/:packId/:fileName', async (req, res) => {
    try {
      const userId = String(req.params.userId || '').trim();
      const packId = String(req.params.packId || '').trim();
      const fileName = String(req.params.fileName || '')
        .trim()
        .replace(/\\/g, '/')
        .split('/')
        .pop();

      if (!userId || !packId || !fileName || !/^[\w.\-()+\s%]+$/i.test(fileName)) {
        return res.status(400).send('Bad request');
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(packId) || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
        return res.status(400).send('Bad request');
      }

      const dest = `email-assets/${userId}/${packId}/${fileName}`;
      console.log(`📥 [email-asset] GET ${dest}`);
      const file = getEmailStorageBucket().file(dest);
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).send('Not found');
      }

      const [meta] = await file.getMetadata();
      res.setHeader('Content-Type', meta.contentType || mimeFromPath(fileName));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      const stream = file.createReadStream();
      stream.on('error', (err) => {
        console.error('❌ [email-asset]', dest, err.message);
        if (!res.headersSent) res.status(500).end();
        else res.end();
      });
      stream.pipe(res);
    } catch (e) {
      console.error('❌ [email-asset]', e.message);
      if (!res.headersSent) res.status(500).send('Error');
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
      // Já aplica fixes mobile no HTML guardado no template
      const htmlReady = normalizeEmailHtml(pack.html);
      const sampleSrcs = [...String(htmlReady).matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
        .map((m) => m[1])
        .slice(0, 8);
      console.log(
        `✅ [email-template] ZIP import: ${pack.imageCount} imagens → Storage (${pack.htmlFile}) base=${publicBaseUrl() || 'NONE'}`
      );
      console.log(`🖼️ [email-template] img srcs:`, sampleSrcs);
      res.json({
        success: true,
        html: htmlReady,
        imageCount: pack.imageCount,
        htmlFile: pack.htmlFile,
        assetBase: publicBaseUrl() || null
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
        finalHtml = normalizeEmailHtml(t.html || finalHtml);
        finalSubject = finalSubject || t.subject;
        finalName = finalName || t.name;
      } else if (finalHtml) {
        finalHtml = normalizeEmailHtml(finalHtml);
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
