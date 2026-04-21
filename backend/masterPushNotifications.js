/**
 * Push FCM para utilizadores master (preferências + tokens em Realtime Database).
 * Não falha o fluxo principal: erros são apenas logados.
 */
const admin = require('firebase-admin');

const PREFS_DEFAULTS = {
  panelTestCreated: true,
  tvLoginSold: true,
  panelBearerInvalid: true
};

async function listMasterUserIds() {
  const db = admin.database();
  const snap = await db.ref('users/registered').once('value');
  const ids = new Set();
  if (snap.exists()) {
    for (const u of Object.values(snap.val())) {
      if (!u || typeof u.uid !== 'string') continue;
      const email = String(u.email || '').toLowerCase();
      if (u.isMaster === true || email === 'brayan.italy@gmail.com') {
        ids.add(u.uid);
      }
    }
  }
  return Array.from(ids);
}

async function prefsAllow(masterUid, eventKey) {
  if (!eventKey) return true;
  const snap = await admin.database().ref(`users/data/${masterUid}/master_notification_prefs`).once('value');
  const v = { ...PREFS_DEFAULTS, ...(snap.val() || {}) };
  return v[eventKey] !== false;
}

async function collectTokensForMaster(masterUid) {
  const snap = await admin.database().ref(`users/data/${masterUid}/fcm_tokens`).once('value');
  const rows = [];
  if (!snap.exists()) return rows;
  snap.forEach((c) => {
    const val = c.val();
    if (val && typeof val.token === 'string' && val.token.length > 20) {
      rows.push({ key: c.key, token: val.token });
    }
  });
  return rows;
}

async function removeBadToken(masterUid, key) {
  if (!key) return;
  try {
    await admin.database().ref(`users/data/${masterUid}/fcm_tokens/${key}`).remove();
  } catch (_) {
    /* ignore */
  }
}

async function sendToMasterDevices(masterUid, eventKey, title, body, data) {
  let messaging;
  try {
    messaging = admin.messaging();
  } catch (e) {
    console.warn('[PUSH] messaging indisponível:', e.message);
    return { skipped: true };
  }

  const allowed = await prefsAllow(masterUid, eventKey);
  if (!allowed) return { skipped: true };

  const rows = await collectTokensForMaster(masterUid);
  if (!rows.length) return { sent: 0 };

  const tokens = rows.map((r) => r.token);
  const dataStrings = {};
  const merged = { ...data, eventKey };
  for (const [k, v] of Object.entries(merged)) {
    dataStrings[k] = v == null ? '' : String(v);
  }

  try {
    const resp = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        fcmOptions: { link: '/' }
      },
      data: dataStrings
    });
    let ok = 0;
    resp.responses.forEach((r, i) => {
      if (r.success) ok += 1;
      else {
        const code = r.error?.code || '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-registration-token')
        ) {
          removeBadToken(masterUid, rows[i].key);
        }
      }
    });
    if (ok > 0) {
      console.log(`[PUSH] ${eventKey} → master ${masterUid.slice(0, 8)}… : ${ok}/${tokens.length} entregues`);
    }
    return { sent: ok };
  } catch (e) {
    console.warn('[PUSH] sendEachForMulticast:', e.message);
    return { error: e.message };
  }
}

async function notifyAllMasters(eventKey, title, body, data = {}) {
  const masterIds = await listMasterUserIds();
  for (const uid of masterIds) {
    await sendToMasterDevices(uid, eventKey, title, body, data);
  }
}

async function notifyMastersTvLoginSold({ sellerUserId, planName, planKey }) {
  const title = 'TV/Wplay vendido';
  const body =
    (planName && String(planName).trim()) ||
    `Conta vendedor ${sellerUserId ? String(sellerUserId).slice(0, 8) + '…' : '—'}`;
  await notifyAllMasters('tvLoginSold', title, body, {
    type: 'tv_login_sold',
    sellerUserId: sellerUserId || '',
    planName: planName || '',
    planKey: planKey || ''
  });
}

async function notifyMastersPanelBearerInvalid({ reason = '' } = {}) {
  const title = 'Token do painel inválido';
  const body =
    String(reason || '').includes('jwt') || String(reason || '').includes('JWT')
      ? 'O Bearer (JWT) expirou. Atualize em CRM → token do painel ou Firestore configs/api_panel.'
      : 'A API do painel recusou o token (401/403). Atualize bearer_token em configs → api_panel.';
  await notifyAllMasters('panelBearerInvalid', title, body, {
    type: 'panel_bearer_invalid',
    reason: String(reason || '')
  });
}

async function notifyMastersPanelTestCreated({ usuario, recipientLabel }) {
  const title = 'Teste do painel criado';
  const u = usuario && String(usuario).trim() ? String(usuario).trim() : '—';
  const label = recipientLabel && String(recipientLabel).trim() ? ` · ${String(recipientLabel).trim()}` : '';
  const body = `Utilizador: ${u}${label}`;
  await notifyAllMasters('panelTestCreated', title, body, {
    type: 'panel_test_created',
    usuario: u,
    recipientLabel: recipientLabel || ''
  });
}

module.exports = {
  listMasterUserIds,
  notifyMastersTvLoginSold,
  notifyMastersPanelBearerInvalid,
  notifyMastersPanelTestCreated,
  notifyAllMasters
};
