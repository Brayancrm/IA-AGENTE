import { useState } from 'react';
import { X, Check, Clock, Layers } from 'lucide-react';
import { FLOW_TEMPLATES, getCategories } from '../constants/flowTemplates';

/**
 * Modal para selecionar templates de fluxo
 */
export default function TemplateModal({ isOpen, onClose, onSelectTemplate }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  if (!isOpen) return null;

  const categories = ['all', ...getCategories()];
  const filteredTemplates = selectedCategory === 'all' 
    ? FLOW_TEMPLATES 
    : FLOW_TEMPLATES.filter(t => t.category === selectedCategory);

  const handleApplyTemplate = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
      onClose();
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: '#1f2937',
              margin: 0,
              marginBottom: '4px'
            }}>
              📋 Templates Prontos
            </h2>
            <p style={{ 
              fontSize: '14px', 
              color: '#6b7280',
              margin: 0
            }}>
              Escolha um template para começar rapidamente
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
          >
            <X size={24} color="#6b7280" />
          </button>
        </div>

        {/* Categories */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          overflowX: 'auto'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: selectedCategory === cat ? '2px solid #3b82f6' : '1px solid #d1d5db',
                  background: selectedCategory === cat ? '#eff6ff' : 'white',
                  color: selectedCategory === cat ? '#3b82f6' : '#6b7280',
                  fontWeight: selectedCategory === cat ? '600' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  fontSize: '14px'
                }}
              >
                {cat === 'all' ? 'Todos' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                style={{
                  border: selectedTemplate?.id === template.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: selectedTemplate?.id === template.id ? '#eff6ff' : 'white',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (selectedTemplate?.id !== template.id) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTemplate?.id !== template.id) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                {/* Checkmark */}
                {selectedTemplate?.id === template.id && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: '#3b82f6',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={16} color="white" />
                  </div>
                )}

                {/* Template Name */}
                <div style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#1f2937',
                  marginBottom: '8px'
                }}>
                  {template.name}
                </div>

                {/* Description */}
                <p style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  marginBottom: '12px',
                  lineHeight: '1.5'
                }}>
                  {template.description}
                </p>

                {/* Meta info */}
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#9ca3af' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={14} />
                    {template.steps.length} passos
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} />
                    {template.estimatedTime}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preview Section */}
        {selectedTemplate && (
          <div style={{
            borderTop: '1px solid #e5e7eb',
            padding: '16px 24px',
            background: '#f9fafb',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#1f2937',
              marginBottom: '12px'
            }}>
              📋 Preview dos Passos:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedTemplate.steps.map((step, index) => (
                <div 
                  key={step.id}
                  style={{
                    fontSize: '13px',
                    color: '#4b5563',
                    display: 'flex',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontWeight: '600', color: '#6b7280' }}>
                    {index + 1}.
                  </span>
                  <span>{step.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: 'white',
              color: '#374151',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
            onMouseLeave={(e) => e.target.style.background = 'white'}
          >
            Cancelar
          </button>
          <button
            onClick={handleApplyTemplate}
            disabled={!selectedTemplate}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: selectedTemplate ? '#3b82f6' : '#d1d5db',
              color: 'white',
              fontWeight: '600',
              cursor: selectedTemplate ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (selectedTemplate) e.target.style.background = '#2563eb';
            }}
            onMouseLeave={(e) => {
              if (selectedTemplate) e.target.style.background = '#3b82f6';
            }}
          >
            Usar Template
          </button>
        </div>
      </div>
    </div>
  );
}

