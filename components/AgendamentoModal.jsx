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
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937' }}>
          {editingAgendamento ? '✏️ Editar Agendamento' : '📅 Novo Agendamento'}
        </h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
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
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.875rem'
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

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                backgroundColor: '#6366f1',
                color: 'white',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              {editingAgendamento ? 'Atualizar' : 'Criar'} Agendamento
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                backgroundColor: '#e5e7eb',
                color: '#374151',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgendamentoModal;

