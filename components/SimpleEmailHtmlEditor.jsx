'use client';

import React, { useMemo } from 'react';

export const DEFAULT_EMAIL_HTML = `<!DOCTYPE html>
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
            <td style="padding:28px 24px;color:#111827;font-size:16px;line-height:1.5;">
              <h1 style="margin:0 0 12px;font-size:22px;">Olá {{clientName}},</h1>
              <p style="margin:0 0 16px;">Esta é uma mensagem de <strong>{{companyName}}</strong>.</p>
              <p style="margin:0 0 24px;">Podes editar este HTML e usar as variáveis no assunto e no corpo.</p>
              <a href="https://orionb2b.com.br" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:bold;">
                Abrir site
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export default function SimpleEmailHtmlEditor({ value, onChange, height = '100%' }) {
  const previewSrcDoc = useMemo(() => value || '<p style="padding:16px;color:#666">Pré-visualização vazia</p>', [value]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 0,
        height,
        minHeight: 320,
        background: '#fff'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb', minHeight: 0 }}>
        <div
          style={{
            padding: '8px 12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#6b7280',
            background: '#f9fafb',
            borderBottom: '1px solid #e5e7eb'
          }}
        >
          HTML
        </div>
        <textarea
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          spellCheck={false}
          placeholder="Cole ou escreva o HTML do email…"
          style={{
            flex: 1,
            width: '100%',
            border: 'none',
            outline: 'none',
            resize: 'none',
            padding: 12,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '0.8rem',
            lineHeight: 1.45,
            color: '#111827',
            background: '#fff',
            boxSizing: 'border-box'
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            padding: '8px 12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#6b7280',
            background: '#f9fafb',
            borderBottom: '1px solid #e5e7eb'
          }}
        >
          Pré-visualização
        </div>
        <iframe
          title="Pré-visualização do email"
          srcDoc={previewSrcDoc}
          sandbox=""
          style={{
            flex: 1,
            width: '100%',
            border: 'none',
            background: '#fff'
          }}
        />
      </div>
    </div>
  );
}
