import React from 'react';
import { Calculator, ShieldCheck, Sparkles, FileSpreadsheet, Layers, User, LogOut, Briefcase } from 'lucide-react';
import { Logo } from './Logo';

interface HeaderProps {
  historialCount: number;
  totalAcumuladoHistorial: number;
  onClearHistorial?: () => void;
  activeTab: 'analizador' | 'historial' | 'presets' | 'auth' | 'panel_control' | 'factura_manual';
  setActiveTab: (tab: 'analizador' | 'historial' | 'presets' | 'auth' | 'panel_control' | 'factura_manual') => void;
  user: any;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  historialCount,
  totalAcumuladoHistorial,
  activeTab,
  setActiveTab,
  user,
  onLogout,
}) => {
  const isContadora = user?.role === 'admin_contadora';

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between py-3 sm:py-0 min-h-[4rem] sm:h-20 gap-3 sm:gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
            <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-700/60 p-0.5 overflow-hidden shrink-0">
              <Logo size={42} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-base md:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  Cuentas Claras
                  <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-medium bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/20">
                    <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-pulse text-purple-400" /> Studio 3.7
                  </span>
                </h1>
              </div>
              <p className="text-[10px] text-slate-400 hidden lg:block font-medium">
                Estudio Ahilin Torres — Asesoría Contable & Conciliación Impositiva
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Metrics */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex flex-wrap items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 w-full sm:w-auto gap-1">
              
              {/* Contadora Admin Tab */}
              {isContadora && (
                <button
                  id="tab-panel_control"
                  onClick={() => setActiveTab('panel_control')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none whitespace-nowrap ${
                    activeTab === 'panel_control'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Panel Clientes</span>
                </button>
              )}

              {/* Cliente Upload Tabs */}
              {!isContadora && (
                <>
                  <button
                    id="tab-analizador"
                    onClick={() => setActiveTab('analizador')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none ${
                      activeTab === 'analizador'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Analizador</span>
                  </button>
                  <button
                    id="tab-factura_manual"
                    onClick={() => setActiveTab('factura_manual')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none ${
                      activeTab === 'factura_manual'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                    <span className="hidden sm:inline">Factura por Texto/Manual</span>
                    <span className="sm:hidden">Facturar</span>
                  </button>
                  <button
                    id="tab-presets"
                    onClick={() => setActiveTab('presets')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 flex-1 sm:flex-none ${
                      activeTab === 'presets'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ejemplos</span>
                    <span className="sm:hidden">Ej.</span>
                  </button>
                </>
              )}

              {/* Shared Historial Tab (filtered per user RLS rules) */}
              <button
                id="tab-historial"
                onClick={() => setActiveTab('historial')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none ${
                  activeTab === 'historial'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isContadora ? 'Todos los Libros' : 'Mis Extractos'}</span>
                <span className="sm:hidden">{isContadora ? 'Libros' : 'Extractos'}</span>
                {historialCount > 0 && (
                  <span className="font-bold text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500 text-white">
                    {historialCount}
                  </span>
                )}
              </button>

              {/* User Identity / Auth Tab */}
              <button
                id="tab-auth"
                onClick={() => setActiveTab('auth')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none whitespace-nowrap ${
                  activeTab === 'auth'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden md:inline">
                  {user ? (isContadora ? 'Estudio Contable' : user.email) : 'Iniciar Sesión'}
                </span>
                <span className="md:hidden">{user ? 'Cuenta' : 'Entrar'}</span>
                {user && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                )}
              </button>
            </div>

            {user && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors flex items-center justify-center shrink-0"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
