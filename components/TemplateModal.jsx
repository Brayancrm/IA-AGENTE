import { useState } from 'react';
import { X, Check, Clock, Layers } from 'lucide-react';
import { FLOW_TEMPLATES, getCategories, addAudioConfigStepToTemplate } from '../constants/flowTemplates';

/**
 * Modal para selecionar templates de fluxo
 */
export default function TemplateModal({ isOpen, onClose, onSelectTemplate }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  if (!isOpen) return null;

  const categories = ['all', ...getCategories()];
  const filteredTemplates = (selectedCategory === 'all' 
    ? FLOW_TEMPLATES 
    : FLOW_TEMPLATES.filter(t => t.category === selectedCategory)
  ).map(template => addAudioConfigStepToTemplate(template));

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
          backgroundColor: '#1a1f36',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: '#ffffff',
              margin: 0,
              marginBottom: '4px'
            }}>
              📋 Templates Prontos
            </h2>
            <p style={{ 
              fontSize: '14px', 
              color: '#9ca3af',
              margin: 0
            }}>
              Escolha um template para começar rapidamente
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
          >
            <X size={24} color="#9ca3af" />
          </button>
        </div>

        {/* Categories */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
          background: '#0f1419'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: '8px',
            flexWrap: 'wrap',
            justifyContent: 'flex-start'
          }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: selectedCategory === cat ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: selectedCategory === cat 
                    ? '#1a1f36' 
                    : '#1a1f36',
                  color: selectedCategory === cat ? 'white' : '#9ca3af',
                  fontWeight: selectedCategory === cat ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  fontSize: '13px',
                  boxShadow: selectedCategory === cat 
                    ? '0 2px 8px rgba(16, 185, 129, 0.3)' 
                    : '0 1px 3px rgba(0, 0, 0, 0.3)',
                  transform: selectedCategory === cat ? 'translateY(-1px)' : 'translateY(0)'
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory !== cat) {
                    e.target.style.background = '#1a1f36';
                    e.target.style.borderColor = '#10b981';
                    e.target.style.color = '#10b981';
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory !== cat) {
                    e.target.style.background = '#1a1f36';
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.color = '#9ca3af';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';
                  }
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
                  border: selectedTemplate?.id === template.id ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: selectedTemplate?.id === template.id ? 'rgba(16, 185, 129, 0.1)' : '#1a1f36',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (selectedTemplate?.id !== template.id) {
                    e.currentTarget.style.borderColor = '#10b981';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTemplate?.id !== template.id) {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
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
                    backgroundColor: '#1a1f36',
                    border: '1px solid #10b981',
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
                  color: '#ffffff',
                  marginBottom: '8px'
                }}>
                  {template.name}
                </div>

                {/* Description */}
                <p style={{
                  fontSize: '13px',
                  color: '#9ca3af',
                  marginBottom: '12px',
                  lineHeight: '1.5'
                }}>
                  {template.description}
                </p>

                {/* Meta info */}
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6b7280' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={14} color="#10b981" />
                    {template.steps.length} passos
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} color="#10b981" />
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
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '16px 24px',
            background: '#0f1419',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#ffffff',
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
                    color: '#9ca3af',
                    display: 'flex',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontWeight: '600', color: '#10b981' }}>
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
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: '#0f1419',
              color: '#ffffff',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#1a1f36'}
            onMouseLeave={(e) => e.target.style.background = '#0f1419'}
          >
            Cancelar
          </button>
          <button
            onClick={handleApplyTemplate}
            disabled={!selectedTemplate}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              backgroundColor: selectedTemplate ? '#1a1f36' : 'rgba(16, 185, 129, 0.2)',
              border: selectedTemplate ? '1px solid #10b981' : '1px solid rgba(16, 185, 129, 0.3)',
              color: 'white',
              fontWeight: '600',
              cursor: selectedTemplate ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (selectedTemplate) {
                e.target.style.backgroundColor = '#0f1419';
                e.target.style.borderColor = '#059669';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedTemplate) {
                e.target.style.backgroundColor = '#1a1f36';
                e.target.style.borderColor = '#10b981';
              }
            }}
          >
            Usar Template
          </button>
        </div>
      </div>
    </div>
  );
}

