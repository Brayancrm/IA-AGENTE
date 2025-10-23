import { useState } from 'react';
import { X, Sparkles, Loader } from 'lucide-react';

/**
 * Modal para gerar template de fluxo usando IA
 */
export default function AIGeneratorModal({ isOpen, onClose, onGenerate }) {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Por favor, descreva o que você quer que o agente faça.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Chamar o backend para gerar o template
      const response = await fetch('/api/generate-flow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: description.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar template');
      }

      // Retornar o template gerado
      onGenerate(data.template);
      
      // Fechar modal
      setDescription('');
      onClose();
    } catch (err) {
      console.error('Erro ao gerar template:', err);
      setError(err.message || 'Erro ao gerar template. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setDescription('');
      setError('');
      onClose();
    }
  };

  const examples = [
    "Quero um agente que atenda clientes de uma clínica odontológica, agende consultas e confirme horários",
    "Preciso de um assistente para restaurante delivery que receba pedidos, colete endereço e processe pagamento",
    "Quero um bot para escola de inglês que qualifique leads, ofereça aula experimental e faça matrícula",
    "Preciso atender clientes de pet shop, vender produtos, agendar banho e tosa"
  ];

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
      onClick={handleClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '700px',
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
          alignItems: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
          <div>
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: 'white',
              margin: 0,
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Sparkles size={24} />
              Criar Fluxo com IA
            </h2>
            <p style={{ 
              fontSize: '14px', 
              color: 'rgba(255, 255, 255, 0.9)',
              margin: 0
            }}>
              Descreva o que você quer e a IA criará o fluxo para você
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background 0.2s',
              opacity: loading ? 0.5 : 1
            }}
            onMouseEnter={(e) => !loading && (e.target.style.background = 'rgba(255, 255, 255, 0.3)')}
            onMouseLeave={(e) => (e.target.style.background = 'rgba(255, 255, 255, 0.2)')}
          >
            <X size={24} color="white" />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px'
        }}>
          {/* Textarea de Descrição */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              Descreva o que você quer que o agente faça:
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError('');
              }}
              disabled={loading}
              placeholder="Ex: Quero um agente que atenda clientes de uma loja de roupas, mostre produtos, processe pedidos e solicite pagamento..."
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '12px',
                borderRadius: '8px',
                border: error ? '2px solid #ef4444' : '1px solid #d1d5db',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                background: loading ? '#f9fafb' : 'white',
                cursor: loading ? 'not-allowed' : 'text'
              }}
              onFocus={(e) => !error && (e.target.style.borderColor = '#667eea')}
              onBlur={(e) => !error && (e.target.style.borderColor = '#d1d5db')}
            />
            {error && (
              <p style={{
                color: '#ef4444',
                fontSize: '13px',
                marginTop: '8px',
                margin: '8px 0 0 0'
              }}>
                ⚠️ {error}
              </p>
            )}
          </div>

          {/* Exemplos */}
          <div style={{
            background: '#f9fafb',
            borderRadius: '8px',
            padding: '16px',
            border: '1px solid #e5e7eb'
          }}>
            <h4 style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151',
              margin: '0 0 12px 0'
            }}>
              💡 Exemplos de descrições:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {examples.map((example, index) => (
                <button
                  key={index}
                  onClick={() => !loading && setDescription(example)}
                  disabled={loading}
                  style={{
                    background: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: '#6b7280',
                    textAlign: 'left',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: loading ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => !loading && (e.target.style.borderColor = '#667eea', e.target.style.color = '#667eea')}
                  onMouseLeave={(e) => (e.target.style.borderColor = '#d1d5db', e.target.style.color = '#6b7280')}
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: '#eff6ff',
              borderRadius: '8px',
              border: '1px solid #93c5fd',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Loader size={20} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
              <div>
                <p style={{ margin: 0, fontWeight: '600', color: '#1e40af', fontSize: '14px' }}>
                  Gerando seu fluxo...
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                  A IA está criando os passos do seu agente. Isso pode levar alguns segundos.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          background: '#f9fafb'
        }}>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: 'white',
              color: '#374151',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontSize: '14px',
              opacity: loading ? 0.5 : 1
            }}
            onMouseEnter={(e) => !loading && (e.target.style.background = '#f9fafb')}
            onMouseLeave={(e) => (e.target.style.background = 'white')}
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || !description.trim()}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              background: loading || !description.trim() ? '#d1d5db' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontWeight: '600',
              cursor: loading || !description.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!loading && description.trim()) {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            {loading ? (
              <>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Gerar Fluxo
              </>
            )}
          </button>
        </div>
      </div>

      {/* CSS para animação de loading */}
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

