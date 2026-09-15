'use client';

import React, { useMemo, useState } from 'react';

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
  // Se já for o nosso HTML gerado, tenta extrair texto; senão devolve vazio para o user reescrever
  try {
    const withoutTags = String(html)
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
    return withoutTags;
  } catch {
    return '';
  }
}

/**
 * Editor simples: escreve texto normal → gera HTML do email.
 * Modo avançado opcional para colar HTML completo.
 */
export default function SimpleEmailHtmlEditor({ value, onChange, height = '100%' }) {
  const [advanced, setAdvanced] = useState(false);
  const [plain, setPlain] = useState(() => htmlToPlainHint(value) || 'Olá {{clientName}},\n\nEsta é uma mensagem de {{companyName}}.\n\nAté breve!');

  const previewHtml = useMemo(() => {
    if (advanced) return value || '';
    return wrapEmailHtml(plain);
  }, [advanced, value, plain]);

  const onPlainChange = (text) => {
    setPlain(text);
    onChange?.(wrapEmailHtml(text));
  };

  const onHtmlChange = (html) => {
    onChange?.(html);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height,
        minHeight: 320,
        background: '#fff'
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
          borderBottom: '1px solid #e5e7eb'
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
          {advanced ? 'HTML avançado' : 'Escreve a mensagem (texto normal)'}
        </span>
        <button
          type="button"
          onClick={() => {
            if (!advanced) {
              // ao entrar em avançado, usa HTML atual
              onChange?.(wrapEmailHtml(plain));
            } else {
              // ao sair, tenta voltar a texto
              const hint = htmlToPlainHint(value);
              if (hint) setPlain(hint);
            }
            setAdvanced((v) => !v);
          }}
          style={{
            border: '1px solid #d1d5db',
            background: '#fff',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            color: '#374151'
          }}
        >
          {advanced ? 'Modo simples' : 'Editar HTML'}
        </button>
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
              value={value || ''}
              onChange={(e) => onHtmlChange(e.target.value)}
              spellCheck={false}
              placeholder="Cole o HTML completo do email…"
              style={textareaStyle}
            />
          ) : (
            <textarea
              value={plain}
              onChange={(e) => onPlainChange(e.target.value)}
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
