'use client';

import React, { useState, useEffect } from 'react';

// ─── Win2K UI primitives ────────────────────────────────────────────────────
const win2kColors = {
  desktop: '#008080',
  windowBg: '#d4d0c8',
  titleBarActive: 'linear-gradient(to right, #0a246a, #a6caf0)',
  titleBarInactive: 'linear-gradient(to right, #808080, #b5b5b5)',
  titleText: '#ffffff',
  border: {
    light: '#ffffff',
    lightShadow: '#dfdfdf',
    dark: '#808080',
    darker: '#404040',
  },
  buttonBg: '#d4d0c8',
  inputBg: '#ffffff',
  inputBorder: '#7b7b7b',
  text: '#000000',
  textMuted: '#666666',
  linkBlue: '#0000ee',
  accent: '#0a246a',
  successGreen: '#008000',
  taskbarBg: '#c0c0c0',
  startBtn: 'linear-gradient(to bottom, #3c7fd4, #0a246a)',
};

const raisedBorder = {
  borderTop: `2px solid ${win2kColors.border.light}`,
  borderLeft: `2px solid ${win2kColors.border.light}`,
  borderRight: `2px solid ${win2kColors.border.darker}`,
  borderBottom: `2px solid ${win2kColors.border.darker}`,
};

const sunkenBorder = {
  borderTop: `2px solid ${win2kColors.border.darker}`,
  borderLeft: `2px solid ${win2kColors.border.darker}`,
  borderRight: `2px solid ${win2kColors.border.light}`,
  borderBottom: `2px solid ${win2kColors.border.light}`,
};

const fieldBorder = {
  borderTop: `2px solid ${win2kColors.border.dark}`,
  borderLeft: `2px solid ${win2kColors.border.dark}`,
  borderRight: `2px solid ${win2kColors.border.lightShadow}`,
  borderBottom: `2px solid ${win2kColors.border.lightShadow}`,
};

// Win2K Button component
const Win2kButton = ({ children, onClick, disabled, style = {}, variant = 'normal', type = 'button' }) => {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type={type}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={onClick}
      style={{
        backgroundColor: win2kColors.buttonBg,
        color: disabled ? '#808080' : win2kColors.text,
        fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
        fontSize: '11px',
        padding: '3px 10px',
        cursor: disabled ? 'default' : 'pointer',
        outline: 'none',
        ...(pressed || disabled ? sunkenBorder : raisedBorder),
        minWidth: '75px',
        minHeight: '22px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        userSelect: 'none',
        ...style,
      }}
    >
      {children}
    </button>
  );
};

// Win2K Input component
const Win2kInput = ({ value, onChange, placeholder, type = 'text', style = {} }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    style={{
      backgroundColor: win2kColors.inputBg,
      color: win2kColors.text,
      fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
      fontSize: '11px',
      padding: '2px 4px',
      width: '100%',
      outline: 'none',
      ...fieldBorder,
      ...style,
    }}
  />
);

// Win2K Window chrome
const Win2kWindow = ({ title, children, onClose, onMinimize, style = {}, icon = '🤖', inactive = false }) => (
  <div style={{
    backgroundColor: win2kColors.windowBg,
    ...raisedBorder,
    display: 'flex',
    flexDirection: 'column',
    ...style,
  }}>
    {/* Title bar */}
    <div style={{
      background: inactive ? win2kColors.titleBarInactive : win2kColors.titleBarActive,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '2px 4px',
      height: '24px',
      userSelect: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>
        <span style={{
          color: '#ffffff',
          fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
          fontSize: '11px',
          fontWeight: 'bold',
        }}>{title}</span>
      </div>
      <div style={{ display: 'flex', gap: '2px' }}>
        {onMinimize && (
          <button onClick={onMinimize} style={{
            ...raisedBorder,
            backgroundColor: win2kColors.buttonBg,
            width: '16px',
            height: '14px',
            fontSize: '9px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            fontFamily: 'Arial',
            color: '#000',
            border: 'none',
            borderTop: `2px solid ${win2kColors.border.light}`,
            borderLeft: `2px solid ${win2kColors.border.light}`,
            borderRight: `2px solid ${win2kColors.border.darker}`,
            borderBottom: `2px solid ${win2kColors.border.darker}`,
          }}>_</button>
        )}
        {onClose && (
          <button onClick={onClose} style={{
            ...raisedBorder,
            backgroundColor: win2kColors.buttonBg,
            width: '16px',
            height: '14px',
            fontSize: '9px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            color: '#000',
            border: 'none',
            borderTop: `2px solid ${win2kColors.border.light}`,
            borderLeft: `2px solid ${win2kColors.border.light}`,
            borderRight: `2px solid ${win2kColors.border.darker}`,
            borderBottom: `2px solid ${win2kColors.border.darker}`,
          }}>✕</button>
        )}
      </div>
    </div>
    {/* Menu bar */}
    <div style={{
      borderBottom: `1px solid ${win2kColors.border.dark}`,
      padding: '1px 4px',
      display: 'flex',
      gap: '0px',
      backgroundColor: win2kColors.windowBg,
    }}>
      {['Arquivo', 'Editar', 'Exibir', 'Ajuda'].map((item) => (
        <span key={item} style={{
          fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
          fontSize: '11px',
          padding: '1px 6px',
          cursor: 'default',
          color: win2kColors.text,
        }}>{item}</span>
      ))}
    </div>
    {/* Content */}
    <div style={{ flex: 1, overflow: 'auto' }}>
      {children}
    </div>
  </div>
);

// Win2K Dialog (modal)
const Win2kDialog = ({ title, children, onClose, icon = '❓', style = {} }) => (
  <div style={{
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  }}>
    <div style={{
      backgroundColor: win2kColors.windowBg,
      ...raisedBorder,
      minWidth: '320px',
      maxWidth: '480px',
      width: '100%',
      ...style,
    }}>
      {/* Title bar */}
      <div style={{
        background: win2kColors.titleBarActive,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px 4px',
        height: '24px',
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>
          <span style={{
            color: '#fff',
            fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
            fontSize: '11px',
            fontWeight: 'bold',
          }}>{title}</span>
        </div>
        <button onClick={onClose} style={{
          backgroundColor: win2kColors.buttonBg,
          width: '16px',
          height: '14px',
          fontSize: '9px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          color: '#000',
          borderTop: `2px solid ${win2kColors.border.light}`,
          borderLeft: `2px solid ${win2kColors.border.light}`,
          borderRight: `2px solid ${win2kColors.border.darker}`,
          borderBottom: `2px solid ${win2kColors.border.darker}`,
        }}>✕</button>
      </div>
      <div style={{ padding: '16px' }}>
        {children}
      </div>
    </div>
  </div>
);

// ─── Tab component ────────────────────────────────────────────────────────
const Win2kTab = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
      fontSize: '11px',
      padding: '3px 10px',
      backgroundColor: active ? win2kColors.windowBg : '#b0ae9f',
      color: win2kColors.text,
      cursor: 'pointer',
      marginRight: '2px',
      marginBottom: active ? '-1px' : '0',
      position: 'relative',
      zIndex: active ? 2 : 1,
      borderTop: `2px solid ${active ? win2kColors.border.light : win2kColors.border.dark}`,
      borderLeft: `2px solid ${active ? win2kColors.border.light : win2kColors.border.dark}`,
      borderRight: `2px solid ${active ? win2kColors.border.darker : win2kColors.border.light}`,
      borderBottom: active ? 'none' : `2px solid ${win2kColors.border.darker}`,
      outline: 'none',
    }}
  >
    {label}
  </button>
);

// ─── Separator ────────────────────────────────────────────────────────────
const Win2kSeparator = ({ style = {} }) => (
  <div style={{
    borderTop: `1px solid ${win2kColors.border.dark}`,
    borderBottom: `1px solid ${win2kColors.border.light}`,
    margin: '4px 0',
    ...style,
  }} />
);

// ─── Feature list item ────────────────────────────────────────────────────
const FeatureItem = ({ icon, text }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '6px' }}>
    <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
    <span style={{
      fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
      fontSize: '11px',
      color: win2kColors.text,
    }}>{text}</span>
  </div>
);

// ─── Desktop icon ─────────────────────────────────────────────────────────
const DesktopIcon = ({ icon, label, onClick }) => {
  const [selected, setSelected] = useState(false);
  return (
    <div
      onClick={() => { setSelected(true); if (onClick) onClick(); setTimeout(() => setSelected(false), 200); }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '70px',
        cursor: 'pointer',
        padding: '4px',
      }}
    >
      <div style={{
        fontSize: '32px',
        marginBottom: '2px',
        background: selected ? 'rgba(10,36,106,0.4)' : 'transparent',
        padding: '2px',
        outline: selected ? '1px dotted #fff' : 'none',
      }}>{icon}</div>
      <span style={{
        fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
        fontSize: '11px',
        color: '#fff',
        textShadow: '1px 1px 2px #000000',
        textAlign: 'center',
        background: selected ? '#0a246a' : 'transparent',
        padding: '1px 2px',
        maxWidth: '68px',
        wordBreak: 'break-word',
      }}>{label}</span>
    </div>
  );
};

// ─── Taskbar clock ────────────────────────────────────────────────────────
const TaskbarClock = () => {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      setTime(`${h}:${m}`);
    };
    update();
    const t = setInterval(update, 10000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      ...fieldBorder,
      padding: '2px 8px',
      fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
      fontSize: '11px',
      color: win2kColors.text,
      backgroundColor: win2kColors.taskbarBg,
      minWidth: '50px',
      textAlign: 'center',
    }}>{time}</div>
  );
};

// ─── Main Win2kLanding component ──────────────────────────────────────────
const Win2kLanding = ({ onLoginSuccess }) => {
  const [activeWindow, setActiveWindow] = useState('welcome');
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showForgotDialog, setShowForgotDialog] = useState(false);
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', companyName: '', cnpj: '', whatsappNumber: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('features');
  const [minimizedWindows, setMinimizedWindows] = useState([]);
  const [welcomeMinimized, setWelcomeMinimized] = useState(false);

  // Import Firebase dynamically to avoid SSR issues
  const [firebase, setFirebase] = useState(null);
  useEffect(() => {
    const initFirebase = async () => {
      try {
        const { initializeApp } = await import('firebase/app');
        const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } = await import('firebase/auth');
        const { getDatabase, ref, push, set } = await import('firebase/database');
        const config = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
          databaseURL: 'https://ia-agente-b2f46.firebaseio.com',
        };
        let app;
        try {
          const { getApps, getApp } = await import('firebase/app');
          app = getApps().length > 0 ? getApp() : initializeApp(config);
        } catch {
          app = initializeApp(config);
        }
        setFirebase({
          auth: getAuth(app),
          database: getDatabase(app),
          signInWithEmailAndPassword,
          createUserWithEmailAndPassword,
          sendPasswordResetEmail,
          ref, push, set,
        });
      } catch (e) {
        console.error('Firebase init error', e);
      }
    };
    if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) initFirebase();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!firebase) { setError('Sistema não disponível.'); return; }
    setLoading(true);
    setError('');
    try {
      await firebase.signInWithEmailAndPassword(firebase.auth, loginForm.email, loginForm.password);
      setShowLoginDialog(false);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-credential': 'Credenciais inválidas.',
        'auth/invalid-email': 'Email inválido.',
      };
      setError(msgs[err.code] || `Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!firebase) { setError('Sistema não disponível.'); return; }
    if (!registerForm.cnpj.trim()) { setError('CPF/CNPJ é obrigatório.'); return; }
    setLoading(true);
    setError('');
    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const res = await fetch(`${BACKEND_URL}/api/stripe/create-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerForm.companyName || registerForm.email,
          email: registerForm.email,
          cpfCnpj: registerForm.cnpj,
          phone: registerForm.whatsappNumber,
        }),
      });
      const data = await res.json();
      if (!data.success || !data.valid) {
        setError(`CPF/CNPJ inválido: ${data.error || 'Documento não válido.'}`);
        setLoading(false);
        return;
      }
      const cred = await firebase.createUserWithEmailAndPassword(firebase.auth, registerForm.email, registerForm.password);
      if (firebase.database) {
        const uid = cred.user.uid;
        const newRef = firebase.push(firebase.ref(firebase.database, 'users/registered'));
        await firebase.set(newRef, {
          name: registerForm.companyName || registerForm.email,
          email: registerForm.email,
          uid,
          isActive: true,
          isMaster: false,
          createdAt: new Date().toISOString(),
          registeredVia: 'win2k_landing',
        });
        await firebase.set(firebase.ref(firebase.database, `users/data/${uid}/company_profile`), {
          companyName: registerForm.companyName,
          cnpj: registerForm.cnpj,
          whatsappNumber: registerForm.whatsappNumber,
          stripeCustomerId: data.customerId,
          createdAt: new Date().toISOString(),
        });
      }
      setShowRegisterDialog(false);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'Email já cadastrado. Faça login.',
        'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres).',
        'auth/invalid-email': 'Email inválido.',
      };
      setError(msgs[err.code] || `Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!firebase) { setError('Sistema não disponível.'); return; }
    setLoading(true);
    setError('');
    try {
      await firebase.sendPasswordResetEmail(firebase.auth, forgotEmail);
      setError('');
      setShowForgotDialog(false);
      setShowLoginDialog(true);
    } catch (err) {
      setError('Erro ao enviar email de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  const openLoginDialog = () => { setError(''); setShowLoginDialog(true); setShowStartMenu(false); };
  const openRegisterDialog = () => { setError(''); setShowRegisterDialog(true); setShowStartMenu(false); };

  return (
    <div
      onClick={() => setShowStartMenu(false)}
      style={{
        minHeight: '100vh',
        backgroundColor: win2kColors.desktop,
        backgroundImage: `
          radial-gradient(ellipse at 30% 20%, rgba(0,120,120,0.6) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 80%, rgba(0,100,100,0.5) 0%, transparent 50%)
        `,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Desktop icons (left column) */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 10,
      }}>
        <DesktopIcon icon="🤖" label="dadosIA" onClick={() => setWelcomeMinimized(false)} />
        <DesktopIcon icon="📱" label="WhatsApp" onClick={openLoginDialog} />
        <DesktopIcon icon="💼" label="Planos" onClick={() => setActiveTab('plans')} />
        <DesktopIcon icon="📊" label="Dashboard" onClick={openLoginDialog} />
        <DesktopIcon icon="🗑️" label="Lixeira" onClick={() => {}} />
      </div>

      {/* Main desktop content */}
      <div style={{
        flex: 1,
        padding: '16px 16px 44px 100px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto',
      }}>

        {/* Welcome / Main window */}
        {!welcomeMinimized && (
          <Win2kWindow
            title="dadosIA — Assistente de Vendas WhatsApp"
            icon="🤖"
            onClose={() => setWelcomeMinimized(true)}
            onMinimize={() => setWelcomeMinimized(true)}
            style={{ width: '100%', maxWidth: '860px', alignSelf: 'flex-start', marginTop: '8px' }}
          >
            {/* Toolbar */}
            <div style={{
              backgroundColor: win2kColors.windowBg,
              borderBottom: `1px solid ${win2kColors.border.dark}`,
              padding: '3px 4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <Win2kButton onClick={openLoginDialog}>
                🔑 Entrar
              </Win2kButton>
              <Win2kButton onClick={openRegisterDialog}>
                📝 Cadastrar
              </Win2kButton>
              <div style={{
                width: '1px',
                height: '20px',
                borderLeft: `1px solid ${win2kColors.border.dark}`,
                borderRight: `1px solid ${win2kColors.border.light}`,
                margin: '0 2px',
              }} />
              <Win2kButton onClick={() => setShowAboutDialog(true)}>
                ❓ Sobre
              </Win2kButton>
            </div>

            {/* Body */}
            <div style={{ padding: '12px 16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {/* Left: hero info */}
              <div style={{ flex: '1 1 300px' }}>
                {/* "Splash" box */}
                <div style={{
                  ...fieldBorder,
                  backgroundColor: '#ffffff',
                  padding: '16px',
                  marginBottom: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>🤖</div>
                  <div style={{
                    fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: win2kColors.accent,
                    marginBottom: '4px',
                  }}>dadosIA</div>
                  <div style={{
                    fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                    fontSize: '11px',
                    color: win2kColors.textMuted,
                    marginBottom: '12px',
                  }}>Versão 2.0 para Windows</div>
                  <Win2kSeparator />
                  <p style={{
                    fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                    fontSize: '11px',
                    color: win2kColors.text,
                    margin: '8px 0',
                    lineHeight: '1.5',
                    textAlign: 'left',
                  }}>
                    Bem-vindo ao <strong>dadosIA</strong> — a plataforma de automação de vendas e suporte
                    via WhatsApp com inteligência artificial. Configure seu assistente virtual em minutos.
                  </p>
                  <Win2kSeparator />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
                    <Win2kButton
                      onClick={openLoginDialog}
                      style={{ minWidth: '100px', fontWeight: 'bold', fontSize: '12px' }}
                    >
                      🔑 Entrar
                    </Win2kButton>
                    <Win2kButton
                      onClick={openRegisterDialog}
                      style={{ minWidth: '100px', fontSize: '12px' }}
                    >
                      📝 Cadastrar
                    </Win2kButton>
                  </div>
                </div>

                {/* Stats box */}
                <div style={{
                  ...raisedBorder,
                  backgroundColor: win2kColors.windowBg,
                  padding: '8px',
                }}>
                  <div style={{
                    fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: win2kColors.accent,
                    marginBottom: '6px',
                    borderBottom: `1px solid ${win2kColors.border.dark}`,
                    paddingBottom: '4px',
                  }}>📈 Estatísticas do Sistema</div>
                  {[
                    ['Empresas Ativas', '+500'],
                    ['Mensagens/Mês', '+1M'],
                    ['Uptime', '99.9%'],
                    ['Suporte', '24/7'],
                  ].map(([label, val]) => (
                    <div key={label} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '2px 0',
                      fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                      fontSize: '11px',
                    }}>
                      <span style={{ color: win2kColors.textMuted }}>{label}:</span>
                      <span style={{ color: win2kColors.successGreen, fontWeight: 'bold' }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: tabbed panel */}
              <div style={{ flex: '2 1 400px' }}>
                {/* Tab strip */}
                <div style={{
                  display: 'flex',
                  borderBottom: `1px solid ${win2kColors.border.dark}`,
                  marginBottom: '-1px',
                }}>
                  {[
                    { id: 'features', label: '⚙️ Funcionalidades' },
                    { id: 'howto', label: '📖 Como Usar' },
                    { id: 'plans', label: '💰 Planos' },
                  ].map((tab) => (
                    <Win2kTab
                      key={tab.id}
                      label={tab.label}
                      active={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                    />
                  ))}
                </div>

                {/* Tab content */}
                <div style={{
                  ...raisedBorder,
                  backgroundColor: win2kColors.windowBg,
                  padding: '12px',
                  minHeight: '280px',
                }}>
                  {activeTab === 'features' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                      <FeatureItem icon="🤖" text="Assistente IA para WhatsApp" />
                      <FeatureItem icon="📦" text="Catálogo de Produtos" />
                      <FeatureItem icon="💬" text="Conversas em Tempo Real" />
                      <FeatureItem icon="📅" text="Agendamentos Inteligentes" />
                      <FeatureItem icon="📊" text="Dashboard de Vendas" />
                      <FeatureItem icon="🎯" text="CRM Integrado" />
                      <FeatureItem icon="🔄" text="Fluxos Automatizados" />
                      <FeatureItem icon="📧" text="Email Marketing" />
                      <FeatureItem icon="🔐" text="Autenticação Segura" />
                      <FeatureItem icon="📱" text="Interface Responsiva" />
                      <FeatureItem icon="🌐" text="Multi-idioma" />
                      <FeatureItem icon="☁️" text="Cloud Sync (Firebase)" />
                    </div>
                  )}
                  {activeTab === 'howto' && (
                    <div>
                      {[
                        { n: '1', title: 'Crie sua Conta', desc: 'Clique em "Cadastrar" e preencha seus dados de empresa. O sistema validará seu CPF/CNPJ automaticamente.' },
                        { n: '2', title: 'Configure o Assistente', desc: 'No painel, acesse "Configurações do Assistente" e defina nome, personalidade e respostas automáticas.' },
                        { n: '3', title: 'Conecte o WhatsApp', desc: 'Escaneie o QR Code na seção de Integrações para conectar seu número de WhatsApp Business.' },
                        { n: '4', title: 'Gerencie seus Clientes', desc: 'Use o CRM e Dashboard para acompanhar conversas, pedidos e agendamentos em tempo real.' },
                      ].map((step) => (
                        <div key={step.n} style={{
                          ...fieldBorder,
                          backgroundColor: '#f0f0f0',
                          padding: '8px',
                          marginBottom: '8px',
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'flex-start',
                        }}>
                          <div style={{
                            ...raisedBorder,
                            backgroundColor: win2kColors.accent,
                            color: '#fff',
                            fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            width: '22px',
                            height: '22px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>{step.n}</div>
                          <div>
                            <div style={{
                              fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              marginBottom: '2px',
                              color: win2kColors.accent,
                            }}>{step.title}</div>
                            <div style={{
                              fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                              fontSize: '11px',
                              color: win2kColors.text,
                              lineHeight: '1.4',
                            }}>{step.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab === 'plans' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '8px' }}>
                      {[
                        { name: 'Starter', price: 'Grátis', period: '7 dias trial', features: ['100 msgs/mês', '1 número', 'Dashboard básico', 'Suporte email'], highlight: false },
                        { name: 'Pro', price: 'R$ 97', period: '/mês', features: ['5.000 msgs/mês', '3 números', 'CRM completo', 'Suporte prioritário'], highlight: true },
                        { name: 'Enterprise', price: 'R$ 297', period: '/mês', features: ['Ilimitado', '10 números', 'API acesso', 'Suporte dedicado'], highlight: false },
                      ].map((plan) => (
                        <div key={plan.name} style={{
                          ...(plan.highlight ? sunkenBorder : raisedBorder),
                          backgroundColor: plan.highlight ? '#e8f4fd' : win2kColors.windowBg,
                          padding: '10px',
                          position: 'relative',
                        }}>
                          {plan.highlight && (
                            <div style={{
                              position: 'absolute',
                              top: '-1px',
                              right: '4px',
                              backgroundColor: win2kColors.accent,
                              color: '#fff',
                              fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                              fontSize: '9px',
                              padding: '1px 4px',
                              fontWeight: 'bold',
                            }}>★ POPULAR</div>
                          )}
                          <div style={{
                            fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: win2kColors.accent,
                            marginBottom: '4px',
                          }}>{plan.name}</div>
                          <div style={{
                            fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: win2kColors.text,
                          }}>{plan.price}</div>
                          <div style={{
                            fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                            fontSize: '10px',
                            color: win2kColors.textMuted,
                            marginBottom: '8px',
                          }}>{plan.period}</div>
                          <Win2kSeparator />
                          {plan.features.map((f) => (
                            <div key={f} style={{
                              fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                              fontSize: '10px',
                              color: win2kColors.text,
                              marginTop: '3px',
                              display: 'flex',
                              gap: '4px',
                              alignItems: 'flex-start',
                            }}>
                              <span style={{ color: win2kColors.successGreen, fontWeight: 'bold', flexShrink: 0 }}>✓</span>
                              {f}
                            </div>
                          ))}
                          <div style={{ marginTop: '8px' }}>
                            <Win2kButton
                              onClick={openRegisterDialog}
                              style={{ width: '100%', fontSize: '10px', padding: '2px 6px' }}
                            >
                              Selecionar
                            </Win2kButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status bar */}
            <div style={{
              borderTop: `1px solid ${win2kColors.border.dark}`,
              padding: '2px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: win2kColors.windowBg,
            }}>
              <div style={{
                ...fieldBorder,
                padding: '1px 6px',
                fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                fontSize: '11px',
                color: win2kColors.textMuted,
                flex: 1,
              }}>
                🟢 Sistema Online — dadosIA v2.0 — Pronto
              </div>
              <div style={{
                ...fieldBorder,
                padding: '1px 6px',
                fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                fontSize: '11px',
                color: win2kColors.textMuted,
              }}>
                3 objetos
              </div>
            </div>
          </Win2kWindow>
        )}

        {/* Second decorative window (browser-like) */}
        <Win2kWindow
          title="Internet Explorer — dadosIA.com.br"
          icon="🌐"
          onClose={() => {}}
          onMinimize={() => {}}
          inactive={true}
          style={{ width: '100%', maxWidth: '540px', alignSelf: 'flex-end', marginTop: '0' }}
        >
          {/* Address bar */}
          <div style={{
            padding: '3px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            borderBottom: `1px solid ${win2kColors.border.dark}`,
          }}>
            <span style={{ fontSize: '11px', fontFamily: '"MS Sans Serif", Tahoma, sans-serif', color: win2kColors.text }}>
              Endereço:
            </span>
            <div style={{
              ...fieldBorder,
              backgroundColor: '#fff',
              flex: 1,
              padding: '1px 4px',
              fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
              fontSize: '11px',
              color: win2kColors.linkBlue,
            }}>
              https://dadosia.com.br/plataforma
            </div>
            <Win2kButton style={{ minWidth: 40 }}>Ir</Win2kButton>
          </div>
          <div style={{ padding: '12px 16px', backgroundColor: '#fff' }}>
            <div style={{
              fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
              fontSize: '13px',
              fontWeight: 'bold',
              color: win2kColors.accent,
              borderBottom: `2px solid ${win2kColors.accent}`,
              marginBottom: '8px',
              paddingBottom: '4px',
            }}>
              🤖 dadosIA — Agente de Vendas Inteligente
            </div>
            <p style={{
              fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
              fontSize: '11px',
              color: win2kColors.text,
              margin: '0 0 10px',
              lineHeight: '1.5',
            }}>
              Automatize seu atendimento via WhatsApp com IA avançada.
              Aumente suas vendas, organize seu catálogo e gerencie clientes
              tudo em um único painel de controle.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['🤖 IA', '📱 WhatsApp', '📊 CRM', '🔄 Automação'].map((tag) => (
                <span key={tag} style={{
                  ...raisedBorder,
                  backgroundColor: win2kColors.windowBg,
                  fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                  fontSize: '10px',
                  padding: '2px 6px',
                  color: win2kColors.text,
                }}>{tag}</span>
              ))}
            </div>
            <Win2kSeparator style={{ margin: '10px 0' }} />
            <div style={{ textAlign: 'center' }}>
              <Win2kButton
                onClick={openLoginDialog}
                style={{
                  minWidth: '140px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  padding: '4px 16px',
                  backgroundColor: '#e8f4fd',
                }}
              >
                🚀 Começar Agora — É Grátis!
              </Win2kButton>
            </div>
          </div>
          {/* IE status bar */}
          <div style={{
            borderTop: `1px solid ${win2kColors.border.dark}`,
            padding: '1px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: win2kColors.windowBg,
          }}>
            <div style={{
              ...fieldBorder,
              padding: '1px 6px',
              fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
              fontSize: '11px',
              flex: 1,
              color: win2kColors.textMuted,
            }}>Concluído</div>
            <div style={{
              ...fieldBorder,
              padding: '1px 6px',
              fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
              fontSize: '11px',
              color: win2kColors.textMuted,
            }}>Internet</div>
          </div>
        </Win2kWindow>
      </div>

      {/* Taskbar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '32px',
          backgroundColor: win2kColors.taskbarBg,
          borderTop: `2px solid ${win2kColors.border.light}`,
          display: 'flex',
          alignItems: 'center',
          padding: '2px 4px',
          gap: '4px',
          zIndex: 100,
          userSelect: 'none',
        }}
      >
        {/* Start button */}
        <button
          onClick={() => setShowStartMenu(!showStartMenu)}
          style={{
            background: win2kColors.startBtn,
            color: '#fff',
            fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
            fontSize: '11px',
            fontWeight: 'bold',
            padding: '2px 8px 2px 4px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            borderTop: `2px solid ${win2kColors.border.light}`,
            borderLeft: `2px solid ${win2kColors.border.light}`,
            borderRight: `2px solid ${win2kColors.border.darker}`,
            borderBottom: `2px solid ${win2kColors.border.darker}`,
          }}
        >
          <span style={{ fontSize: '14px' }}>🪟</span>
          Iniciar
        </button>

        {/* Quick launch separator */}
        <div style={{
          width: '1px',
          height: '24px',
          borderLeft: `1px solid ${win2kColors.border.dark}`,
          borderRight: `1px solid ${win2kColors.border.light}`,
          margin: '0 2px',
        }} />

        {/* Quick launch icons */}
        {[
          { icon: '🤖', label: 'dadosIA', action: () => setWelcomeMinimized(false) },
          { icon: '📱', label: 'WhatsApp', action: openLoginDialog },
        ].map((item) => (
          <button
            key={item.label}
            title={item.label}
            onClick={item.action}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              fontSize: '16px',
              height: '26px',
              display: 'flex',
              alignItems: 'center',
            }}
          >{item.icon}</button>
        ))}

        <div style={{
          width: '1px',
          height: '24px',
          borderLeft: `1px solid ${win2kColors.border.dark}`,
          borderRight: `1px solid ${win2kColors.border.light}`,
          margin: '0 2px',
        }} />

        {/* Open windows in taskbar */}
        {!welcomeMinimized && (
          <button
            onClick={() => setWelcomeMinimized(false)}
            style={{
              ...sunkenBorder,
              backgroundColor: '#bab8b0',
              fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
              fontSize: '11px',
              padding: '2px 8px',
              height: '24px',
              cursor: 'pointer',
              maxWidth: '160px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>🤖</span>
            dadosIA
          </button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* System tray */}
        <div style={{
          ...fieldBorder,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 6px',
          backgroundColor: win2kColors.taskbarBg,
        }}>
          <span style={{ fontSize: '14px' }}>🔊</span>
          <span style={{ fontSize: '14px' }}>🌐</span>
          <TaskbarClock />
        </div>
      </div>

      {/* Start Menu */}
      {showStartMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            bottom: '32px',
            left: 0,
            width: '200px',
            backgroundColor: win2kColors.windowBg,
            ...raisedBorder,
            zIndex: 200,
            display: 'flex',
          }}
        >
          {/* Left banner */}
          <div style={{
            width: '24px',
            background: 'linear-gradient(to top, #0a246a, #1e6fbf)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: '6px',
          }}>
            <span style={{
              color: '#fff',
              fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
              fontSize: '11px',
              fontWeight: 'bold',
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              letterSpacing: '1px',
              textShadow: '0 0 4px rgba(0,0,0,0.5)',
            }}>dadosIA 2000</span>
          </div>
          {/* Menu items */}
          <div style={{ flex: 1 }}>
            {[
              { icon: '🔑', label: 'Entrar', action: openLoginDialog },
              { icon: '📝', label: 'Cadastrar', action: openRegisterDialog },
              { icon: '🤖', label: 'dadosIA', action: () => { setWelcomeMinimized(false); setShowStartMenu(false); } },
              { icon: '❓', label: 'Sobre', action: () => { setShowAboutDialog(true); setShowStartMenu(false); } },
              null, // separator
              { icon: '🚪', label: 'Sair', action: () => setShowStartMenu(false) },
            ].map((item, i) =>
              item === null ? (
                <Win2kSeparator key={i} style={{ margin: '2px 4px' }} />
              ) : (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '4px 8px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                    fontSize: '11px',
                    color: win2kColors.text,
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#0a246a';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = win2kColors.text;
                  }}
                >
                  <span style={{ fontSize: '14px' }}>{item.icon}</span>
                  {item.label}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* ─── Login Dialog ─── */}
      {showLoginDialog && (
        <Win2kDialog
          title="Entrar no dadosIA"
          icon="🔑"
          onClose={() => { setShowLoginDialog(false); setError(''); }}
          style={{ maxWidth: '340px' }}
        >
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <span style={{ fontSize: '32px', flexShrink: 0 }}>🔑</span>
            <p style={{
              fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
              fontSize: '11px',
              color: win2kColors.text,
              margin: 0,
              lineHeight: '1.5',
            }}>
              Insira suas credenciais para acessar o painel dadosIA.
            </p>
          </div>
          <Win2kSeparator />
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '8px' }}>
              <label style={{
                display: 'block',
                fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                fontSize: '11px',
                color: win2kColors.text,
                marginBottom: '2px',
              }}>Nome do usuário (email):</label>
              <Win2kInput
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                placeholder="seu@email.com"
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'block',
                fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
                fontSize: '11px',
                color: win2kColors.text,
                marginBottom: '2px',
              }}>Senha:</label>
              <Win2kInput
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div style={{
                ...fieldBorder,
                backgroundColor: '#fff0f0',
                padding: '4px 8px',
                marginBottom: '8px',
                display: 'flex',
                gap: '6px',
                alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
                <span style={{
                  fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                  fontSize: '11px',
                  color: '#cc0000',
                }}>{error}</span>
              </div>
            )}
            <Win2kSeparator />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '8px' }}>
              <Win2kButton type="submit" disabled={loading}>
                {loading ? '⏳ Aguarde...' : '🔑 OK'}
              </Win2kButton>
              <Win2kButton type="button" onClick={() => { setShowLoginDialog(false); setError(''); }}>
                Cancelar
              </Win2kButton>
              <Win2kButton
                type="button"
                onClick={() => {
                  setShowLoginDialog(false);
                  setShowForgotDialog(true);
                  setError('');
                }}
              >
                Ajuda
              </Win2kButton>
            </div>
          </form>
          <div style={{ marginTop: '8px', textAlign: 'center' }}>
            <span
              onClick={() => { setShowLoginDialog(false); setShowRegisterDialog(true); setError(''); }}
              style={{
                fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                fontSize: '11px',
                color: win2kColors.linkBlue,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Não tem conta? Cadastre-se aqui
            </span>
          </div>
        </Win2kDialog>
      )}

      {/* ─── Register Dialog ─── */}
      {showRegisterDialog && (
        <Win2kDialog
          title="Assistente de Configuração do dadosIA"
          icon="📝"
          onClose={() => { setShowRegisterDialog(false); setError(''); }}
          style={{ maxWidth: '400px' }}
        >
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '32px', flexShrink: 0 }}>📝</span>
            <p style={{
              fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif',
              fontSize: '11px',
              color: win2kColors.text,
              margin: 0,
              lineHeight: '1.5',
            }}>
              Este assistente vai ajudá-lo a configurar o dadosIA. Preencha
              as informações abaixo para criar sua conta.
            </p>
          </div>
          <Win2kSeparator />
          <form onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                  fontSize: '11px',
                  color: win2kColors.text,
                  marginBottom: '2px',
                }}>Nome da Empresa:</label>
                <Win2kInput
                  value={registerForm.companyName}
                  onChange={(e) => setRegisterForm({ ...registerForm, companyName: e.target.value })}
                  placeholder="Minha Empresa Ltda"
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                  fontSize: '11px',
                  color: win2kColors.text,
                  marginBottom: '2px',
                }}>CPF / CNPJ: *</label>
                <Win2kInput
                  value={registerForm.cnpj}
                  onChange={(e) => setRegisterForm({ ...registerForm, cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                  fontSize: '11px',
                  color: win2kColors.text,
                  marginBottom: '2px',
                }}>Email: *</label>
                <Win2kInput
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                  fontSize: '11px',
                  color: win2kColors.text,
                  marginBottom: '2px',
                }}>WhatsApp:</label>
                <Win2kInput
                  value={registerForm.whatsappNumber}
                  onChange={(e) => setRegisterForm({ ...registerForm, whatsappNumber: e.target.value })}
                  placeholder="+55 11 99999-9999"
                />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'block',
                fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                fontSize: '11px',
                color: win2kColors.text,
                marginBottom: '2px',
              }}>Senha: *</label>
              <Win2kInput
                type="password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            {error && (
              <div style={{
                ...fieldBorder,
                backgroundColor: '#fff0f0',
                padding: '4px 8px',
                marginBottom: '8px',
                display: 'flex',
                gap: '6px',
                alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
                <span style={{
                  fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                  fontSize: '11px',
                  color: '#cc0000',
                }}>{error}</span>
              </div>
            )}
            <Win2kSeparator />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '8px' }}>
              <Win2kButton type="submit" disabled={loading} style={{ minWidth: '100px' }}>
                {loading ? '⏳ Processando...' : '▶ Concluir'}
              </Win2kButton>
              <Win2kButton type="button" onClick={() => { setShowRegisterDialog(false); setError(''); }}>
                Cancelar
              </Win2kButton>
            </div>
          </form>
          <div style={{ marginTop: '8px', textAlign: 'center' }}>
            <span
              onClick={() => { setShowRegisterDialog(false); setShowLoginDialog(true); setError(''); }}
              style={{
                fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                fontSize: '11px',
                color: win2kColors.linkBlue,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Já tem conta? Entrar
            </span>
          </div>
        </Win2kDialog>
      )}

      {/* ─── Forgot Password Dialog ─── */}
      {showForgotDialog && (
        <Win2kDialog
          title="Recuperar Senha"
          icon="🔒"
          onClose={() => { setShowForgotDialog(false); setError(''); }}
          style={{ maxWidth: '340px' }}
        >
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '32px', flexShrink: 0 }}>🔒</span>
            <p style={{
              fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
              fontSize: '11px',
              color: win2kColors.text,
              margin: 0,
              lineHeight: '1.5',
            }}>
              Digite seu endereço de email para receber as instruções de recuperação de senha.
            </p>
          </div>
          <Win2kSeparator />
          <form onSubmit={handleForgotPassword}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'block',
                fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                fontSize: '11px',
                marginBottom: '2px',
              }}>Endereço de Email:</label>
              <Win2kInput
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            {error && (
              <div style={{
                ...fieldBorder,
                backgroundColor: '#fff0f0',
                padding: '4px 8px',
                marginBottom: '8px',
              }}>
                <span style={{ fontSize: '11px', color: '#cc0000', fontFamily: '"MS Sans Serif", Tahoma, sans-serif' }}>{error}</span>
              </div>
            )}
            <Win2kSeparator />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '8px' }}>
              <Win2kButton type="submit" disabled={loading}>
                {loading ? '⏳...' : '📧 Enviar'}
              </Win2kButton>
              <Win2kButton type="button" onClick={() => { setShowForgotDialog(false); setShowLoginDialog(true); setError(''); }}>
                Cancelar
              </Win2kButton>
            </div>
          </form>
        </Win2kDialog>
      )}

      {/* ─── About Dialog ─── */}
      {showAboutDialog && (
        <Win2kDialog
          title="Sobre o dadosIA"
          icon="ℹ️"
          onClose={() => setShowAboutDialog(false)}
          style={{ maxWidth: '340px' }}
        >
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '48px', flexShrink: 0 }}>🤖</span>
            <div>
              <div style={{
                fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                fontSize: '14px',
                fontWeight: 'bold',
                color: win2kColors.accent,
                marginBottom: '4px',
              }}>dadosIA</div>
              <div style={{
                fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                fontSize: '11px',
                color: win2kColors.text,
                marginBottom: '2px',
              }}>Versão 2.0.0 (Build 2000)</div>
              <div style={{
                fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                fontSize: '11px',
                color: win2kColors.textMuted,
                marginBottom: '8px',
              }}>© 2024 dadosIA. Todos os direitos reservados.</div>
              <div style={{
                fontFamily: '"MS Sans Serif", Tahoma, sans-serif',
                fontSize: '11px',
                color: win2kColors.text,
                lineHeight: '1.5',
              }}>
                Plataforma de automação de vendas e suporte via WhatsApp com IA.
                Construído com Next.js, Firebase e muito café.
              </div>
            </div>
          </div>
          <Win2kSeparator style={{ margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Win2kButton onClick={() => setShowAboutDialog(false)} style={{ minWidth: '80px' }}>
              OK
            </Win2kButton>
          </div>
        </Win2kDialog>
      )}
    </div>
  );
};

export default Win2kLanding;
