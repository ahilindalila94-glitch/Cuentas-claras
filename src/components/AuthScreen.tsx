import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { KeyRound, Mail, UserPlus, LogIn, Sparkles, Shield, User } from 'lucide-react';
import { UserRole } from '../types';
import { Logo } from './Logo';

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('cliente');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    // Hardcoded rule: 'ahilindalila94@gmail.com' is always admin_contadora
    const finalRole = email.trim().toLowerCase() === 'ahilindalila94@gmail.com' 
      ? 'admin_contadora' 
      : selectedRole;

    try {
      if (isSignUp) {
        // Save metadata locally for offline/mock lookup fallback
        localStorage.setItem(`meta_${email.trim().toLowerCase()}`, JSON.stringify({ role: finalRole }));

        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              role: finalRole,
            }
          }
        });
        if (signUpErr) throw signUpErr;
        
        if (data?.user) {
          const userWithRole = {
            ...data.user,
            role: email.trim().toLowerCase() === 'ahilindalila94@gmail.com' 
              ? 'admin_contadora' 
              : (data.user.user_metadata?.role || finalRole)
          };
          setSuccessMsg(`¡Registro exitoso! Iniciando sesión automáticamente...`);
          setTimeout(() => {
            onAuthSuccess(userWithRole);
          }, 1500);
        } else {
          setSuccessMsg(`¡Registro exitoso como ${finalRole === 'admin_contadora' ? 'Contadora' : 'Cliente'}!`);
          setIsSignUp(false);
        }
      } else {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) throw signInErr;
        
        if (data?.user) {
          // If real user is logged in, attach metadata role manually if not present
          const userMeta = localStorage.getItem(`meta_${email.trim().toLowerCase()}`);
          const storedRole = userMeta ? JSON.parse(userMeta).role : null;
          
          const userWithRole = {
            ...data.user,
            role: email.trim().toLowerCase() === 'ahilindalila94@gmail.com' 
              ? 'admin_contadora' 
              : (data.user.user_metadata?.role || storedRole || 'cliente')
          };
          onAuthSuccess(userWithRole);
        }
      }
    } catch (err: any) {
      console.error('Error de autenticación con Supabase:', err);
      const isNetErr = err?.message?.toLowerCase().includes('failed to fetch') || 
                       err?.message?.toLowerCase().includes('load failed') || 
                       String(err).toLowerCase().includes('failed to fetch') || 
                       String(err).toLowerCase().includes('load failed') ||
                       String(err).toLowerCase().includes('network error');
      if (isNetErr) {
        // Automatically activate a local persistent session
        const localUser = {
          id: 'local-user-' + btoa(email),
          email: email.trim(),
          isLocalSession: true,
          created_at: new Date().toISOString(),
          role: finalRole,
          user_metadata: { role: finalRole }
        };
        localStorage.setItem('local_supabase_session', JSON.stringify(localUser));
        localStorage.setItem(`meta_${email.trim().toLowerCase()}`, JSON.stringify({ role: finalRole }));
        
        setSuccessMsg(
          `¡Conexión no disponible! Hemos activado una sesión local persistente como ${
            finalRole === 'admin_contadora' ? 'CONTADORA (Admin)' : 'CLIENTE'
          } en tu navegador. Puedes operar normalmente.`
        );
        
        setTimeout(() => {
          onAuthSuccess(localUser);
        }, 2000);
      } else {
        setError(err?.message || 'Ocurrió un error inesperado al autenticar.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoMode = (role: UserRole) => {
    const mockUser = {
      id: role === 'admin_contadora' ? 'demo-admin-456' : 'demo-user-123',
      email: role === 'admin_contadora' ? 'ahilindalila94@gmail.com' : 'cliente.demo@contasimpl.com',
      isDemo: true,
      role: role,
      user_metadata: { role: role }
    };
    localStorage.setItem(`meta_${mockUser.email}`, JSON.stringify({ role }));
    onAuthSuccess(mockUser);
  };

  return (
    <div className="max-w-md w-full mx-auto my-2 sm:my-8 p-4 sm:p-6 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-md sm:shadow-xl space-y-4 sm:space-y-5">
      <div className="text-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white flex items-center justify-center mx-auto mb-2 shadow-md border border-slate-100 p-1 overflow-hidden">
          <Logo size={60} />
        </div>
        <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
          Estudio Ahilin Torres
        </h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Asesoría Contable & Conciliación
        </p>
      </div>

      {/* Segmented Tab Selector for Ingresar vs Registrarse */}
      <div className="grid grid-cols-2 gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/60">
        <button
          type="button"
          onClick={() => {
            setIsSignUp(false);
            setError('');
            setSuccessMsg('');
          }}
          className={`py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            !isSignUp
              ? 'bg-white text-purple-700 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Ingresar</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setIsSignUp(true);
            setError('');
            setSuccessMsg('');
          }}
          className={`py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            isSignUp
              ? 'bg-white text-purple-700 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Registrarse</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-xs font-semibold leading-relaxed">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-xs font-semibold leading-relaxed">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleAuth} className="space-y-4">
        {/* Role Selector Segmented Controls - Only show on Sign Up, but we show information on Sign In */}
        {isSignUp && (
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Selecciona tu Rol de Cuenta
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedRole('cliente')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  selectedRole === 'cliente'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Cliente / Comercio</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('admin_contadora')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  selectedRole === 'admin_contadora'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Estudio Contable</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-snug">
              * Nota: El correo <strong>ahilindalila94@gmail.com</strong> se registrará automáticamente como Contadora.
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
            Correo Electrónico
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@ejemplo.com"
              className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
            Contraseña
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isSignUp ? (
            <>
              <UserPlus className="w-4 h-4" />
              <span>Crear mi Cuenta de {selectedRole === 'admin_contadora' ? 'Contadora' : 'Cliente'}</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Ingresar a mi Cuenta</span>
            </>
          )}
        </button>
      </form>

      {/* Segmented Quick Demo Mode Buttons */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <p className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 text-center">
          Demostración Rápida Local
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleQuickDemoMode('cliente')}
            className="py-2.5 px-3 bg-purple-50 hover:bg-purple-100/80 text-purple-700 border border-purple-200/50 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cliente Demo</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickDemoMode('admin_contadora')}
            className="py-2.5 px-3 bg-purple-50 hover:bg-purple-100/80 text-purple-700 border border-purple-200/50 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Contadora Demo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
