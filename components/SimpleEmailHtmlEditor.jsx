'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFirebase } from '../hooks/useFirebase';

export const DEFAULT_EMAIL_HTML = wrapEmailHtml(
  'Olá {{clientName}},\n\nEsta é uma mensagem de {{companyName}}.\n\nPodes editar este texto normalmente.\n\nAté breve!'
);

export function wrapEmailHtml(plainText) {
  const text = String(plainText || '').trim();
  const bodyInner = text
    ? text
        .split(/\n{2,}/)
        .map((block) => {
          const lines = block
            .split('\n')
            .map((l) => escapeHtml(l))
            .join('<br/>');
          return `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#111827;">${lines}</p>`;
        })
        .join('')
    : '<p style="margin:0;color:#6b7280;">(mensagem vazia)</p>';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:28px 24px;">
              ${bodyInner}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlToPlainHint(html) {
  if (!html) return '';
  try {
    return String(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return '';
  }
}

function looksLikeHtml(s) {
  const t = String(s || '').trim();
  return /<\/?(html|body|table|div|p|span|a)\b/i.test(t) || t.includes('<!DOCTYPE');
}

/** Garante viewport + CSS fluido ao importar HTML externo (BeeFree). */
export function normalizeImportedEmailHtml(html) {
  let out = String(html || '');
  if (!out.trim()) return out;

  const fluidCss = `
<style type="text/css">
  img { max-width: 100% !important; height: auto !important; }
  table { max-width: 100% !important; }
  @media only screen and (max-width: 620px) {
    .container, .wrapper, .email-container { width: 100% !important; max-width: 100% !important; }
  }
</style>`;

  if (!/name=["']viewport["']/i.test(out)) {
    const viewport =
      '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>';
    if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${viewport}`);
    } else {
      out = `<head>${viewport}</head>${out}`;
    }
  }

  if (!/max-width:\s*100%\s*!important/.test(out)) {
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `${fluidCss}\n</head>`);
    } else {
      out = `${fluidCss}${out}`;
    }
  }

  return out;
}

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
 * BeeFree "HTML and images" → ZIP com index.html + pasta images/.
 * Embute imagens como data-URI para o email funcionar no SES/Gmail.
 */
export async function htmlPackFromZip(file) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const entries = Object.keys(zip.files || {}).filter((k) => !zip.files[k].dir);

  const htmlEntry =
    entries.find((k) => /(^|\/)index\.html?$/i.test(k)) ||
    entries.find((k) => /\.html?$/i.test(k) && !/__MACOSX/i.test(k));

  if (!htmlEntry) {
    throw new Error('ZIP sem ficheiro HTML (procura index.html)');
  }

  let html = await zip.files[htmlEntry].async('string');
  const htmlDir = htmlEntry.includes('/')
    ? htmlEntry.slice(0, htmlEntry.lastIndexOf('/') + 1)
    : '';

  const imageEntries = entries.filter((k) =>
    /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(k) && !/__MACOSX/i.test(k)
  );

  // path relativo (várias formas) → data URI
  const dataUriByRel = new Map();

  for (const imgPath of imageEntries) {
    const base64 = await zip.files[imgPath].async('base64');
    const mime = mimeFromPath(imgPath);
    const dataUri = `data:${mime};base64,${base64}`;
    const norm = normalizeZipPath(imgPath);
    const relFromHtml = normalizeZipPath(
      htmlDir && norm.startsWith(htmlDir) ? norm.slice(htmlDir.length) : norm
    );
    const fileName = norm.split('/').pop();

    [norm, relFromHtml, `./${relFromHtml}`, fileName, `images/${fileName}`]
      .filter(Boolean)
      .forEach((key) => dataUriByRel.set(key.toLowerCase(), dataUri));
  }

  const replaceRef = (ref) => {
    const raw = String(ref || '').trim();
    if (!raw || /^data:/i.test(raw) || /^https?:\/\//i.test(raw) || /^cid:/i.test(raw)) {
      return raw;
    }
    const cleaned = normalizeZipPath(raw.split('?')[0].split('#')[0]);
    const hit =
      dataUriByRel.get(cleaned.toLowerCase()) ||
      dataUriByRel.get(cleaned.split('/').pop().toLowerCase());
    return hit || raw;
  };

  html = html.replace(
    /(src|href)\s*=\s*(["'])([^"']+)\2/gi,
    (full, attr, quote, ref) => {
      if (attr.toLowerCase() === 'href' && !/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(ref)) {
        return full;
      }
      const next = replaceRef(ref);
      return `${attr}=${quote}${next}${quote}`;
    }
  );

  html = html.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, q, ref) => {
    const next = replaceRef(ref);
    return `url(${q || ''}${next}${q || ''})`;
  });

  html = html.replace(
    /background\s*=\s*(["'])([^"']+)\1/gi,
    (full, quote, ref) => `background=${quote}${replaceRef(ref)}${quote}`
  );

  return {
    html: normalizeImportedEmailHtml(html),
    imageCount: imageEntries.length,
    htmlFile: htmlEntry
  };
}

const btnStyle = {
  border: '1px solid #d1d5db',
  background: '#fff',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: '0.75rem',
  cursor: 'pointer',
  color: '#374151'
};

/**
 * Editor simples + importação de HTML (BeeFree / Really Good Emails / etc.).
 */
export default function SimpleEmailHtmlEditor({
  value,
  onChange,
  height = '100%',
  userId = null
}) {
  const { auth } = useFirebase();
  const resolvedUserId =
    userId ||
    auth?.currentUser?.uid ||
    null;

  const [advanced, setAdvanced] = useState(false);
  const [plain, setPlain] = useState(
    () =>
      htmlToPlainHint(value) ||
      'Olá {{clientName}},\n\nEsta é uma mensagem de {{companyName}}.\n\nAté breve!'
  );
  const [htmlDraft, setHtmlDraft] = useState(() => value || '');
  const [previewHtml, setPreviewHtml] = useState(() => value || wrapEmailHtml(plain));
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [importingPack, setImportingPack] = useState(false);
  const pickingFileRef = useRef(false);
  const fileRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const BACKEND_URL =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BACKEND_URL) ||
    'https://ia-agente-production.up.railway.app';

  useEffect(() => {
    const html = advanced ? htmlDraft : wrapEmailHtml(plain);
    const t = setTimeout(() => {
      setPreviewHtml(html);
      onChangeRef.current?.(html);
    }, 200);
    return () => clearTimeout(t);
  }, [plain, htmlDraft, advanced]);

  const applyImportedHtml = (raw) => {
    const html = normalizeImportedEmailHtml(String(raw || '').trim());
    if (!html) return false;
    if (!looksLikeHtml(html)) return false;
    setHtmlDraft(html);
    setPreviewHtml(html);
    setAdvanced(true);
    onChangeRef.current?.(html);
    setShowImport(false);
    setImportText('');
    setImportStatus('');
    return true;
  };

  const onPickImportFile = async (file) => {
    pickingFileRef.current = false;
    if (!file) {
      setImportStatus('Nenhum ficheiro selecionado.');
      return;
    }
    const lower = file.name.toLowerCase();
    console.log('[email-import] ficheiro:', file.name, file.size, file.type);
    try {
      if (lower.endsWith('.zip')) {
        const uid = resolvedUserId;
        if (!uid) {
          setImportStatus(
            'Erro: sessão sem userId. Faz logout/login ou recarrega a página (Ctrl+F5).'
          );
          console.warn('[email-import] userId prop=', userId, 'auth=', auth?.currentUser?.uid);
          return;
        }
        setImportingPack(true);
        setImportStatus('A enviar ZIP e a subir imagens… (pode demorar)');
        const fd = new FormData();
        fd.append('file', file);
        fd.append('userId', uid);
        const r = await fetch(`${BACKEND_URL}/api/email/templates/import-zip`, {
          method: 'POST',
          body: fd
        });
        const data = await r.json().catch(() => ({}));
        console.log('[email-import] resposta:', r.status, data);
        if (!r.ok || !data.success) {
          throw new Error(data.error || `Erro HTTP ${r.status}`);
        }
        if (!applyImportedHtml(data.html)) {
          setImportStatus('HTML do ZIP inválido.');
          return;
        }
        setImportStatus('');
        const baseOk = data.assetBase ? `URLs: ${data.assetBase}` : 'AVISO: backend sem PUBLIC_SERVER_URL — imagens podem falhar no telemóvel';
        alert(
          `Importado com ${data.imageCount || 0} imagem(ns).\n${baseOk}\nGuarda o template e lança a campanha.`
        );
        return;
      }
      if (lower.endsWith('.html') || lower.endsWith('.htm') || (file.type && file.type.includes('html'))) {
        setImportStatus('A ler HTML…');
        const text = await file.text();
        if (!applyImportedHtml(text)) {
          setImportStatus('O ficheiro não parece HTML válido.');
          return;
        }
        setImportStatus('');
        return;
      }
      setImportStatus('Usa .zip (HTML and images do BeeFree) ou .html');
    } catch (e) {
      console.error('[email-import]', e);
      setImportStatus(e.message || 'Erro ao importar ficheiro');
    } finally {
      setImportingPack(false);
      pickingFileRef.current = false;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height,
        minHeight: 320,
        background: '#fff',
        position: 'relative'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 12px',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          flexWrap: 'wrap'
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
          {advanced ? 'HTML importado / avançado' : 'Escreve a mensagem (texto normal)'}
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setShowImport(true)} style={{ ...btnStyle, borderColor: '#93c5fd', color: '#1d4ed8' }}>
            Importar HTML + imagens
          </button>
          <button
            type="button"
            onClick={() => {
              if (!advanced) {
                setHtmlDraft(wrapEmailHtml(plain));
              } else {
                const hint = htmlToPlainHint(htmlDraft || value);
                if (hint) setPlain(hint);
              }
              setAdvanced((v) => !v);
            }}
            style={btnStyle}
          >
            {advanced ? 'Modo simples' : 'Editar HTML'}
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          minHeight: 0
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb', minHeight: 0 }}>
          {advanced ? (
            <textarea
              value={htmlDraft}
              onChange={(e) => setHtmlDraft(e.target.value)}
              spellCheck={false}
              placeholder="Cole aqui o HTML do BeeFree / Really Good Emails…"
              style={textareaStyle}
            />
          ) : (
            <textarea
              value={plain}
              onChange={(e) => setPlain(e.target.value)}
              spellCheck
              placeholder={'Olá {{clientName}},\n\nEscreve aqui a tua mensagem…'}
              style={{ ...textareaStyle, fontFamily: 'inherit', fontSize: '0.95rem' }}
            />
          )}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            height: '100%',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: '#6b7280',
              background: '#f3f4f6',
              borderBottom: '1px solid #e5e7eb',
              flexShrink: 0
            }}
          >
            Pré-visualização (podes fazer scroll)
          </div>
          <iframe
            title="Pré-visualização do email"
            srcDoc={previewHtml || '<p style="padding:16px;color:#666">Pré-visualização</p>'}
            sandbox=""
            style={{
              flex: 1,
              minHeight: 0,
              width: '100%',
              border: 'none',
              background: '#fff',
              overflow: 'auto'
            }}
          />
        </div>
      </div>

      {showImport && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15,23,42,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 5
          }}
          onMouseDown={(e) => {
            // Não fechar ao escolher ficheiro (o click do diálogo caía no overlay)
            if (pickingFileRef.current || importingPack) return;
            if (e.target === e.currentTarget) setShowImport(false);
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 560,
              maxHeight: '90%',
              display: 'flex',
              flexDirection: 'column',
              padding: 16,
              boxShadow: '0 12px 40px rgba(0,0,0,0.25)'
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 8px', color: '#111827', fontSize: '1.05rem' }}>
              Importar HTML + imagens (BeeFree)
            </h4>
            <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.45 }}>
              No BeeFree escolhe <strong>HTML and images</strong> (.zip). Aqui clica em{' '}
              <strong>Escolher ficheiro</strong> e seleciona esse ZIP.
              As imagens sobem para URL https (Gmail mostra sem cortar).
            </p>

            {importStatus ? (
              <div
                style={{
                  marginBottom: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: importingPack ? '#eff6ff' : '#fef2f2',
                  color: importingPack ? '#1d4ed8' : '#b91c1c',
                  fontSize: '0.85rem'
                }}
              >
                {importStatus}
              </div>
            ) : null}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <button
                type="button"
                disabled={importingPack}
                onClick={() => {
                  pickingFileRef.current = true;
                  setImportStatus('');
                  // Liberta o overlay do click fantasma do file dialog
                  setTimeout(() => fileRef.current?.click(), 50);
                }}
                style={{
                  ...btnStyle,
                  background: '#059669',
                  borderColor: '#059669',
                  color: '#fff',
                  fontWeight: 600,
                  opacity: importingPack ? 0.7 : 1,
                  cursor: importingPack ? 'wait' : 'pointer',
                  padding: '10px 16px'
                }}
              >
                {importingPack ? 'A importar…' : 'Escolher ficheiro .zip / .html'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".zip,.html,.htm,application/zip,text/html"
                style={{ display: 'none' }}
                disabled={importingPack}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  onPickImportFile(f);
                }}
                onCancel={() => {
                  pickingFileRef.current = false;
                }}
              />
              <button
                type="button"
                disabled={importingPack}
                onClick={() => setShowImport(false)}
                style={btnStyle}
              >
                Fechar
              </button>
            </div>

            <details style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              <summary style={{ cursor: 'pointer' }}>Ou colar só HTML (sem imagens do ZIP)</summary>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Cola o HTML aqui…"
                spellCheck={false}
                style={{
                  ...textareaStyle,
                  minHeight: 100,
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  marginTop: 8,
                  marginBottom: 8
                }}
              />
              <button
                type="button"
                disabled={importingPack}
                onClick={() => {
                  if (!applyImportedHtml(importText)) {
                    setImportStatus('Cola um HTML válido ou envia o .zip.');
                  }
                }}
                style={{ ...btnStyle, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }}
              >
                Usar HTML colado
              </button>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

const textareaStyle = {
  flex: 1,
  width: '100%',
  border: 'none',
  outline: 'none',
  resize: 'none',
  padding: 14,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: '0.8rem',
  lineHeight: 1.5,
  color: '#111827',
  background: '#fff',
  boxSizing: 'border-box',
  minHeight: 240
};
