import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { ResultCard } from './components/ResultCard';
import { LedgerHistory } from './components/LedgerHistory';
import { PresetsView } from './components/PresetsView';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { AuthScreen } from './components/AuthScreen';
import { AdminPanel } from './components/AdminPanel';
import { FacturaManualView } from './components/FacturaManualView';
import { ComprobanteResultado, ItemHistorial, PresetSample } from './types';
import { 
  AlertTriangle, 
  Sparkles, 
  CheckCircle2, 
  FileText, 
  ArrowLeft, 
  LogIn, 
  UserCheck, 
  Shield, 
  CloudLightning,
  Clock,
  Briefcase
} from 'lucide-react';
import { SAMPLES } from './data/samples';
import { supabase, getUnsyncedExtractos, syncExtractos } from './lib/supabase';
import { formatCurrencyARS } from './utils/formatters';

const STORAGE_KEY = 'asistente_contable_historial_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<'analizador' | 'historial' | 'presets' | 'auth' | 'panel_control' | 'factura_manual'>('analizador');
  const [currentResultado, setCurrentResultado] = useState<ComprobanteResultado | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCamOpen, setIsCamOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const updateUnsyncedCount = () => {
    setUnsyncedCount(getUnsyncedExtractos().length);
  };

  useEffect(() => {
    updateUnsyncedCount();
    const interval = setInterval(updateUnsyncedCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncUnsynced = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await syncExtractos();
      if (res.error) {
        setSyncStatusMsg(`Sincronización pausada: ${res.error}`);
      } else if (res.success > 0) {
        setSyncStatusMsg(`¡Sincronizado con éxito! Se subieron ${res.success} extractos a Supabase.`);
        updateUnsyncedCount();
        await fetchExtractos();
      } else if (res.failed > 0) {
        setSyncStatusMsg(`No se pudieron sincronizar ${res.failed} extractos (error de red/CORS).`);
      } else {
        setSyncStatusMsg('Todos los extractos locales ya están en la nube.');
      }
    } catch (e: any) {
      setSyncStatusMsg(`Error al sincronizar: ${e.message || e}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(null), 6000);
    }
  };

  const [historial, setHistorial] = useState<ItemHistorial[]>([]);

  const fetchExtractos = async (currentUser = user) => {
    if (!currentUser) {
      // Guest / Demo Mode Local Fallback
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setHistorial(JSON.parse(saved));
        } else {
          const initialSamples: ItemHistorial[] = [
            {
              id: 'sample-init-1',
              nombreArchivo: 'extracto_galicia_agosto.pdf',
              tamanoArchivo: 142000,
              tipoMime: 'application/pdf',
              fechaAnalisis: new Date(Date.now() - 3600000 * 2).toISOString(),
              resultado: SAMPLES[3].datosEjemplo.resultadoSimulado,
              rawJson: JSON.stringify(SAMPLES[3].datosEjemplo.resultadoSimulado, null, 2),
              facturado: true,
              user_email: 'cliente.demo@contasimpl.com'
            },
            {
              id: 'sample-init-2',
              nombreArchivo: 'transferencia_mercadopago_rossi.png',
              tamanoArchivo: 85400,
              tipoMime: 'image/png',
              fechaAnalisis: new Date(Date.now() - 3600000 * 5).toISOString(),
              resultado: SAMPLES[0].datosEjemplo.resultadoSimulado,
              rawJson: JSON.stringify(SAMPLES[0].datosEjemplo.resultadoSimulado, null, 2),
              facturado: false,
              user_email: 'cliente.demo@contasimpl.com'
            }
          ];
          setHistorial(initialSamples);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(initialSamples));
        }
      } catch (e) {
        console.error('Error al cargar historial de localStorage', e);
      }
      return;
    }

    setIsLoading(true);
    try {
      let query = supabase.from('extractos').select('*');
      
      const role = currentUser.email === 'ahilindalila94@gmail.com' 
        ? 'admin_contadora' 
        : (currentUser.role || currentUser.user_metadata?.role || 'cliente');

      // Filter: Clients only see their own extractos (Row Level Security concept)
      if (role !== 'admin_contadora') {
        query = query.eq('user_id', currentUser.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;

      if (data) {
        const mapped: ItemHistorial[] = data.map((d: any) => ({
          id: d.id,
          nombreArchivo: d.nombre_archivo || 'extracto.pdf',
          tipoMime: d.tipo_mime || 'application/pdf',
          fechaAnalisis: d.created_at || new Date().toISOString(),
          resultado: {
            origen_billetera: d.origen_billetera,
            fecha_periodo: d.fecha_periodo,
            monto_total_acumulado: Number(d.monto_total_acumulado),
            detalle_movimientos: d.detalle_movimientos || [],
          },
          rawJson: JSON.stringify(d, null, 2),
          user_id: d.user_id,
          user_email: d.user_email || 'cliente@contasimpl.com',
          facturado: !!d.facturado
        }));
        setHistorial(mapped);
      }
    } catch (err) {
      console.warn('Error fetching from Supabase. Loading guest / local history:', err);
      // Fallback
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistorial(JSON.parse(saved));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Get session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const role = session.user.email === 'ahilindalila94@gmail.com' 
          ? 'admin_contadora' 
          : (session.user.role || session.user.user_metadata?.role || 'cliente');
        const enrichedUser = { ...session.user, role };
        setUser(enrichedUser);
        
        // Tab redirect based on role
        if (role === 'admin_contadora') {
          setActiveTab('panel_control');
        } else {
          setActiveTab('analizador');
        }
        
        fetchExtractos(enrichedUser);
      } else {
        fetchExtractos(null);
      }
    });

    // Listen to Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const role = session.user.email === 'ahilindalila94@gmail.com' 
          ? 'admin_contadora' 
          : (session.user.role || session.user.user_metadata?.role || 'cliente');
        const enrichedUser = { ...session.user, role };
        setUser(enrichedUser);
        
        if (role === 'admin_contadora') {
          setActiveTab('panel_control');
        } else {
          setActiveTab('analizador');
        }
        
        fetchExtractos(enrichedUser);
      } else {
        setUser(null);
        setActiveTab('analizador');
        fetchExtractos(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error logging out:', e);
    }
    setUser(null);
    setActiveTab('analizador');
  };

  // Persist guest history only when user is not logged in
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(historial));
      } catch (e) {
        console.error('Error al persistir historial', e);
      }
    }
  }, [historial, user]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyzeFile = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const base64Data = await fileToBase64(file);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: file.type || 'image/jpeg',
          fileName: file.name,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || json.details || 'Error desconocido al analizar.');
      }

      const extracted: ComprobanteResultado = json.origen_billetera ? json : json.data;
      setCurrentResultado(extracted);
      setCurrentFileName(file.name);
      setActiveTab('analizador');

      // Save in history
      const newItem: ItemHistorial = {
        id: `item-${Date.now()}`,
        nombreArchivo: file.name,
        tamanoArchivo: file.size,
        tipoMime: file.type,
        fechaAnalisis: new Date().toISOString(),
        resultado: extracted,
        rawJson: json.rawJson || JSON.stringify(extracted, null, 2),
        user_id: user?.id || null,
        user_email: user?.email || 'cliente.demo@contasimpl.com',
        facturado: false
      };

      setHistorial((prev) => [newItem, ...prev]);
    } catch (err: any) {
      console.error('Error en análisis:', err);
      setErrorMessage(
        err.message || 'No se pudo procesar el comprobante. Verifique la imagen o el formato del archivo.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeText = async (text: string, title = 'Texto Pegado') => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawText: text,
          fileName: title,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || json.details || 'Error desconocido al analizar texto.');
      }

      const extracted: ComprobanteResultado = json.origen_billetera ? json : json.data;
      setCurrentResultado(extracted);
      setCurrentFileName(title);
      setActiveTab('analizador');

      const newItem: ItemHistorial = {
        id: `item-${Date.now()}`,
        nombreArchivo: title,
        tipoMime: 'text/plain',
        fechaAnalisis: new Date().toISOString(),
        resultado: extracted,
        rawJson: json.rawJson || JSON.stringify(extracted, null, 2),
        user_id: user?.id || null,
        user_email: user?.email || 'cliente.demo@contasimpl.com',
        facturado: false
      };

      setHistorial((prev) => [newItem, ...prev]);
    } catch (err: any) {
      console.error('Error en análisis de texto:', err);
      setErrorMessage(err.message || 'No se pudo procesar el texto.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadPreset = (sample: PresetSample) => {
    setCurrentResultado(sample.datosEjemplo.resultadoSimulado);
    setCurrentFileName(`${sample.titulo}.sample`);
    setActiveTab('analizador');
    setErrorMessage(null);
  };

  const handleSelectHistorialItem = (item: ItemHistorial) => {
    setCurrentResultado(item.resultado);
    setCurrentFileName(item.nombreArchivo);
    setActiveTab('analizador');
  };

  const handleDeleteHistorialItem = async (id: string) => {
    try {
      await supabase.from('extractos').delete().eq('id', id);
    } catch (e) {
      console.warn('Error deleting individual item from supabase:', e);
    }
    setHistorial((prev) => prev.filter((i) => i.id !== id));
  };

  const handleResetClient = async (email: string) => {
    try {
      await supabase.from('extractos').delete().eq('user_email', email);
    } catch (e) {
      console.warn('Error resetting client in supabase:', e);
    }
    setHistorial((prev) => prev.filter((item) => {
      const itemEmail = item.user_email || 'cliente_invitado@contasimpl.com';
      return itemEmail !== email;
    }));
  };

  const handleClearAllHistorial = () => {
    if (window.confirm('¿Desea vaciar todo el historial de comprobantes?')) {
      setHistorial([]);
    }
  };

  // Toggle Billing State (Admin Contadora action)
  const handleToggleFacturado = async (id: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      const { error } = await supabase
        .from('extractos')
        .update({ facturado: newStatus })
        .eq('id', id);

      if (error) throw error;

      // Update local state instantly for optimal UX
      setHistorial(prev => prev.map(item => {
        if (item.id === id) {
          return { ...item, facturado: newStatus };
        }
        return item;
      }));
    } catch (e: any) {
      console.error('Error actualizando facturación:', e);
      // Fallback update in case of network CORS issue
      setHistorial(prev => prev.map(item => {
        if (item.id === id) {
          return { ...item, facturado: !currentStatus };
        }
        return item;
      }));
    }
  };

  // Calculate client pending billing indicator
  const clientePendienteFacturar = useMemo(() => {
    return historial
      .filter(h => !h.facturado)
      .reduce((sum, h) => sum + (h.resultado?.monto_total_acumulado || 0), 0);
  }, [historial]);

  const totalAcumuladoGeneral = useMemo(() => {
    return historial.reduce(
      (acc, curr) => acc + (curr.resultado?.monto_total_acumulado || 0),
      0
    );
  }, [historial]);

  const isContadora = user?.role === 'admin_contadora';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-900">
      <Header
        historialCount={historial.length}
        totalAcumuladoHistorial={totalAcumuladoGeneral}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

        {/* Unsynced Offline Sync Notification Bar */}
        {(unsyncedCount > 0 || syncStatusMsg) && (
          <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                <CloudLightning className="w-5 h-5 animate-pulse text-amber-600" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Modo Local Activo (Offline / CORS)</span>
                  {user?.isLocalSession && (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                      Sesión Persistente
                    </span>
                  )}
                </h4>
                <p className="text-xs text-amber-800 mt-0.5 font-medium leading-relaxed">
                  {syncStatusMsg || `Tienes ${unsyncedCount} extracto(s) guardado(s) localmente de forma segura. Presiona el botón para intentar subirlos a la nube.`}
                </p>
              </div>
            </div>
            {unsyncedCount > 0 && (
              <button
                type="button"
                onClick={handleSyncUnsynced}
                disabled={isSyncing}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isSyncing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <>
                    <CloudLightning className="w-3.5 h-3.5" />
                    <span>Sincronizar ahora con la Nube</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
        
        {/* Error Notification */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold uppercase tracking-wider">Error en la extracción</h4>
              <p className="text-xs mt-0.5">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 text-xs font-bold px-2 py-1"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Unauthenticated User Call-To-Action Banner (Especially for easy mobile access) */}
        {!user && activeTab !== 'auth' && (
          <div className="bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-900 text-white rounded-2xl p-4.5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg border border-purple-600/50">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/10 shadow-inner">
                <LogIn className="w-6 h-6 text-purple-200 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-black tracking-tight uppercase">¿Quieres guardar tu historial y facturar?</h4>
                <p className="text-xs text-purple-100 mt-1 max-w-lg font-medium leading-relaxed">
                  Inicia sesión o regístrate en segundos para que tu contadora <strong>Ahilin Torres</strong> pueda liquidar y facturar tus extractos contables de forma directa.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('auth')}
              className="w-full md:w-auto px-6 py-3.5 bg-white hover:bg-purple-50 text-purple-900 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              <UserCheck className="w-4 h-4 text-purple-700" />
              <span>Ingresar / Registrarse Aquí</span>
            </button>
          </div>
        )}

        {/* Client View Panel - Status Indicator Bar */}
        {!isContadora && activeTab === 'analizador' && (
          <div className={`p-4.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-3xs transition-all ${
            clientePendienteFacturar === 0 
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-950'
              : 'bg-amber-500/10 border-amber-500/25 text-amber-950'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                clientePendienteFacturar === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {clientePendienteFacturar === 0 ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5 animate-pulse" />}
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider">
                  {clientePendienteFacturar === 0 ? 'Estado Impositivo: Todo al día' : 'Estado Impositivo: Liquidación Pendiente'}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-normal">
                  {clientePendienteFacturar === 0 
                    ? 'Todos tus extractos guardados han sido procesados y facturados correctamente por tu contadora.' 
                    : 'Tienes comprobantes cargados en el sistema que están pendientes de facturación en el período actual.'}
                </p>
              </div>
            </div>
            <div className="sm:text-right shrink-0">
              <span className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 border shadow-2xs ${
                clientePendienteFacturar === 0 
                  ? 'bg-white border-emerald-200 text-emerald-800' 
                  : 'bg-white border-amber-200 text-amber-800'
              }`}>
                {clientePendienteFacturar === 0 ? (
                  <span>Todo Facturado ✓</span>
                ) : (
                  <span>Pendiente Facturar: {formatCurrencyARS(clientePendienteFacturar)}</span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Tab Content: Analizador (Oculto para Contadora) */}
        {activeTab === 'analizador' && !isContadora && (
          <div className="space-y-6">
            {/* Upload Area */}
            <UploadZone
              onAnalyzeFile={handleAnalyzeFile}
              onAnalyzeText={handleAnalyzeText}
              onLoadPreset={handleLoadPreset}
              onOpenCam={() => setIsCamOpen(true)}
              isLoading={isLoading}
            />

            {/* Results Section */}
            {currentResultado ? (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-800">
                      Resultado Procesado
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setCurrentResultado(null);
                      setCurrentFileName(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Analizar otro comprobante
                  </button>
                </div>
                <ResultCard
                  resultado={currentResultado}
                  fileName={currentFileName || undefined}
                  onUpdateResultado={(updated) => setCurrentResultado(updated)}
                  user={user}
                  onGoToAuth={() => setActiveTab('auth')}
                />
              </div>
            ) : !isLoading && (
              /* Quick Prompt Card */
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  Esperando comprobante o extracto
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Carga un archivo o elegí uno de los ejemplos para extraer automáticamente el origen, período, monto total y detalle de transferencias recibidas en formato JSON.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Factura Manual (Only for Client) */}
        {activeTab === 'factura_manual' && !isContadora && (
          <FacturaManualView
            user={user}
            onSuccess={() => {
              setTimeout(() => {
                fetchExtractos(user);
              }, 400);
            }}
          />
        )}

        {/* Tab Content: Admin Panel (Only for Contadora) */}
        {activeTab === 'panel_control' && isContadora && (
          <AdminPanel
            historial={historial}
            onToggleFacturado={handleToggleFacturado}
            onDeleteItem={handleDeleteHistorialItem}
            onResetClient={handleResetClient}
          />
        )}

        {/* Tab Content: Historial (Filtered per user RLS in fetchExtractos) */}
        {activeTab === 'historial' && (
          <LedgerHistory
            historial={historial}
            onSelectHistorialItem={handleSelectHistorialItem}
            onDeleteItem={handleDeleteHistorialItem}
            onClearAll={handleClearAllHistorial}
          />
        )}

        {/* Tab Content: Presets (Oculto para Contadora) */}
        {activeTab === 'presets' && !isContadora && (
          <PresetsView onSelectPreset={handleLoadPreset} />
        )}

        {/* Tab Content: Auth / Supabase */}
        {activeTab === 'auth' && (
          <div className="space-y-6">
            {user ? (
              <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl text-center space-y-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-inner bg-purple-50 text-purple-600">
                  {isContadora ? <Shield className="w-8 h-8" /> : <UserCheck className="w-8 h-8" />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Sesión Activa</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Perfil: <span className="font-bold text-purple-700">{isContadora ? 'Estudio Contable (Admin)' : 'Cliente / Comercio'}</span>
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-xs font-mono text-slate-600 border border-slate-100 break-all">
                  {user.email}
                </div>
                <div className="pt-2 text-xs text-slate-500 leading-relaxed text-left space-y-2 p-4 border rounded-2xl bg-purple-50/50 border-purple-100">
                  <span className="font-bold block mb-1 text-purple-800">✓ Roles e Integración:</span>
                  {isContadora ? (
                    <>
                      <span className="block">• Acceso completo al <strong>Panel de Administración</strong>.</span>
                      <span className="block">• Consolidado de todos los clientes de forma simultánea.</span>
                      <span className="block">• Control e interruptores de Liquidación (Columna <code>facturado</code>).</span>
                    </>
                  ) : (
                    <>
                      <span className="block">• Guardado de extractos mapeados a tu ID de usuario único.</span>
                      <span className="block">• <strong>Row Level Security (RLS)</strong>: Sólo ves tus propios archivos.</span>
                      <span className="block">• Acceso al indicador de liquidaciones en tiempo real.</span>
                    </>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 rounded-xl text-xs font-bold transition-all border border-rose-200"
                >
                  Cerrar Sesión Activa
                </button>
              </div>
            ) : (
              <AuthScreen onAuthSuccess={(u) => { setUser(u); }} />
            )}
          </div>
        )}
      </main>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCamOpen}
        onClose={() => setIsCamOpen(false)}
        onCapture={(file) => handleAnalyzeFile(file)}
      />

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="flex items-center gap-1.5">
            <span>Cuentas Claras - Asistente Contable Automatizado</span>
            <span>•</span>
            <span className="text-emerald-400 font-mono">Row Level Security</span>
          </p>
          <p className="text-[11px] text-slate-500">
            Compatible con Mercado Pago, Naranja X, Ualá, Cuenta DNI, Galicia, Santander y más
          </p>
        </div>
      </footer>
    </div>
  );
}
