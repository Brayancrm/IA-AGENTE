import { useMemo, useState } from 'react';
import { X, Sparkles, Loader } from 'lucide-react';

/**
 * Modal para gerar template de fluxo usando IA
 */
const initialGuidedAnswers = {
  segment: '',
  audience: '',
  mainGoal: '',
  offerings: '',
  workflows: '',
  tone: 'Amigável e profissional',
  integrations: '',
  extras: ''
};

export default function AIGeneratorModal({ isOpen, onClose, onGenerate }) {
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('guided');
  const [guidedAnswers, setGuidedAnswers] = useState(initialGuidedAnswers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const guidedPrompt = useMemo(() => {
    const parts = [];

    if (guidedAnswers.segment.trim()) {
      parts.push(`Quero um agente para ${guidedAnswers.segment.trim()}`);
    }

    if (guidedAnswers.audience.trim()) {
      parts.push(`Atenda principalmente ${guidedAnswers.audience.trim()}`);
    }

    if (guidedAnswers.mainGoal.trim()) {
      parts.push(`O objetivo principal é ${guidedAnswers.mainGoal.trim()}`);
    }

    if (guidedAnswers.offerings.trim()) {
      parts.push(`Ele deve apresentar ou vender ${guidedAnswers.offerings.trim()}`);
    }

    if (guidedAnswers.workflows.trim()) {
      parts.push(`Fluxos obrigatórios: ${guidedAnswers.workflows.trim()}`);
    }

    if (guidedAnswers.integrations.trim()) {
      parts.push(`Considere integrações ou recursos como ${guidedAnswers.integrations.trim()}`);
    }

    if (guidedAnswers.tone.trim()) {
      parts.push(`Use um tom ${guidedAnswers.tone.trim()}`);
    }

    if (guidedAnswers.extras.trim()) {
      parts.push(`Detalhes adicionais: ${guidedAnswers.extras.trim()}`);
    }

    return parts.length ? `${parts.join('. ')}.` : '';
  }, [guidedAnswers]);

  const handleModeChange = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setError('');

    if (nextMode === 'manual' && !description.trim() && guidedPrompt.trim()) {
      setDescription(guidedPrompt.trim());
    }
  };

  const handleGuidedChange = (field, value) => {
    setGuidedAnswers((prev) => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const requiredGuidedMissing = ['segment', 'mainGoal'].filter(
    (field) => !guidedAnswers[field].trim()
  );

  if (!isOpen) return null;

  const handleGenerate = async () => {
    const promptToSend = mode === 'guided' ? guidedPrompt.trim() : description.trim();

    if (!promptToSend) {
      setError(
        mode === 'guided'
          ? 'Responda pelo menos o tipo de negócio e o objetivo principal para gerar o prompt.'
          : 'Por favor, descreva o que você quer que o agente faça.'
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      // URL do backend (Railway)
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ia-agente-production.up.railway.app';
      
      console.log('🤖 Chamando backend:', `${backendUrl}/api/generate-flow`);
      
      // Chamar o backend para gerar o template
      const response = await fetch(`${backendUrl}/api/generate-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: promptToSend
        })
      });

      console.log('📡 Status da resposta:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro da API:', errorText);
        throw new Error(`Erro ${response.status}: ${errorText || 'Falha ao gerar template'}`);
      }

      const data = await response.json();
      console.log('📦 Dados recebidos:', data);

      if (!data.success || !data.template) {
        throw new Error(data.error || 'Template inválido retornado pela IA');
      }

      console.log('✅ Template gerado com sucesso!');
      console.log('📊 Steps:', data.template.steps?.length || 0);

      // Retornar o template gerado
      onGenerate(data.template);
      
      // Fechar modal
      setDescription('');
      setGuidedAnswers(initialGuidedAnswers);
      setMode('guided');
      onClose();
    } catch (err) {
      console.error('❌ Erro completo:', err);
      
      let errorMessage = 'Erro ao gerar template. ';
      
      if (err.message.includes('Failed to fetch')) {
        errorMessage += 'Não foi possível conectar ao backend. Verifique se o servidor está rodando.';
      } else if (err.message.includes('OPENAI_API_KEY')) {
        errorMessage += 'Chave da OpenAI não configurada. Configure OPENAI_API_KEY no backend (Railway).';
      } else if (err.message.includes('429')) {
        errorMessage += 'Limite de requisições atingido. Aguarde alguns segundos e tente novamente.';
      } else if (err.message.includes('401')) {
        errorMessage += 'Chave da OpenAI inválida. Verifique a configuração no Railway.';
      } else {
        errorMessage += err.message || 'Tente novamente.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setDescription('');
      setError('');
      setGuidedAnswers(initialGuidedAnswers);
      setMode('guided');
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
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px'
          }}>
            <button
              onClick={() => handleModeChange('guided')}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid',
                borderColor: mode === 'guided' ? '#6366f1' : '#d1d5db',
                background: mode === 'guided' ? 'rgba(99, 102, 241, 0.12)' : 'white',
                color: mode === 'guided' ? '#4338ca' : '#374151',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Modo guiado
            </button>
            <button
              onClick={() => handleModeChange('manual')}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid',
                borderColor: mode === 'manual' ? '#6366f1' : '#d1d5db',
                background: mode === 'manual' ? 'rgba(99, 102, 241, 0.12)' : 'white',
                color: mode === 'manual' ? '#4338ca' : '#374151',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Modo livre
            </button>
          </div>

          {mode === 'guided' ? (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '20px'
              }}>
                {[
                  {
                    id: 'segment',
                    label: 'Qual é o negócio/segmento?',
                    placeholder: 'Ex: clínica odontológica em SP',
                    required: true
                  },
                  {
                    id: 'audience',
                    label: 'Quem o agente atende?',
                    placeholder: 'Ex: pacientes novos e recorrentes'
                  },
                  {
                    id: 'mainGoal',
                    label: 'Objetivo principal',
                    placeholder: 'Ex: qualificar leads e marcar consultas',
                    required: true
                  },
                  {
                    id: 'offerings',
                    label: 'Produtos ou serviços',
                    placeholder: 'Ex: limpeza, clareamento, planos mensais'
                  },
                  {
                    id: 'workflows',
                    label: 'Fluxos/etapas que o agente deve seguir',
                    placeholder: 'Ex: coletar dados, enviar orçamento, confirmar pagamento'
                  },
                  {
                    id: 'integrations',
                    label: 'Recursos extras',
                    placeholder: 'Ex: agenda, catálogo, emissão de boletos'
                  },
                  {
                    id: 'tone',
                    label: 'Tom da conversa',
                    placeholder: 'Ex: acolhedor e objetivo'
                  },
                  {
                    id: 'extras',
                    label: 'Observações finais',
                    placeholder: 'Regras, gatilhos, políticas...'
                  }
                ].map((field) => (
                  <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                      {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    <input
                      type="text"
                      value={guidedAnswers[field.id]}
                      onChange={(e) => handleGuidedChange(field.id, e.target.value)}
                      disabled={loading}
                      placeholder={field.placeholder}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: requiredGuidedMissing.includes(field.id) && error
                          ? '2px solid #ef4444'
                          : '1px solid #d1d5db',
                        fontSize: '13px',
                        background: loading ? '#f3f4f6' : 'white',
                        color: '#111827'
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{
                background: '#f9fafb',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                    Prompt sendo montado
                  </h4>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    Atualizado conforme você responde
                  </span>
                </div>
                <textarea
                  value={guidedPrompt}
                  readOnly
                  placeholder="Responda às perguntas acima e veja aqui o prompt completo..."
                  style={{
                    width: '100%',
                    minHeight: '140px',
                    borderRadius: '10px',
                    border: '1px dashed #94a3b8',
                    padding: '12px',
                    fontSize: '13px',
                    color: guidedPrompt ? '#111827' : '#9ca3af',
                    background: '#fff'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                  Este texto será enviado para a IA. Você pode alternar para o modo livre se quiser editar manualmente.
                </p>
              </div>
              {error && (
                <p style={{
                  color: '#ef4444',
                  fontSize: '13px',
                  marginTop: '12px'
                }}>
                  ⚠️ {error}
                </p>
              )}
            </>
          ) : (
            <>
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
            </>
          )}

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

