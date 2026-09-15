'use client';

import React, { useEffect, useState } from 'react';
import { ref, push, set } from 'firebase/database';
import SimpleEmailHtmlEditor, { DEFAULT_EMAIL_HTML } from './SimpleEmailHtmlEditor';

/**
 * Modal de criar/editar template de email.
 * Estado 100% local enquanto digita — evita perda de foco.
 */
export default function EmailTemplateModal({
  isOpen,
  onClose,
  template,
  database,
  showToast,
  t
}) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState(DEFAULT_EMAIL_HTML);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setName(template?.name || '');
    setSubject(template?.subject || '');
    setHtml(template?.html || template?.body?.html || DEFAULT_EMAIL_HTML);
    setEditorKey((k) => k + 1);
  }, [isOpen, template]);

  if (!isOpen) return null;

  const saveTemplate = async () => {
    if (!database) {
      showToast(t?.('toast.databaseUnavailable') || 'Base de dados indisponível', 'error');
      return;
    }
    if (!name.trim() || !subject.trim()) {
      showToast(t?.('toast.templateNameSubjectRequired') || 'Nome e assunto obrigatórios', 'error');
      return;
    }
    const finalHtml = String(html || '').trim();
    if (!finalHtml) {
      showToast('O HTML do email é obrigatório', 'error');
      return;
    }

    try {
      const templateToSave = {
        name: name.trim(),
        subject: subject.trim(),
        html: finalHtml,
        body: { html: finalHtml },
        createdAt: template?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (template?.id) {
        await set(ref(database, `email_templates/${template.id}`), templateToSave);
        showToast(t?.('toast.templateUpdated') || 'Template atualizado', 'success');
      } else {
        await set(push(ref(database, 'email_templates')), templateToSave);
        showToast(t?.('toast.templateCreated') || 'Template criado', 'success');
      }
      onClose();
    } catch (error) {
      console.error('❌ Erro ao salvar template:', error);
      showToast(
        `${t?.('toast.flowTemplateSaveError') || 'Erro'}: ${error.message || t?.('toast.unknownError') || ''}`,
        'error'
      );
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1a1f36',
          borderRadius: '24px',
          padding: '32px',
          maxWidth: '95vw',
          maxHeight: '95vh',
          width: '100%',
          height: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#ffffff', margin: 0 }}>
            {template ? 'Editar Template' : 'Criar Template'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#9ca3af',
              fontSize: '1.5rem',
              cursor: 'pointer',
              width: '32px',
              height: '32px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
              Nome do Template
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Boas-vindas"
              autoComplete="off"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '2px solid rgba(255,255,255,0.1)',
                backgroundColor: '#0f1419',
                color: '#ffffff',
                fontSize: '1rem',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
              Assunto do Email
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Bem-vindo ao {{companyName}}!"
              autoComplete="off"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '2px solid rgba(255,255,255,0.1)',
                backgroundColor: '#0f1419',
                color: '#ffffff',
                fontSize: '1rem',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px', margin: 0 }}>
              Variáveis: {'{{clientName}}'}, {'{{clientEmail}}'}, {'{{companyName}}'}
            </p>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
            Corpo do Email
          </label>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 8px' }}>
            Escreve à esquerda. A direita é só pré-visualização.
          </p>
          <div
            style={{
              flex: 1,
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              overflow: 'hidden',
              minHeight: 280
            }}
          >
            <SimpleEmailHtmlEditor
              key={editorKey}
              value={html}
              onChange={setHtml}
              height="100%"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              backgroundColor: '#6b7280',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem'
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={saveTemplate}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            {template ? 'Atualizar Template' : 'Salvar Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
