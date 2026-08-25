import React, { useState } from 'react';
import { 
  Calculator, 
  Sparkles, 
  FileSpreadsheet, 
  Layers, 
  User, 
  LogOut, 
  Briefcase, 
  Menu, 
  X 
} from 'lucide-react';
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
  activeTab,
  setActiveTab,
  user,
  onLogout,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Strictly verify that only ahilindalila94@gmail.com with admin_contadora role can see the admin panel
  const isContadora = user?.role === 'admin_contadora' && user?.email?.trim().toLowerCase() === 'ahilindalila94@gmail.com';

  const handleTabClick = (tab: 'analizador' | 'historial' | 'presets' | 'auth' | 'panel_control' | 'factura_manual') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md w-full max-w-full overflow-x-hidden box-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-full box-border">
        
        {/* Main Header Bar */}
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4 w-full">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-700/60 p-0.5 overflow-hidden shrink-0">
              <Logo size={40} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-white flex items-center gap-1.5 whitespace-nowrap">
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

          {/* DESKTOP NAVIGATION (Visible on md and up, >= 768px) */}
          <div className="hidden md:flex items-center gap-4">
            <nav className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 gap-1">
              
              {/* Contadora Admin Tab */}
              {isContadora && (
                <button
                  id="tab-panel_control"
                  onClick={() => handleTabClick('panel_control')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
                    onClick={() => handleTabClick('analizador')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
                    onClick={() => handleTabClick('factura_manual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      activeTab === 'factura_manual'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                    <span>Facturar por Texto/Manual</span>
                  </button>

                  <button
                    id="tab-presets"
                    onClick={() => handleTabClick('presets')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      activeTab === 'presets'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Ejemplos</span>
                  </button>
                </>
              )}

              {/* Shared Historial Tab */}
              <button
                id="tab-historial"
                onClick={() => handleTabClick('historial')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'historial'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{isContadora ? 'Todos los Libros' : 'Mis Extractos'}</span>
                {historialCount > 0 && (
                  <span className="font-black text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500 text-white">
                    {historialCount}
                  </span>
                )}
              </button>

              {/* User Identity / Auth Tab */}
              <button
                id="tab-auth"
                onClick={() => handleTabClick('auth')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'auth'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>
                  {user ? (isContadora ? 'Estudio Contable' : user.email) : 'Iniciar Sesión'}
                </span>
                {user && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                )}
              </button>
            </nav>

            {/* Logout Button on Desktop */}
            {user && (
              <button
                onClick={onLogout}
                className="p-2 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-xl transition-all border border-slate-700/50 flex items-center justify-center shrink-0 cursor-pointer"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* HAMBURGER TOGGLE BUTTON (Visible only on mobile/tablet, < 768px) */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white active:scale-95 transition-all border border-slate-700/50 cursor-pointer"
              aria-label="Alternar menú de navegación"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>

        </div>

        {/* MOBILE COLLAPSIBLE DROPDOWN MENU (Visible only on < 768px when open) */}
        {isMobileMenuOpen && (
          <div className="md:hidden pb-5 pt-1 border-t border-slate-800 w-full animate-in fade-in slide-in-from-top-3 duration-200">
            <nav className="flex flex-col gap-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-850/60 w-full box-border">
              
              {/* Contadora Admin Tab */}
              {isContadora && (
                <button
                  onClick={() => handleTabClick('panel_control')}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                    activeTab === 'panel_control'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-300 bg-slate-900/50 hover:bg-slate-850'
                  }`}
                >
                  <Briefcase className="w-4 h-4 text-purple-400" />
                  <span>Panel Clientes</span>
                </button>
              )}

              {/* Cliente Upload Tabs */}
              {!isContadora && (
                <>
                  <button
                    onClick={() => handleTabClick('analizador')}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                      activeTab === 'analizador'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-300 bg-slate-900/50 hover:bg-slate-850'
                    }`}
                  >
                    <Calculator className="w-4 h-4 text-purple-400" />
                    <span>Analizador</span>
                  </button>

                  <button
                    onClick={() => handleTabClick('factura_manual')}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                      activeTab === 'factura_manual'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-300 bg-slate-900/50 hover:bg-slate-850'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-purple-300" />
                    <span>Facturar por Texto/Manual</span>
                  </button>

                  <button
                    onClick={() => handleTabClick('presets')}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                      activeTab === 'presets'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-300 bg-slate-900/50 hover:bg-slate-850'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>Ejemplos</span>
                  </button>
                </>
              )}

              {/* Shared Historial Tab */}
              <button
                onClick={() => handleTabClick('historial')}
                className={`w-full py-3 px-4 rounded-xl text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                  activeTab === 'historial'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-300 bg-slate-900/50 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                  <span>{isContadora ? 'Todos los Libros' : 'Mis Extractos'}</span>
                </div>
                {historialCount > 0 && (
                  <span className="font-black text-[10px] px-2 py-0.5 rounded-full bg-purple-500 text-white">
                    {historialCount}
                  </span>
                )}
              </button>

              {/* User Identity / Auth Tab */}
              <button
                onClick={() => handleTabClick('auth')}
                className={`w-full py-3 px-4 rounded-xl text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                  activeTab === 'auth'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-300 bg-slate-900/50 hover:bg-slate-850'
                }`}
              >
                <User className="w-4 h-4 text-purple-400" />
                <span className="truncate max-w-[220px]">
                  {user ? (isContadora ? 'Estudio Contable' : user.email) : 'Iniciar Sesión'}
                </span>
              </button>

              {/* Logout Button (if logged in) */}
              {user && (
                <button
                  onClick={() => {
                    onLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full py-3 px-4 rounded-xl text-xs font-black flex items-center gap-3 transition-all text-rose-300 bg-rose-950/20 hover:bg-rose-900/40 border border-rose-900/20 mt-1 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Cerrar Sesión</span>
                </button>
              )}

            </nav>
          </div>
        )}

      </div>
    </header>
  );
};
