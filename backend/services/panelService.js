'use strict';

/**
 * Integração com API do painel Wplay/KnewCMS.
 * - Token manual: Firestore `configs/api_panel` → `bearer_token`
 * - Renovação automática: `POST /auth/static-token` com `panel_username` + `panel_password`
 *   (Firestore ou env PANEL_API_USERNAME / PANEL_API_PASSWORD)
 */

const admin = require('firebase-admin');
const axios = require('axios');

const PANEL_API_BASE = String(process.env.PANEL_API_BASE_URL || 'https://mcapi.knewcms.com:2087').replace(
  /\/$/,
  ''
);
const PANEL_TEST_URL = `${PANEL_API_BASE}/lines/test`;
const PANEL_STATIC_TOKEN_URL = `${PANEL_API_BASE}/auth/static-token`;

const DEFAULT_TEST_PAYLOAD = {
  notes: 'Gerado via Bot WhatsApp',
  package_p2p: '64399dca5ea59e8a1de2b083',
  package_iptv: 30,
  testDuration: 1,
  krator_package: '1'
};

const PANEL_HEADERS_BASE = {
  Origin: 'https://wwpanel.link',
  Referer: 'https://wwpanel.link/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
  'Content-Type': 'application/json',
  Accept: 'application/json'
};

/** Renovar JWT estes ms antes do `exp` (padrão 10 min). */
function panelTokenRefreshMarginMs() {
  const n = parseInt(process.env.PANEL_TOKEN_REFRESH_MARGIN_MS, 10);
  if (Number.isFinite(n) && n >= 60_000) return n;
  return 10 * 60 * 1000;
}

let _refreshPromise = null;
/** Cache em memória após refresh (evita leitura Firestore imediata). */
let _cachedBearerToken = null;

function looksLikeJwt(token) {
  const s = String(token || '').trim();
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(s);
}

function decodeJwtPayload(token) {
  if (!looksLikeJwt(token)) return null;
  const parts = String(token).split('.');
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = Buffer.from(b64 + pad, 'base64').toString('utf8');
    const o = JSON.parse(json);
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

function jwtExpiryMs(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
  return payload.exp * 1000;
}

function tokenShouldRefreshProactively(token) {
  const expMs = jwtExpiryMs(token);
  if (expMs == null) return false;
  return Date.now() >= expMs - panelTokenRefreshMarginMs();
}

function panelResponseIndicatesInvalidToken(status, data) {
  if (status === 401 || status === 403) return true;
  const raw =
    typeof data === 'string'
      ? data
      : data && typeof data === 'object'
        ? JSON.stringify(data)
        : String(data ?? '');
  const low = raw.toLowerCase();
  if (!low || low === 'null') return false;

  const authSignals =
    /unauthorized|invalid[_\s-]*token|token[_\s-]*expired|token[_\s-]*invalid|token.{0,48}inv[aá]lido|inv[aá]lido.{0,24}token|jwt[_\s-]*expired|acesso\s*negado|n[aã]o\s*autorizado|authentication\s*required|bearer\s*invalid|invalid[_\s-]*credentials|invalid[_\s-]*grant|sess[aã]o\s*expir|forbidden|"code"\s*:\s*401|"statuscode"\s*:\s*401|statuscode["\s:]*401/i;
  if (authSignals.test(low)) return true;

  if (data && typeof data === 'object') {
    const o = data;
    if (o.success === false && authSignals.test(low)) return true;
    const c = o.code;
    if (typeof c === 'string') {
      const cl = c.toLowerCase();
      if (
        cl.includes('unauth') ||
        cl.includes('invalid_token') ||
        cl.includes('token_expired') ||
        cl.includes('expired_token') ||
        cl.includes('forbidden') ||
        cl.includes('invalid_grant') ||
        cl === '401'
      ) {
        return true;
      }
    }
    if (typeof c === 'number' && c === 401) return true;
    const sc = o.statusCode ?? o.status_code;
    if (typeof sc === 'number' && sc === 401) return true;
  }
  return false;
}

async function probePanelBearerHttp(token) {
  const authHeaders = {
    ...PANEL_HEADERS_BASE,
    Authorization: `Bearer ${token}`
  };
  const tryGet = async () => {
    try {
      const response = await axios.get(PANEL_TEST_URL, {
        headers: authHeaders,
        timeout: 25000,
        validateStatus: () => true
      });
      return { method: 'GET', status: response.status, data: response.data };
    } catch (e) {
      return { method: 'GET', status: null, error: e.message };
    }
  };
  const tryPostEmpty = async () => {
    try {
      const response = await axios.post(PANEL_TEST_URL, {}, {
        headers: authHeaders,
        timeout: 25000,
        validateStatus: () => true
      });
      return { method: 'POST', status: response.status, data: response.data };
    } catch (e) {
      return { method: 'POST', status: null, error: e.message };
    }
  };

  const g = await tryGet();
  if (g.status === 401 || g.status === 403) return { ok: false, method: 'GET', status: g.status };
  if (g.status === 405 || g.status === 400 || g.status === 422 || g.status === 415) {
    if (panelResponseIndicatesInvalidToken(g.status, g.data)) {
      return { ok: false, method: 'GET', status: g.status };
    }
    return { ok: true, method: 'GET', status: g.status };
  }
  if (g.status != null && g.status >= 200 && g.status < 300) {
    if (panelResponseIndicatesInvalidToken(g.status, g.data)) {
      return { ok: false, method: 'GET', status: g.status };
    }
    const { usuario } = extractCredentials(g.data);
    if (usuario) {
      return {
        ok: null,
        method: 'GET',
        status: g.status,
        note: 'GET retornou credenciais inesperadas; probe inconclusivo'
      };
    }
    return { ok: true, method: 'GET', status: g.status };
  }
  if (g.status != null && g.status >= 500) return { ok: null, method: 'GET', status: g.status };

  const p = await tryPostEmpty();
  if (p.status === 401 || p.status === 403) return { ok: false, method: 'POST', status: p.status };
  if (p.status != null && p.status >= 400 && p.status < 500) {
    if (panelResponseIndicatesInvalidToken(p.status, p.data)) {
      return { ok: false, method: 'POST', status: p.status };
    }
    return { ok: true, method: 'POST', status: p.status };
  }
  if (p.status != null && p.status >= 200 && p.status < 300) {
    if (panelResponseIndicatesInvalidToken(p.status, p.data)) {
      return { ok: false, method: 'POST', status: p.status };
    }
    return { ok: true, method: 'POST', status: p.status };
  }
  if (p.status != null && p.status >= 500) return { ok: null, method: 'POST', status: p.status };
  return { ok: null, method: `${g.method || '?'}+${p.method || '?'}`, note: g.error || p.error || 'network' };
}

async function probePanelBearerHealth() {
  const mode = String(process.env.PANEL_BEARER_HEALTHCHECK_MODE || 'auto').toLowerCase();
  if (mode === 'off' || mode === 'false') {
    return { status: 'skipped', source: 'disabled', detail: mode };
  }

  let config;
  try {
    config = await getApiConfig();
  } catch (e) {
    const code = e && e.code ? String(e.code) : 'CONFIG';
    return { status: 'skipped', source: 'config', detail: code };
  }
  const token = config.bearer_token;

  const expMs = jwtExpiryMs(token);
  if (expMs != null) {
    if (Date.now() >= expMs) {
      const httpAfterJwt = await probePanelBearerHttp(token);
      if (httpAfterJwt.ok === true) {
        return { status: 'valid', source: 'http', detail: 'jwt_exp_claim_but_api_ok' };
      }
      if (httpAfterJwt.ok === false) {
        return { status: 'invalid', source: 'jwt', detail: 'jwt_expired' };
      }
      return { status: 'invalid', source: 'jwt', detail: 'jwt_expired' };
    }
    return { status: 'valid', source: 'jwt', detail: 'jwt_ok' };
  }

  if (mode === 'jwt') {
    if (looksLikeJwt(token)) {
      return { status: 'skipped', source: 'jwt', detail: 'jwt_sem_exp' };
    }
    return { status: 'skipped', source: 'jwt', detail: 'token_opaco' };
  }

  const http = await probePanelBearerHttp(token);
  if (http.ok === false) {
    return { status: 'invalid', source: 'http', detail: `http_${http.status || ''}` };
  }
  if (http.ok === true) {
    return { status: 'valid', source: 'http', detail: `${http.method || ''}_${http.status || ''}` };
  }
  return { status: 'skipped', source: 'http', detail: http.note || 'inconclusive' };
}

let _tokenExpiredHandler = null;

function setTokenExpiredNotifier(handler) {
  _tokenExpiredHandler = typeof handler === 'function' ? handler : null;
}

function notifyAdmin(event, detail = {}) {
  console.error(`[panel-api] ALERT ${event}`, detail);
  if (event === 'TOKEN_EXPIRED' && _tokenExpiredHandler) {
    try {
      const r = _tokenExpiredHandler(detail);
      if (r && typeof r.then === 'function') r.catch((e) => console.error('[panel-api] tokenExpiredHandler:', e));
    } catch (e) {
      console.error('[panel-api] tokenExpiredHandler:', e);
    }
  }
}

function getFirestore() {
  return admin.firestore();
}

async function readApiPanelDoc() {
  const snap = await getFirestore().collection('configs').doc('api_panel').get();
  if (!snap.exists) {
    const err = new Error('Documento Firestore configs/api_panel não encontrado');
    err.code = 'CONFIG_NOT_FOUND';
    throw err;
  }
  return snap.data() || {};
}

function resolvePanelCredentials(data) {
  const username = String(data?.panel_username || process.env.PANEL_API_USERNAME || '').trim();
  const password = String(data?.panel_password || process.env.PANEL_API_PASSWORD || '').trim();
  if (!username || !password) return null;
  return { username, password };
}

function hasPanelRefreshCredentials(data) {
  return !!resolvePanelCredentials(data);
}

function extractTokenFromStaticAuthResponse(data) {
  if (!data || typeof data !== 'object') return null;
  const direct = data.token || data.access_token || data.accessToken;
  if (direct) return String(direct).trim();
  if (data.data && typeof data.data === 'object') {
    const nested = data.data.token || data.data.access_token;
    if (nested) return String(nested).trim();
  }
  return null;
}

async function requestStaticToken(username, password) {
  const response = await axios.post(
    PANEL_STATIC_TOKEN_URL,
    { username, password },
    {
      headers: PANEL_HEADERS_BASE,
      timeout: 45000,
      validateStatus: () => true
    }
  );
  const { status, data } = response;
  if (status === 401) {
    const e = new Error('Utilizador ou senha do painel incorretos (401).');
    e.code = 'PANEL_AUTH_FAILED';
    e.status = 401;
    throw e;
  }
  if (status === 429) {
    const e = new Error('Muitas tentativas no painel (429). Aguarde e tente de novo.');
    e.code = 'PANEL_RATE_LIMIT';
    e.status = 429;
    throw e;
  }
  if (status < 200 || status >= 300) {
    const msg =
      data && typeof data === 'object'
        ? String(data.message || data.error || data.msg || '')
        : String(data || '');
    const e = new Error(msg.trim() || `Erro ao obter token (HTTP ${status})`);
    e.code = 'PANEL_STATIC_TOKEN_ERROR';
    e.status = status;
    e.responseData = data;
    throw e;
  }
  const token = extractTokenFromStaticAuthResponse(data);
  if (!token) {
    const e = new Error('Resposta de /auth/static-token sem campo token.');
    e.code = 'PANEL_STATIC_TOKEN_SHAPE';
    e.status = 502;
    e.responseData = data;
    throw e;
  }
  return token;
}

async function persistBearerToken(token, meta = {}) {
  const nowIso = new Date().toISOString();
  const expMs = jwtExpiryMs(token);
  const patch = {
    bearer_token: token,
    token_refreshed_at: nowIso,
    token_source: 'static-token',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...meta
  };
  if (expMs != null) {
    patch.token_expires_at = new Date(expMs).toISOString();
  }
  await getFirestore().collection('configs').doc('api_panel').set(patch, { merge: true });
  _cachedBearerToken = token;
  return token;
}

/**
 * Obtém novo JWT via POST /auth/static-token e grava no Firestore.
 * @param {{ reason?: string, force?: boolean }} [opts]
 */
async function refreshPanelBearerToken(opts = {}) {
  if (_refreshPromise && !opts.force) {
    return _refreshPromise;
  }

  const run = async () => {
    const doc = await readApiPanelDoc();
    const creds = resolvePanelCredentials(doc);
    if (!creds) {
      const e = new Error(
        'Credenciais do painel não configuradas. Defina panel_username e panel_password em configs/api_panel ou variáveis PANEL_API_USERNAME / PANEL_API_PASSWORD.'
      );
      e.code = 'PANEL_CREDENTIALS_MISSING';
      throw e;
    }

    console.log('🔄 [panel-api] Renovando token via /auth/static-token…', {
      reason: opts.reason || 'manual',
      user: creds.username
    });

    const token = await requestStaticToken(creds.username, creds.password);
    await persistBearerToken(token, {
      last_refresh_reason: String(opts.reason || 'manual')
    });

    const expMs = jwtExpiryMs(token);
    console.log('✅ [panel-api] Token renovado', {
      reason: opts.reason || 'manual',
      expiresAt: expMs ? new Date(expMs).toISOString() : 'sem_exp_jwt'
    });

    return token;
  };

  _refreshPromise = run().finally(() => {
    _refreshPromise = null;
  });
  return _refreshPromise;
}

/**
 * Tenta renovar se houver credenciais (healthcheck / 401).
 * @returns {Promise<boolean>} true se renovou com sucesso
 */
async function tryAutoRefreshPanelToken(reason = 'auto') {
  if (process.env.PANEL_TOKEN_AUTO_REFRESH === 'false') return false;
  try {
    const doc = await readApiPanelDoc();
    if (!hasPanelRefreshCredentials(doc)) return false;
    await refreshPanelBearerToken({ reason, force: true });
    return true;
  } catch (e) {
    console.warn('[panel-api] tryAutoRefreshPanelToken:', e.message);
    return false;
  }
}

/** Renovação proativa antes do JWT expirar (cron). */
async function tryProactivePanelTokenRefresh() {
  if (process.env.PANEL_TOKEN_AUTO_REFRESH === 'false') return false;
  try {
    const doc = await readApiPanelDoc();
    if (!hasPanelRefreshCredentials(doc)) return false;
    const token = String(_cachedBearerToken || doc.bearer_token || '').trim();
    if (!token) {
      await refreshPanelBearerToken({ reason: 'proactive_missing' });
      return true;
    }
    if (!tokenShouldRefreshProactively(token)) return false;
    await refreshPanelBearerToken({ reason: 'proactive_exp' });
    return true;
  } catch (e) {
    console.warn('[panel-api] tryProactivePanelTokenRefresh:', e.message);
    return false;
  }
}

async function getPanelConfigStatus() {
  let doc = {};
  try {
    doc = await readApiPanelDoc();
  } catch (e) {
    return {
      configFound: false,
      hasToken: false,
      hasCredentials: false,
      error: e.code || e.message
    };
  }
  const token = String(_cachedBearerToken || doc.bearer_token || '').trim();
  const expMs = token ? jwtExpiryMs(token) : null;
  return {
    configFound: true,
    hasToken: !!token,
    hasCredentials: hasPanelRefreshCredentials(doc),
    autoRefreshEnabled: process.env.PANEL_TOKEN_AUTO_REFRESH !== 'false',
    tokenSource: doc.token_source || (token ? 'manual' : null),
    tokenRefreshedAt: doc.token_refreshed_at || null,
    tokenExpiresAt: doc.token_expires_at || (expMs ? new Date(expMs).toISOString() : null),
    panelUsername: doc.panel_username ? String(doc.panel_username) : null,
    jwtExpiresSoon: token ? tokenShouldRefreshProactively(token) : false
  };
}

/**
 * @returns {Promise<{ bearer_token: string } & Record<string, unknown>>}
 */
async function getApiConfig() {
  const data = await readApiPanelDoc();
  let token = String(_cachedBearerToken || data.bearer_token || '').trim();
  const creds = resolvePanelCredentials(data);
  const autoOn = process.env.PANEL_TOKEN_AUTO_REFRESH !== 'false';

  if (!token && creds && autoOn) {
    token = await refreshPanelBearerToken({ reason: 'missing_token' });
    return { ...data, bearer_token: token };
  }

  if (token && creds && autoOn && tokenShouldRefreshProactively(token)) {
    try {
      token = await refreshPanelBearerToken({ reason: 'proactive' });
    } catch (e) {
      console.warn('[panel-api] Refresh proativo falhou; usando token atual:', e.message);
    }
  }

  if (!token) {
    const err = new Error(
      'Campo bearer_token vazio em configs/api_panel. Cole o token manualmente ou configure utilizador/senha para renovação automática.'
    );
    err.code = 'TOKEN_MISSING';
    throw err;
  }

  return { ...data, bearer_token: token };
}

function pickUsername(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return (
    obj.username ||
    obj.user ||
    obj.login ||
    obj.usuario ||
    (obj.line && (obj.line.username || obj.line.user)) ||
    null
  );
}

function pickPassword(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return (
    obj.password ||
    obj.pass ||
    obj.senha ||
    obj.pwd ||
    (obj.line && (obj.line.password || obj.line.pass)) ||
    null
  );
}

function extractCredentials(data) {
  if (!data || typeof data !== 'object') {
    return { usuario: null, senha: null };
  }
  const nested =
    data.data && typeof data.data === 'object'
      ? data.data
      : data.line && typeof data.line === 'object'
        ? data.line
        : data.result && typeof data.result === 'object'
          ? data.result
          : null;
  const base = nested || data;
  return {
    usuario: pickUsername(base) || pickUsername(data),
    senha: pickPassword(base) || pickPassword(data)
  };
}

function extractExpiryIso(data, mergedBody) {
  const tryCoerceIso = (v) => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') {
      const ms = v < 1e12 ? v * 1000 : v;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const s = String(v).trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  const scan = (obj, depth) => {
    if (!obj || typeof obj !== 'object' || depth > 6) return null;
    const keys = [
      'expiry',
      'expire_at',
      'expireAt',
      'expiration',
      'expires',
      'expires_at',
      'ended_at',
      'end_at',
      'valid_until',
      'expire_date',
      'expirationDate',
      'endDate',
      'end_time',
      'expiration_time'
    ];
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        const iso = tryCoerceIso(obj[k]);
        if (iso) return iso;
      }
    }
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') {
        const found = scan(v, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };

  const fromApi = scan(data, 0);
  if (fromApi) return fromApi;

  const td = Number(mergedBody?.testDuration ?? mergedBody?.days ?? mergedBody?.durationDays);
  const days = Number.isFinite(td) && td > 0 ? td : 1;
  return new Date(Date.now() + days * 86400000).toISOString();
}

async function postLinesTest(body, token) {
  return axios.post(PANEL_TEST_URL, body, {
    headers: {
      ...PANEL_HEADERS_BASE,
      Authorization: `Bearer ${token}`
    },
    timeout: 60000,
    validateStatus: () => true
  });
}

async function generateTestAccount(payloadOverrides = {}) {
  const mergedBody = {
    ...DEFAULT_TEST_PAYLOAD,
    ...(payloadOverrides && typeof payloadOverrides === 'object' ? payloadOverrides : {})
  };

  let config = await getApiConfig();
  let response = await postLinesTest(mergedBody, config.bearer_token);

  if (panelResponseIndicatesInvalidToken(response.status, response.data)) {
    const refreshed = await tryAutoRefreshPanelToken('lines_test_401');
    if (refreshed) {
      config = await getApiConfig();
      response = await postLinesTest(mergedBody, config.bearer_token);
    }
  }

  const { status, data } = response;

  if (panelResponseIndicatesInvalidToken(status, data)) {
    notifyAdmin('TOKEN_EXPIRED', { status, at: new Date().toISOString() });
    const e = new Error(
      'Token do painel inválido ou expirado. Configure utilizador/senha para renovação automática ou atualize bearer_token no Firestore.'
    );
    e.code = 'TOKEN_EXPIRED';
    e.status = status === 401 || status === 403 ? status : 401;
    throw e;
  }

  if (status < 200 || status >= 300) {
    const msg =
      data && typeof data === 'object'
        ? String(data.message || data.error || data.msg || '')
        : String(data || '');
    const e = new Error(msg ? msg.trim() : `Erro API painel (HTTP ${status})`);
    e.code = 'PANEL_API_ERROR';
    e.status = status;
    e.responseData = data;
    throw e;
  }

  const { usuario, senha } = extractCredentials(data);
  if (!usuario || !senha) {
    const e = new Error(
      'Resposta do painel sem username/password reconhecíveis. Confira o JSON devolvido pela API.'
    );
    e.code = 'PANEL_RESPONSE_SHAPE';
    e.status = 502;
    e.responseData = data;
    throw e;
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return { usuario, senha, expiresAt };
}

module.exports = {
  getApiConfig,
  readApiPanelDoc,
  generateTestAccount,
  extractExpiryIso,
  notifyAdmin,
  setTokenExpiredNotifier,
  probePanelBearerHealth,
  refreshPanelBearerToken,
  tryAutoRefreshPanelToken,
  tryProactivePanelTokenRefresh,
  getPanelConfigStatus,
  hasPanelRefreshCredentials,
  resolvePanelCredentials,
  persistBearerToken,
  jwtExpiryMs,
  looksLikeJwt,
  tokenShouldRefreshProactively,
  DEFAULT_TEST_PAYLOAD: { ...DEFAULT_TEST_PAYLOAD },
  PANEL_TEST_URL,
  PANEL_STATIC_TOKEN_URL,
  PANEL_API_BASE
};
