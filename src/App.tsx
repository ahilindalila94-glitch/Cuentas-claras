import React, { useState, useEffect } from 'react';
import { Header, ActiveTabType } from './components/Header';
import { LedgerHistory } from './components/LedgerHistory';
import { AuthScreen } from './components/AuthScreen';
import { AdminPanel } from './components/AdminPanel';
import { FacturaManualView } from './components/FacturaManualView';
import { ItemHistorial, UserRole } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTabType>('factura_manual');

  // Strict initial auth state: null (zero credentials on startup)
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Real history initialized to empty array
  const [historial, setHistorial] = useState<ItemHistorial[]>([]);

  // Function to load extractos and receipts from Supabase
  const fetchExtractos = async (currentUser: any) => {
    if (!currentUser) {
      setHistorial([]);
      return;
    }

    try {
      const isContadora =
        currentUser.role === 'admin_contadora' ||
        currentUser.email?.trim().toLowerCase() === 'ahilindalila94@gmail.com';

      const allRecords: any[] = [];

      if (isContadora) {
        // Global query for accountant: fetch ALL receipts without filtering by user_id
        console.log('Cargando registros globales de contadora (ahilindalila94@gmail.com)...');

        // 1. Direct global query on receipts table
        try {
          const { data: receiptsData, error: rErr } = await supabase
            .from('receipts')
            .select('*')
            .order('created_at', { ascending: false });

          if (receiptsData && Array.isArray(receiptsData)) {
            allRecords.push(...receiptsData);
          } else if (rErr) {
            console.warn('Aviso en consulta global de receipts:', rErr);
          }
        } catch (rCatch) {
          console.warn('Excepción consultando receipts:', rCatch);
        }

        // 2. Direct global query on extractos table
        try {
          const { data: extractosData, error: eErr } = await supabase
            .from('extractos')
            .select('*')
            .order('created_at', { ascending: false });

          if (extractosData && Array.isArray(extractosData)) {
            allRecords.push(...extractosData);
          } else if (eErr) {
            console.warn('Aviso en consulta global de extractos:', eErr);
          }
        } catch (eCatch) {
          console.warn('Excepción consultando extractos:', eCatch);
        }
      } else {
        // Regular client: strictly filter by their own user_id or email
        try {
          let rQuery = supabase.from('receipts').select('*');
          if (currentUser.id && currentUser.id !== 'demo-user-123' && !currentUser.isLocalSession) {
            rQuery = rQuery.or(`user_id.eq.${currentUser.id},user_email.eq.${currentUser.email}`);
          } else {
            rQuery = rQuery.eq('user_email', currentUser.email);
          }
          const { data: rData } = await rQuery;
          if (rData && Array.isArray(rData)) allRecords.push(...rData);
        } catch (rErr) {
          console.warn('Aviso consulta cliente receipts:', rErr);
        }

        try {
          let eQuery = supabase.from('extractos').select('*');
          if (currentUser.id && currentUser.id !== 'demo-user-123' && !currentUser.isLocalSession) {
            eQuery = eQuery.or(`user_id.eq.${currentUser.id},user_email.eq.${currentUser.email}`);
          } else {
            eQuery = eQuery.eq('user_email', currentUser.email);
          }
          const { data: eData } = await eQuery;
          if (eData && Array.isArray(eData)) allRecords.push(...eData);
        } catch (eErr) {
          console.warn('Aviso consulta cliente extractos:', eErr);
        }
      }

      // Deduplicate merged records
      const seen = new Set<string>();
      const uniqueRecords = allRecords.filter((item) => {
        const key = item.id || `${item.created_at}-${item.monto || item.monto_total_acumulado}-${item.user_email}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (uniqueRecords.length > 0) {
        const mapped: ItemHistorial[] = uniqueRecords.map((item: any) => {
          const totalMonto = Number(
            item.monto_total_acumulado !== undefined && item.monto_total_acumulado !== null
              ? item.monto_total_acumulado
              : item.monto
          ) || 0;

          const movimientos =
            Array.isArray(item.detalle_movimientos) && item.detalle_movimientos.length > 0
              ? item.detalle_movimientos.map((m: any) => ({
                  ...m,
                  monto: Number(m.monto !== undefined && m.monto !== null ? m.monto : totalMonto) || 0,
                  pagador_nombre_cuit: m.pagador_nombre_cuit || item.cuit || 'Consumidor Final',
                  concepto: m.concepto || item.concepto,
                }))
              : [
                  {
                    fecha: item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                    monto: totalMonto,
                    pagador_nombre_cuit: item.cuit || item.pagador_nombre_cuit || 'Consumidor Final',
                    concepto: item.concepto,
                    tipo_operacion: item.tipo_comprobante || 'factura_manual',
                  },
                ];

          return {
            id: item.id || item._local_id || `db-${Date.now()}-${Math.random()}`,
            nombreArchivo: item.nombre_archivo || 'Comprobante',
            tamanoArchivo: 0,
            tipoMime: 'application/pdf',
            fechaAnalisis: item.created_at || item._created_at || new Date().toISOString(),
            resultado: {
              origen_billetera: item.origen_billetera || 'Carga Manual',
              fecha_periodo: item.fecha_periodo || 'Periodo actual',
              monto_total_acumulado: totalMonto,
              detalle_movimientos: movimientos,
              tipo_comprobante: item.tipo_comprobante,
              info_cupon: item.info_cupon,
              info_lote: item.info_lote,
            },
            rawJson: JSON.stringify(item, null, 2),
            user_id: item.user_id,
            user_email: item.user_email,
            facturado: item.facturado || false,
          };
        });

        setHistorial(mapped);
      } else {
        setHistorial([]);
      }
    } catch (err) {
      console.error('Error general fetching extractos/receipts:', err);
    }
  };

  // Auth Initialization on application mount
  useEffect(() => {
    let activeChannel: any = null;

    const initAuth = async () => {
      setIsAuthLoading(true);
      try {
        if (isSupabaseConfigured()) {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user) {
            const email = data.session.user.email?.toLowerCase().trim() || '';
            const role: UserRole = email === 'ahilindalila94@gmail.com' ? 'admin_contadora' : 'cliente';

            const authenticatedUser = {
              ...data.session.user,
              email,
              role,
            };
            setUser(authenticatedUser);
            fetchExtractos(authenticatedUser);
            if (role === 'admin_contadora') {
              setActiveTab('panel_control');
            } else {
              setActiveTab('factura_manual');
            }
            return;
          }
        }

        // Check local persistent session
        const localSessionStr = localStorage.getItem('local_supabase_session');
        if (localSessionStr) {
          try {
            const parsed = JSON.parse(localSessionStr);
            const email = (parsed.email || '').toLowerCase().trim();
            const role: UserRole = email === 'ahilindalila94@gmail.com' ? 'admin_contadora' : 'cliente';

            const authenticatedUser = {
              ...parsed,
              email,
              role,
            };
            setUser(authenticatedUser);
            fetchExtractos(authenticatedUser);
            if (role === 'admin_contadora') {
              setActiveTab('panel_control');
            } else {
              setActiveTab('factura_manual');
            }
            return;
          } catch (e) {
            localStorage.removeItem('local_supabase_session');
          }
        }

        // If not logged in, state remains zero
        setUser(null);
        setHistorial([]);
        setActiveTab('factura_manual');
      } catch (err) {
        console.warn('Auth init note:', err);
        setUser(null);
        setHistorial([]);
        setActiveTab('factura_manual');
      } finally {
        setIsAuthLoading(false);
      }
    };

    initAuth();

    // Supabase auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session?.user) {
        const email = session.user.email?.toLowerCase().trim() || '';
        const role: UserRole = email === 'ahilindalila94@gmail.com' ? 'admin_contadora' : 'cliente';

        const authenticatedUser = {
          ...session.user,
          email,
          role,
        };
        setUser(authenticatedUser);
        fetchExtractos(authenticatedUser);
        if (role === 'admin_contadora') {
          setActiveTab('panel_control');
        } else {
          setActiveTab('factura_manual');
        }
      } else if (!localStorage.getItem('local_supabase_session')) {
        setUser(null);
        setHistorial([]);
        setActiveTab('factura_manual');
      }
    });

    // Real-time Supabase subscription for Contadora & clients
    try {
      activeChannel = supabase
        .channel('public:receipts_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'receipts' },
          () => {
            if (user) {
              fetchExtractos(user);
            }
          }
        )
        .subscribe();
    } catch (realtimeErr) {
      console.warn('Real-time subscription notice:', realtimeErr);
    }

    return () => {
      authListener?.subscription?.unsubscribe?.();
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Logout signOut error:', e);
    }
    localStorage.removeItem('local_supabase_session');
    setUser(null);
    setHistorial([]);
    setActiveTab('factura_manual');
  };

  const handleAuthSuccess = (authenticatedUser: any) => {
    const email = authenticatedUser?.email?.toLowerCase().trim() || '';
    const role: UserRole = email === 'ahilindalila94@gmail.com' ? 'admin_contadora' : 'cliente';

    const fullUser = {
      ...authenticatedUser,
      email,
      role,
    };
    setUser(fullUser);
    fetchExtractos(fullUser);
    if (role === 'admin_contadora') {
      setActiveTab('panel_control');
    } else {
      setActiveTab('factura_manual');
    }
  };

  // Toggle billed status in Supabase
  const handleToggleFacturado = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setHistorial((prev) =>
      prev.map((item) => (item.id === id ? { ...item, facturado: nextStatus } : item))
    );

    try {
      await supabase.from('receipts').update({ facturado: nextStatus }).eq('id', id);
      await supabase.from('extractos').update({ facturado: nextStatus }).eq('id', id);
    } catch (err) {
      console.error('Error actualizando facturado en Supabase:', err);
    }
  };

  // Delete individual record
  const handleDeleteItem = async (id: string) => {
    setHistorial((prev) => prev.filter((item) => item.id !== id));
    try {
      await supabase.from('receipts').delete().eq('id', id);
      await supabase.from('extractos').delete().eq('id', id);
    } catch (e) {
      console.error('Error eliminando comprobante:', e);
    }
  };

  // Reset all records for a client
  const handleResetClient = async (email: string) => {
    setHistorial((prev) => prev.filter((item) => item.user_email !== email));
    try {
      await supabase.from('receipts').delete().eq('user_email', email);
      await supabase.from('extractos').delete().eq('user_email', email);
    } catch (e) {
      console.error('Error reseteando cliente:', e);
    }
  };

  const handleClearHistorial = async () => {
    if (user?.email) {
      handleResetClient(user.email);
    } else {
      setHistorial([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-purple-100 selection:text-purple-900">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        historialCount={historial.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {isAuthLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400">
            <div className="w-8 h-8 border-3 border-purple-600/30 border-t-purple-600 rounded-full animate-spin mb-3"></div>
            <p className="text-xs font-semibold">Cargando datos contables...</p>
          </div>
        ) : (
          <>
            {activeTab === 'auth' && (
              <AuthScreen 
                onAuthSuccess={handleAuthSuccess} 
                onCancel={() => setActiveTab(user?.role === 'admin_contadora' ? 'panel_control' : 'factura_manual')} 
              />
            )}

            {activeTab === 'factura_manual' && (
              <FacturaManualView
                user={user}
                onSuccess={() => {
                  fetchExtractos(user);
                  setActiveTab(user?.role === 'admin_contadora' ? 'panel_control' : 'historial');
                }}
              />
            )}

            {activeTab === 'panel_control' && (
              <AdminPanel
                historial={historial}
                onToggleFacturado={handleToggleFacturado}
                onDeleteItem={handleDeleteItem}
                onResetClient={handleResetClient}
                onRefresh={() => fetchExtractos(user)}
              />
            )}

            {activeTab === 'historial' && (
              <LedgerHistory
                historial={historial}
                onSelectHistorialItem={(_item) => {
                  setActiveTab('factura_manual');
                }}
                onDeleteItem={handleDeleteItem}
                onClearAll={handleClearHistorial}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Cuentas Claras • Estudio Contable Ahilin Torres & Conciliación Impositiva</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Payway & POSNET</span>
            <span>•</span>
            <span>Facturación AFIP / ARCA</span>
            <span>•</span>
            <span>Comprobantes Directos</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
