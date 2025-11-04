'use client';

import React, { useState } from 'react';
import { 
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  initializeApp,
  getDatabase,
  ref,
  set,
  push
} from 'firebase/database';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User,
  AlertCircle,
  CheckCircle,
  Phone,
  FileText
} from 'lucide-react';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicializar Firebase apenas se as variáveis estiverem disponíveis
let app, db, database;
const APP_ID = process.env.NEXT_PUBLIC_APP_ID || 'whatsapp-sales-agent';

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  database = getDatabase(app);
}

// Componente de Login
export const LoginForm = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, formData.email, formData.password);
      onLoginSuccess();
    } catch (error) {
      console.error('Erro no login:', error);
      switch (error.code) {
        case 'auth/user-not-found':
          setError('Usuário não encontrado. Verifique o email.');
          break;
        case 'auth/wrong-password':
          setError('Senha incorreta.');
          break;
        case 'auth/invalid-email':
          setError('Email inválido.');
          break;
        case 'auth/too-many-requests':
          setError('Muitas tentativas. Tente novamente mais tarde.');
          break;
        default:
          setError('Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError('Digite seu email primeiro.');
      return;
    }

    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, formData.email);
      setError('Email de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (error) {
      setError('Erro ao enviar email de recuperação.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Entrar</h2>
          <p className="text-gray-600">Acesse sua conta do WhatsApp Sales Agent</p>
        </div>

        {error && (
          <div className={`mb-6 p-4 rounded-xl flex items-center space-x-3 ${
            error.includes('enviado') 
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {error.includes('enviado') ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="seu@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Sua senha"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Esqueceu sua senha?
            </button>
            <div className="text-sm text-gray-600">
              Não tem conta?{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Criar conta
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// Componente de Registro
export const RegisterForm = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    cnpj: '',
    whatsappNumber: '',
    userType: 'common'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validatingDocument, setValidatingDocument] = useState(false);
  const [documentValidationError, setDocumentValidationError] = useState('');

  const validateDocument = async (cpfCnpj) => {
    if (!cpfCnpj || cpfCnpj.trim() === '') {
      return { valid: true }; // Não validar se vazio (será validado pelo required)
    }
    
    setValidatingDocument(true);
    setDocumentValidationError('');
    
    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${BACKEND_URL}/api/asaas/validate-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cpfCnpj })
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.valid) {
          return { valid: true };
        } else {
          setDocumentValidationError(data.error || `${data.type} inválido`);
          return { valid: false, error: data.error || `${data.type} inválido` };
        }
      } else {
        // Se não conseguir validar (API não configurada, etc), mostrar aviso mas permitir continuar
        console.warn('Não foi possível validar documento:', data.error);
        // Mesmo assim, tentar validar localmente antes de permitir
        const cleanCpfCnpj = cpfCnpj.replace(/[^\d]/g, '');
        if (cleanCpfCnpj.length === 11 || cleanCpfCnpj.length === 14) {
          // Se tem formato válido, permitir mas avisar
          return { valid: true, warning: 'Não foi possível validar com a API do Asaas. O documento será validado ao criar o primeiro pagamento.' };
        } else {
          setDocumentValidationError('CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos');
          return { valid: false, error: 'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos' };
        }
      }
    } catch (error) {
      console.error('Erro ao validar documento:', error);
      // Se houver erro na validação, validar formato localmente
      const cleanCpfCnpj = cpfCnpj.replace(/[^\d]/g, '');
      if (cleanCpfCnpj.length === 11 || cleanCpfCnpj.length === 14) {
        // Se tem formato válido, permitir mas avisar
        return { valid: true, warning: 'Não foi possível validar com a API do Asaas. O documento será validado ao criar o primeiro pagamento.' };
      } else {
        setDocumentValidationError('CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos');
        return { valid: false, error: 'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos' };
      }
    } finally {
      setValidatingDocument(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setDocumentValidationError('');

    // Validações
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      setLoading(false);
      return;
    }

    // Validar CPF/CNPJ antes de criar a conta - OBRIGATÓRIO
    if (!formData.cnpj || formData.cnpj.trim() === '') {
      setError('CPF/CNPJ é obrigatório.');
      setLoading(false);
      return;
    }

    // Validar formato antes de chamar API
    const cleanCpfCnpj = formData.cnpj.replace(/[^\d]/g, '');
    if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      setError('CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos.');
      setLoading(false);
      return;
    }

    // Validar CPF/CNPJ via API do Asaas
    const validation = await validateDocument(formData.cnpj);
    if (!validation.valid) {
      setError(`CPF/CNPJ inválido: ${validation.error || 'Documento não é válido'}`);
      setLoading(false);
      return;
    }

    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      // Salvar dados no Realtime Database
      if (database) {
        const userId = userCredential.user.uid;
        
        // Salvar em users/registered (nome e email para login)
        const usersRef = ref(database, 'users/registered');
        const newUserRef = push(usersRef);
        const userData = {
          name: formData.name,
          email: formData.email,
          uid: userId,
          isActive: true,
          isMaster: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          registeredVia: 'landing_page'
        };
        await set(newUserRef, userData);
        
        // Salvar em users/data/{userId}/company_profile (dados completos)
        const companyProfileRef = ref(database, `users/data/${userId}/company_profile`);
        await set(companyProfileRef, {
          companyName: formData.companyName,
          cnpj: formData.cnpj,
          whatsappNumber: formData.whatsappNumber,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        
        console.log('✅ Dados salvos no Realtime Database:', { userId, userData });
      }
      
      onRegisterSuccess(userCredential.user);
    } catch (error) {
      console.error('Erro no registro:', error);
      switch (error.code) {
        case 'auth/email-already-in-use':
          setError('Este email já está em uso.');
          break;
        case 'auth/invalid-email':
          setError('Email inválido.');
          break;
        case 'auth/weak-password':
          setError('Senha muito fraca.');
          break;
        default:
          setError('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Criar Conta</h2>
          <p className="text-gray-600">Comece a usar o WhatsApp Sales Agent</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome Completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Seu nome completo"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="seu@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome do Cliente/Razão Social
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Seu nome ou razão social"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CPF/CNPJ
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.cnpj}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, cnpj: value });
                  setDocumentValidationError(''); // Limpar erro ao digitar
                }}
                onBlur={async () => {
                  // Validar apenas quando sair do campo
                  if (formData.cnpj && formData.cnpj.trim() !== '') {
                    const cleanValue = formData.cnpj.replace(/[^\d]/g, '');
                    if (cleanValue.length === 11 || cleanValue.length === 14) {
                      await validateDocument(formData.cnpj);
                    }
                  }
                }}
                className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  documentValidationError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                required
              />
              {validatingDocument && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                </div>
              )}
            </div>
            {documentValidationError && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {documentValidationError}
              </p>
            )}
            {formData.cnpj && !documentValidationError && !validatingDocument && formData.cnpj.replace(/[^\d]/g, '').length >= 11 && (
              <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Documento válido
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número do WhatsApp
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.whatsappNumber}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="+55 11 99999-9999"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Mínimo 6 caracteres"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Confirme sua senha"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>

          <div className="text-center">
            <div className="text-sm text-gray-600">
              Já tem conta?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Fazer login
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// Componente de Logout
export const LogoutButton = ({ onLogout }) => {
  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      onLogout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
    >
      <span>Sair</span>
    </button>
  );
};
