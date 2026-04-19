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
  DEFAULT_TEST_PAYLOAD: { ...DEFAULT_TEST_PAYLOAD },
  PANEL_TEST_URL
};
