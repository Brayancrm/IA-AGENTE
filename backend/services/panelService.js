'use strict';

/**
 * Integração com API externa do painel (Bearer em Firestore).
 * Token: documento Firestore `configs` / `api_panel` → campo `bearer_token`.
 */

const admin = require('firebase-admin');
const axios = require('axios');

const PANEL_TEST_URL = 'https://mcapi.knewcms.com:2087/lines/test';

const DEFAULT_TEST_PAYLOAD = {
  notes: 'Gerado via Bot WhatsApp',
  package_p2p: '64399dca5ea59e8a1de2b083',
  package_iptv: '30',
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

/** Três segmentos base64url — pode ser JWT (nem sempre tem `exp`). */
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

/**
 * @returns {number|null} exp em ms UTC, ou null se não for JWT com `exp` numérico
 */
function jwtExpiryMs(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
  return payload.exp * 1000;
}

/**
 * Muitas APIs devolvem 400/422 (ou até 200 com JSON de erro) em vez de 401 quando o Bearer está errado.
 */
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

/**
 * Sonda HTTP sem corpo de teste completo: GET no endpoint (muitas APIs devolvem 405 com auth válida);
 * se inconclusivo, POST `{}` — 401/403 = token inválido; 4xx de validação costuma indicar auth aceite.
 * @returns {Promise<{ ok: boolean | null, method?: string, status?: number, note?: string }>}
 */
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
    const { usuario } = extractCredentials(p.data);
    if (usuario) {
      console.warn(
        '[panel-health] POST com corpo vazio criou conta de teste; desative sonda HTTP (PANEL_BEARER_HEALTHCHECK_MODE=jwt) ou use token JWT com exp.'
      );
    }
    return { ok: true, method: 'POST', status: p.status };
  }
  if (p.status != null && p.status >= 200 && p.status < 300) {
    if (panelResponseIndicatesInvalidToken(p.status, p.data)) {
      return { ok: false, method: 'POST', status: p.status };
    }
    const { usuario } = extractCredentials(p.data);
    if (usuario) {
      console.warn(
        '[panel-health] POST vazio devolveu 2xx com credenciais — evite sonda ou use JWT; assumindo token válido.'
      );
    }
    return { ok: true, method: 'POST', status: p.status };
  }
  if (p.status != null && p.status >= 500) return { ok: null, method: 'POST', status: p.status };
  return { ok: null, method: `${g.method || '?'}+${p.method || '?'}`, note: g.error || p.error || 'network' };
}

/**
 * @returns {Promise<{ status: 'valid' | 'invalid' | 'skipped'; source: string; detail?: string }>}
 */
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

/**
 * Regista callback opcional quando o token devolver 401 (ex.: notificar admin).
 * @param {(detail: object) => void | Promise<void>} handler
 */
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

/**
 * Lê configuração do painel no Firestore (configs/api_panel).
 * @returns {Promise<{ bearer_token: string } & Record<string, unknown>>}
 */
async function getApiConfig() {
  const snap = await getFirestore().collection('configs').doc('api_panel').get();
  if (!snap.exists) {
    const err = new Error('Documento Firestore configs/api_panel não encontrado');
    err.code = 'CONFIG_NOT_FOUND';
    throw err;
  }
  const data = snap.data() || {};
  const token = String(data.bearer_token || '').trim();
  if (!token) {
    const err = new Error('Campo bearer_token vazio em configs/api_panel');
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

/**
 * Tenta obter data/hora de expiração da resposta do painel; senão estima por testDuration (dias) do body enviado.
 * @param {unknown} data — JSON da API
 * @param {Record<string, unknown>} mergedBody — body efetivo (inclui testDuration)
 * @returns {string} ISO 8601
 */
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

/**
 * Gera conta de teste via API do painel.
 * @param {Record<string, unknown>} [payloadOverrides] — campos opcionais a fundir no body (ex.: notes, package_iptv).
 * @returns {Promise<{ usuario: string, senha: string, expiresAt: string }>}
 */
async function generateTestAccount(payloadOverrides = {}) {
  const config = await getApiConfig();
  const token = config.bearer_token;
  const body = { ...DEFAULT_TEST_PAYLOAD, ...(payloadOverrides && typeof payloadOverrides === 'object' ? payloadOverrides : {}) };

  try {
    const response = await axios.post(PANEL_TEST_URL, body, {
      headers: {
        ...PANEL_HEADERS_BASE,
        Authorization: `Bearer ${token}`
      },
      timeout: 60000,
      validateStatus: () => true
    });

    const { status, data } = response;

    if (status === 401) {
      notifyAdmin('TOKEN_EXPIRED', { status, at: new Date().toISOString() });
      const e = new Error(
        'Token do painel expirado ou inválido (401). Atualize o campo bearer_token no Firestore: configs → api_panel.'
      );
      e.code = 'TOKEN_EXPIRED';
      e.status = 401;
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
        'Resposta do painel sem username/password reconhecíveis. Confira o JSON devolvido pela API e ajuste extractCredentials se necessário.'
      );
      e.code = 'PANEL_RESPONSE_SHAPE';
      e.status = 502;
      e.responseData = data;
      throw e;
    }

    /** Regra de negócio: expiração apresentada ao cliente = 1 hora após a geração (independente do painel). */
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    return { usuario, senha, expiresAt };
  } catch (err) {
    if (err && err.response && err.response.status === 401) {
      notifyAdmin('TOKEN_EXPIRED', { at: new Date().toISOString() });
      const e = new Error(
        'Token do painel expirado ou inválido (401). Atualize o campo bearer_token no Firestore: configs → api_panel.'
      );
      e.code = 'TOKEN_EXPIRED';
      e.status = 401;
      throw e;
    }
    throw err;
  }
}

module.exports = {
  getApiConfig,
  generateTestAccount,
  extractExpiryIso, // mantido para testes / extensões; generateTestAccount usa +1h fixo
  notifyAdmin,
  setTokenExpiredNotifier,
  probePanelBearerHealth,
  jwtExpiryMs,
  looksLikeJwt,
  DEFAULT_TEST_PAYLOAD: { ...DEFAULT_TEST_PAYLOAD },
  PANEL_TEST_URL
};
