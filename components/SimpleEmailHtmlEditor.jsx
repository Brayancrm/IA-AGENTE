'use client';

import React, { useEffect, useRef, useState } from 'react';

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
export default function SimpleEmailHtmlEditor({ value, onChange, height = '100%' }) {
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
  const fileRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const html = advanced ? htmlDraft : wrapEmailHtml(plain);
    const t = setTimeout(() => {
      setPreviewHtml(html);
      onChangeRef.current?.(html);
    }, 200);
    return () => clearTimeout(t);
  }, [plain, htmlDraft, advanced]);

  const applyImportedHtml = (raw) => {
    const html = String(raw || '').trim();
    if (!html) return false;
    if (!looksLikeHtml(html)) return false;
    setHtmlDraft(html);
    setPreviewHtml(html);
    setAdvanced(true);
    onChangeRef.current?.(html);
    setShowImport(false);
    setImportText('');
    return true;
  };

  const onPickHtmlFile = async (file) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.html') && !lower.endsWith('.htm') && file.type && !file.type.includes('html')) {
      alert('Usa um ficheiro .html');
      return;
    }
    try {
      const text = await file.text();
      if (!applyImportedHtml(text)) {
        alert('O ficheiro não parece HTML válido.');
      }
    } catch (e) {
      alert(e.message || 'Erro ao ler ficheiro');
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
            Importar HTML
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
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, pointerEvents: 'none' }}>
          <div
            style={{
              padding: '6px 12px',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: '#6b7280',
              background: '#f3f4f6',
              borderBottom: '1px solid #e5e7eb'
            }}
          >
            Pré-visualização (só leitura)
          </div>
          <iframe
            title="Pré-visualização do email"
            srcDoc={previewHtml || '<p style="padding:16px;color:#666">Pré-visualização</p>'}
            sandbox=""
            tabIndex={-1}
            style={{
              flex: 1,
              width: '100%',
              border: 'none',
              background: '#fff'
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
          onClick={() => setShowImport(false)}
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
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 8px', color: '#111827', fontSize: '1.05rem' }}>
              Importar HTML (BeeFree / Really Good Emails)
            </h4>
            <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.45 }}>
              No BeeFree: <strong>Download / Integrations</strong> → <strong>HTML code</strong> (copiar)
              ou <strong>HTML and images</strong>. Depois cola aqui ou envia o ficheiro .html.
              Mantém {'{{clientName}}'} no design se quiseres personalizar.
            </p>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Cola o HTML completo aqui…"
              spellCheck={false}
              style={{
                ...textareaStyle,
                minHeight: 180,
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                marginBottom: 12
              }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  if (!applyImportedHtml(importText)) {
                    alert('Cola um HTML válido (exportado do BeeFree).');
                  }
                }}
                style={{
                  ...btnStyle,
                  background: '#2563eb',
                  borderColor: '#2563eb',
                  color: '#fff',
                  fontWeight: 600
                }}
              >
                Usar este HTML
              </button>
              <label
                style={{
                  ...btnStyle,
                  display: 'inline-flex',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                Enviar ficheiro .html
                <input
                  ref={fileRef}
                  type="file"
                  accept=".html,.htm,text/html"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) onPickHtmlFile(f);
                  }}
                />
              </label>
              <button type="button" onClick={() => setShowImport(false)} style={btnStyle}>
                Cancelar
              </button>
            </div>
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
