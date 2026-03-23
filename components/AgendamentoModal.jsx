import React from 'react';
import { ref, set, push, get } from 'firebase/database';

const AgendamentoModal = ({ 
  isOpen, 
  onClose, 
  editingAgendamento, 
  user, 
  database,
  agendamentos = [],
  showToast 
}) => {
  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user || !database) {
      showToast('❌ Erro: Usuário não autenticado', 'error');
      return;
    }
    
    console.log('💾 [SAVE] Salvando agendamento no Firebase...');
    const formData = new FormData(e.target);
    const titulo = String(formData.get('titulo') || '').trim();
    const descricao = String(formData.get('descricao') || '').trim();
    const cliente = String(formData.get('cliente') || '').trim();
    const telefoneRaw = String(formData.get('telefone') || '').trim();
    const telefone = telefoneRaw.replace(/\D/g, '');
    const data = String(formData.get('data') || '').trim();
    const horario = String(formData.get('horario') || '').trim();
    const novoStatus = String(formData.get('status') || 'pendente');

    if (titulo.length < 3) {
      showToast('Título deve ter no mínimo 3 caracteres.', 'error');
      return;
    }

    if (!data || !horario) {
      showToast('Data e horário são obrigatórios.', 'error');
      return;
    }

    const dataHora = new Date(`${data}T${horario}:00`);
    if (Number.isNaN(dataHora.getTime())) {
      showToast('Data ou horário inválidos.', 'error');
      return;
    }

    if (telefone && telefone.length < 10) {
      showToast('Telefone inválido. Informe DDD + número.', 'error');
      return;
    }

    const hasConflict = agendamentos.some((item) => (
      item?.id !== editingAgendamento?.id &&
      item?.data === data &&
      item?.horario === horario &&
      (item?.cliente?.toLowerCase() === cliente.toLowerCase() || item?.telefone?.replace(/\D/g, '') === telefone)
    ));

    if (hasConflict) {
      showToast('Conflito detectado: já existe agendamento nesse horário para este cliente/telefone.', 'error');
      return;
    }

    const agendamentoData = {
      titulo,
      descricao,
      tipo: formData.get('tipo'),
      status: novoStatus,
      data,
      horario,
      cliente,
      telefone,
      observacoes: String(formData.get('observacoes') || '').trim(),
      updatedAt: new Date().toISOString()
    };
    
    try {
      if (editingAgendamento) {
        // ✏️ EDITAR agendamento existente
        const agendamentoRef = ref(database, `users/data/${user.uid}/agendamentos/${editingAgendamento.id}`);
        const existingSnapshot = await get(agendamentoRef);
        const existing = existingSnapshot.exists() ? existingSnapshot.val() : {};
        const statusHistory = Array.isArray(existing.statusHistory) ? existing.statusHistory : [];
        const nextStatusHistory = existing.status !== novoStatus
          ? [
              ...statusHistory,
              {
                from: existing.status || 'pendente',
                to: novoStatus,
                changedAt: new Date().toISOString(),
                changedBy: user.uid
              }
            ]
          : statusHistory;

        await set(agendamentoRef, {
          ...existing,
          ...agendamentoData,
          createdAt: existing.createdAt || editingAgendamento.createdAt || new Date().toISOString(),
          statusHistory: nextStatusHistory
        });
        console.log('✅ [FIREBASE] Agendamento atualizado:', editingAgendamento.id);
        showToast('Agendamento atualizado!', 'success');
      } else {
        // 📅 CRIAR novo agendamento
        const agendamentosRef = ref(database, `users/data/${user.uid}/agendamentos`);
        const newAgendamentoRef = push(agendamentosRef);
        await set(newAgendamentoRef, {
          ...agendamentoData,
          createdAt: new Date().toISOString(),
          statusHistory: [
            {
              from: null,
              to: novoStatus,
              changedAt: new Date().toISOString(),
              changedBy: user.uid
            }
          ]
        });
        console.log('✅ [FIREBASE] Novo agendamento criado:', newAgendamentoRef.key);
        showToast('Agendamento criado!', 'success');
      }
      
      onClose();
    } catch (error) {
      console.error('❌ [FIREBASE] Erro ao salvar agendamento:', error);
      showToast('❌ Erro ao salvar agendamento', 'error');
    }
  };

  // Estilos para ícones brancos nos inputs de data e horário
  const dateTimeStyles = `
    <style>
      /* Chrome, Safari, Edge, Opera */
      input[type="date"]::-webkit-calendar-picker-indicator,
      input[type="time"]::-webkit-calendar-picker-indicator {
        filter: invert(1);
        cursor: pointer;
        opacity: 0.9;
      }
      
      /* Firefox */
      input[type="date"]::-moz-calendar-picker-indicator,
      input[type="time"]::-moz-calendar-picker-indicator {
        filter: invert(1);
        cursor: pointer;
        opacity: 0.9;
      }
      
      /* Hover effect */
      input[type="date"]::-webkit-calendar-picker-indicator:hover,
      input[type="time"]::-webkit-calendar-picker-indicator:hover {
        opacity: 1;
      }
    </style>
  `;

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: dateTimeStyles }} />
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 0.2s ease'
      }}>
      <div style={{
        backgroundColor: '#1a1f36',
        borderRadius: '24px',
        padding: '40px',
        width: '90%',
        maxWidth: '650px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        animation: 'slideUp 0.3s ease'
      }}>
        <div style={{ 
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: '2px solid rgba(16, 185, 129, 0.2)'
        }}>
          <h3 style={{ 
            fontSize: '1.875rem', 
            fontWeight: '700', 
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '2.25rem' }}>
              {editingAgendamento ? '✏️' : '📅'}
            </span>
            {editingAgendamento ? 'Editar Agendamento' : 'Novo Agendamento'}
          </h3>
          <p style={{ fontSize: '0.9375rem', color: '#9ca3af' }}>
            {editingAgendamento ? 'Atualize os dados do agendamento' : 'Preencha os dados para criar um novo agendamento'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '600', 
              marginBottom: '10px', 
              color: '#ffffff',
              fontSize: '0.9375rem'
            }}>
              <span style={{ fontSize: '1.125rem' }}>📝</span>
              Título *
            </label>
            <input
              type="text"
              name="titulo"
              required
              defaultValue={editingAgendamento?.titulo || ''}
              placeholder="Ex: Retirada de produto"
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '2px solid #374151',
                borderRadius: '12px',
                fontSize: '1rem',
                outline: 'none',
                transition: 'all 0.2s ease',
                backgroundColor: '#0f1419',
                color: '#ffffff'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#10b981';
                e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#374151';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
              Tipo *
            </label>
            <select
              name="tipo"
              required
              defaultValue={editingAgendamento?.tipo || ''}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '0.875rem',
                backgroundColor: '#0f1419',
                color: '#ffffff'
              }}
            >
              <option value="">Selecione</option>
              <option value="retirada">📦 Retirada</option>
              <option value="servico">🔧 Serviço</option>
              <option value="visita">🏢 Visita</option>
              <option value="entrega">🚚 Entrega</option>
              <option value="ligacao">📞 Ligação</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                Data *
              </label>
              <input
                type="date"
                name="data"
                required
                defaultValue={editingAgendamento?.data || ''}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  backgroundColor: '#0f1419',
                  color: '#ffffff'
                }}
                className="date-input-white-icon"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                Horário *
              </label>
              <input
                type="time"
                name="horario"
                required
                defaultValue={editingAgendamento?.horario || ''}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  backgroundColor: '#0f1419',
                  color: '#ffffff'
                }}
                className="time-input-white-icon"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
              Cliente *
            </label>
            <input
              type="text"
              name="cliente"
              required
              defaultValue={editingAgendamento?.cliente || ''}
              placeholder="Nome do cliente"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '0.875rem',
                backgroundColor: '#0f1419',
                color: '#ffffff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
              Telefone
            </label>
            <input
              type="tel"
              name="telefone"
              defaultValue={editingAgendamento?.telefone || ''}
              placeholder="(11) 99999-9999"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '0.875rem',
                backgroundColor: '#0f1419',
                color: '#ffffff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
              Descrição
            </label>
            <textarea
              name="descricao"
              rows={3}
              defaultValue={editingAgendamento?.descricao || ''}
              placeholder="Detalhes do agendamento"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '0.875rem',
                resize: 'vertical',
                backgroundColor: '#0f1419',
                color: '#ffffff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
              Observações
            </label>
            <textarea
              name="observacoes"
              rows={2}
              defaultValue={editingAgendamento?.observacoes || ''}
              placeholder="Observações adicionais"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '0.875rem',
                resize: 'vertical',
                backgroundColor: '#0f1419',
                color: '#ffffff'
              }}
            />
          </div>

          {editingAgendamento && (
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                Status
              </label>
              <select
                name="status"
                defaultValue={editingAgendamento?.status || 'pendente'}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  backgroundColor: '#0f1419',
                  color: '#ffffff'
                }}
              >
                <option value="pendente">Pendente</option>
                <option value="confirmado">Confirmado</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          )}

          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            marginTop: '16px',
            paddingTop: '24px',
            borderTop: '2px solid rgba(16, 185, 129, 0.2)'
          }}>
            <button
              type="submit"
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                padding: '14px 24px',
                borderRadius: '12px',
                border: '1px solid #059669',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.3)';
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>
                {editingAgendamento ? '✓' : '📅'}
              </span>
              {editingAgendamento ? 'Atualizar' : 'Criar'} Agendamento
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #374151 0%, #4b5563 100%)',
                color: '#ffffff',
                padding: '14px 24px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #374151 0%, #4b5563 100%)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>✕</span>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};

export default AgendamentoModal;
