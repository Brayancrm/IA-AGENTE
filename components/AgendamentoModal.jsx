import React from 'react';
import { ref, set, push } from 'firebase/database';

const AgendamentoModal = ({ 
  isOpen, 
  onClose, 
  editingAgendamento, 
  user, 
  database,
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
    const agendamentoData = {
      titulo: formData.get('titulo'),
      descricao: formData.get('descricao'),
      tipo: formData.get('tipo'),
      status: formData.get('status') || 'pendente',
      data: formData.get('data'),
      horario: formData.get('horario'),
      cliente: formData.get('cliente'),
      telefone: formData.get('telefone'),
      observacoes: formData.get('observacoes') || '',
      updatedAt: new Date().toISOString()
    };
    
    try {
      if (editingAgendamento) {
        // ✏️ EDITAR agendamento existente
        const agendamentoRef = ref(database, `users/data/${user.uid}/agendamentos/${editingAgendamento.id}`);
        await set(agendamentoRef, agendamentoData);
        console.log('✅ [FIREBASE] Agendamento atualizado:', editingAgendamento.id);
        showToast('Agendamento atualizado!', 'success');
      } else {
        // 📅 CRIAR novo agendamento
        const agendamentosRef = ref(database, `users/data/${user.uid}/agendamentos`);
        const newAgendamentoRef = push(agendamentosRef);
        await set(newAgendamentoRef, {
          ...agendamentoData,
          createdAt: new Date().toISOString()
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

  return (
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
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '40px',
        width: '90%',
        maxWidth: '650px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        border: '1px solid #e5e7eb',
        animation: 'slideUp 0.3s ease'
      }}>
        <div style={{ 
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: '2px solid #f3f4f6'
        }}>
          <h3 style={{ 
            fontSize: '1.875rem', 
            fontWeight: '700', 
            color: '#111827',
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
          <p style={{ fontSize: '0.9375rem', color: '#6b7280' }}>
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
              color: '#111827',
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
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '1rem',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#6366f1';
                e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
              Tipo *
            </label>
            <select
              name="tipo"
              required
              defaultValue={editingAgendamento?.tipo || ''}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.875rem'
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
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
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
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
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
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
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
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
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
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
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
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.875rem',
                resize: 'vertical'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
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
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.875rem',
                resize: 'vertical'
              }}
            />
          </div>

          {editingAgendamento && (
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
                Status
              </label>
              <select
                name="status"
                defaultValue={editingAgendamento?.status || 'pendente'}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem'
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
            borderTop: '2px solid #f3f4f6'
          }}>
            <button
              type="submit"
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: 'white',
                padding: '14px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 16px rgba(99, 102, 241, 0.3)';
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
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                color: '#374151',
                padding: '14px 24px',
                borderRadius: '12px',
                border: '2px solid #d1d5db',
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
                e.target.style.background = 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)';
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
  );
};

export default AgendamentoModal;

