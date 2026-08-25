import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { ResultCard } from './components/ResultCard';
import { LedgerHistory } from './components/LedgerHistory';
import { PresetsView } from './components/PresetsView';
import { AuthScreen } from './components/AuthScreen';
import { AdminPanel } from './components/AdminPanel';
import { FacturaManualView } from './components/FacturaManualView';
import { ComprobanteResultado, ItemHistorial, UserRole, PresetSample } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { analyzeComprobanteWithAI } from './lib/aiAnalyzer';
import { extractPdfData } from './lib/pdfHelper';
import { AlertCircle, X } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'analizador' | 'historial' | 'presets' | 'auth' | 'panel_control' | 'factura_manual'>('analizador');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [resultadoActual, setResultadoActual] = useState<ComprobanteResultado | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('');

  // Strict initial auth state: null (no auto-login, zero credentials on startup)
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

        // 1. Global query on receipts
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

        // 2. Global query on extractos
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
            nombreArchivo: item.nombre_archivo || 'comprobante.pdf',
            tamanoArchivo: 0,
            tipoMime: 'application/pdf',
            fechaAnalisis: item.created_at || item._created_at || new Date().toISOString(),
            resultado: {
              origen_billetera: item.origen_billetera || 'Carga Comercial',
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
            }
            return;
          } catch (e) {
            localStorage.removeItem('local_supabase_session');
          }
        }

        // If not logged in, state remains zero
        setUser(null);
        setHistorial([]);
      } catch (err) {
        console.warn('Auth init note:', err);
        setUser(null);
        setHistorial([]);
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
      } else if (!localStorage.getItem('local_supabase_session')) {
        setUser(null);
        setHistorial([]);
      }
    });

    // Real-time Supabase subscription for Contadora & clients
    try {
      activeChannel = supabase
        .channel('public:extractos')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'extractos' },
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
    setResultadoActual(null);
    setActiveTab('analizador');
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
      setActiveTab('analizador');
    }
  };

  // Toggle billed status in Supabase
  const handleToggleFacturado = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setHistorial((prev) =>
      prev.map((item) => (item.id === id ? { ...item, facturado: nextStatus } : item))
    );

    try {
      await supabase.from('extractos').update({ facturado: nextStatus }).eq('id', id);
    } catch (err) {
      console.error('Error actualizando facturado en Supabase:', err);
    }
  };

  // Delete individual record
  const handleDeleteItem = async (id: string) => {
    setHistorial((prev) => prev.filter((item) => item.id !== id));
    try {
      await supabase.from('extractos').delete().eq('id', id);
    } catch (e) {
      console.error('Error eliminando comprobante:', e);
    }
  };

  // Reset all records for a client
  const handleResetClient = async (email: string) => {
    setHistorial((prev) => prev.filter((item) => item.user_email !== email));
    try {
      await supabase.from('extractos').delete().eq('user_email', email);
    } catch (e) {
      console.error('Error reseteando cliente:', e);
    }
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('No se pudo convertir el archivo a Base64.'));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo seleccionado.'));
      reader.readAsDataURL(file);
    });
  };

  // Analyze File with Vision AI
  const handleAnalyzeFile = async (file: File) => {
    setIsProcessing(true);
    setAnalysisError(null);
    setCurrentFileName(file.name);

    try {
      let mimeType = file.type;
      const lowerName = file.name.toLowerCase();
      if (!mimeType || mimeType === '') {
        if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (lowerName.endsWith('.png')) mimeType = 'image/png';
        else if (lowerName.endsWith('.webp')) mimeType = 'image/webp';
        else if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
        else mimeType = 'image/jpeg';
      }

      let extracted: ComprobanteResultado;

      if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
        // PDF Processing using pdfjs-dist
        try {
          console.log(`Extrayendo texto e imágenes de PDF: ${file.name} con pdfjs-dist...`);
          const pdfData = await extractPdfData(file);
          
          extracted = await analyzeComprobanteWithAI({
            fileData: pdfData.firstPageImageBase64 || (await fileToBase64(file)),
            mimeType: pdfData.firstPageImageBase64 ? 'image/jpeg' : 'application/pdf',
            rawText: pdfData.text,
            fileName: file.name,
          });
        } catch (pdfErr: any) {
          console.warn('Fallo en la lectura del PDF:', pdfErr);
          const customMsg = pdfErr?.message || 'El archivo PDF está protegido o no se pudo interpretar.';
          setAnalysisError(
            `No se pudo leer el archivo PDF "${file.name}" (${customMsg}). Podés registrar la operación usando 'Carga Manual' o pegando el texto.`
          );
          setIsProcessing(false);
          return;
        }
      } else if (mimeType.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.csv')) {
        const text = await file.text();
        extracted = await analyzeComprobanteWithAI({
          rawText: text,
          fileName: file.name,
          mimeType: 'text/plain',
        });
      } else {
        const base64 = await fileToBase64(file);
        extracted = await analyzeComprobanteWithAI({
          fileData: base64,
          mimeType: mimeType,
          fileName: file.name,
        });
      }

      if (!extracted || typeof extracted.monto_total_acumulado === 'undefined') {
        throw new Error('El modelo de IA no devolvió los datos en el formato esperado.');
      }

      setResultadoActual(extracted);

      const newItem: ItemHistorial = {
        id: `item-${Date.now()}`,
        nombreArchivo: file.name,
        tamanoArchivo: file.size,
        tipoMime: file.type || 'application/pdf',
        fechaAnalisis: new Date().toISOString(),
        resultado: extracted,
        rawJson: JSON.stringify(extracted, null, 2),
        user_id: user?.id || null,
        user_email: user?.email || null,
        facturado: false,
      };

      setHistorial((prev) => [newItem, ...prev]);

      // Direct client-side insert into Supabase
      if (user) {
        const payload = {
          origen_billetera: extracted.origen_billetera,
          fecha_periodo: extracted.fecha_periodo,
          monto_total_acumulado: Number(extracted.monto_total_acumulado),
          monto: Number(extracted.monto_total_acumulado),
          detalle_movimientos: extracted.detalle_movimientos,
          nombre_archivo: file.name,
          cuit: extracted.detalle_movimientos?.[0]?.pagador_nombre_cuit || 'Consumidor Final',
          concepto: extracted.detalle_movimientos?.[0]?.concepto || `Comprobante ${extracted.origen_billetera}`,
          user_id: user.id === 'demo-user-123' || user.isLocalSession ? null : user.id,
          user_email: user.email,
          facturado: false,
          created_at: new Date().toISOString(),
        };

        // Insert into receipts first, fallback to extractos
        supabase.from('receipts').insert([payload]).then(({ error }) => {
          if (error) {
            console.warn('Fallback insert a extractos:', error);
            supabase.from('extractos').insert([payload]).catch((e) => console.warn('extractos insert note:', e));
          }
        }).catch(() => {
          supabase.from('extractos').insert([payload]).catch((e) => console.warn('extractos fallback note:', e));
        });
      }
    } catch (err: any) {
      console.error('Error al analizar imagen/archivo con IA:', err);
      setAnalysisError(
        `Error al procesar el archivo con IA: ${err?.message || 'No se pudo extraer la información del comprobante.'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Analyze Text
  const handleAnalyzeText = async (text: string) => {
    setIsProcessing(true);
    setAnalysisError(null);
    setCurrentFileName('comprobante_texto.txt');

    try {
      const extracted = await analyzeComprobanteWithAI({
        rawText: text,
        fileName: 'texto_transferencia.txt',
        mimeType: 'text/plain',
      });

      if (!extracted || typeof extracted.monto_total_acumulado === 'undefined') {
        throw new Error('El modelo de IA no devolvió los datos en el formato esperado.');
      }

      setResultadoActual(extracted);

      const newItem: ItemHistorial = {
        id: `item-${Date.now()}`,
        nombreArchivo: 'Texto Comprobante / Extracto',
        tamanoArchivo: text.length,
        tipoMime: 'text/plain',
        fechaAnalisis: new Date().toISOString(),
        resultado: extracted,
        rawJson: JSON.stringify(extracted, null, 2),
        user_id: user?.id || null,
        user_email: user?.email || null,
        facturado: false,
      };

      setHistorial((prev) => [newItem, ...prev]);

      // Direct client insert into Supabase
      if (user) {
        const payload = {
          origen_billetera: extracted.origen_billetera,
          fecha_periodo: extracted.fecha_periodo,
          monto_total_acumulado: Number(extracted.monto_total_acumulado),
          monto: Number(extracted.monto_total_acumulado),
          detalle_movimientos: extracted.detalle_movimientos,
          nombre_archivo: 'Carga por Texto',
          cuit: extracted.detalle_movimientos?.[0]?.pagador_nombre_cuit || 'Consumidor Final',
          concepto: extracted.detalle_movimientos?.[0]?.concepto || `Texto ${extracted.origen_billetera}`,
          user_id: user.id === 'demo-user-123' || user.isLocalSession ? null : user.id,
          user_email: user.email,
          facturado: false,
          created_at: new Date().toISOString(),
        };

        supabase.from('receipts').insert([payload]).then(({ error }) => {
          if (error) {
            console.warn('Fallback insert a extractos:', error);
            supabase.from('extractos').insert([payload]).catch((e) => console.warn('extractos insert note:', e));
          }
        }).catch(() => {
          supabase.from('extractos').insert([payload]).catch((e) => console.warn('extractos fallback note:', e));
        });
      }
    } catch (err: any) {
      console.error('Error al analizar texto con IA:', err);
      setAnalysisError(
        `Error al procesar el texto con IA: ${err?.message || 'No se pudo analizar el contenido.'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectPreset = (preset: PresetSample) => {
    setActiveTab('analizador');
    if (preset.datosEjemplo.texto) {
      handleAnalyzeText(preset.datosEjemplo.texto);
    } else {
      setResultadoActual(preset.datosEjemplo.resultadoSimulado);
      setCurrentFileName(`Ejemplo_${preset.entidad}.txt`);
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
              <AuthScreen onAuthSuccess={handleAuthSuccess} onCancel={() => setActiveTab('analizador')} />
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

            {activeTab === 'panel_control' && user?.role === 'admin_contadora' && (
              <AdminPanel
                historial={historial}
                onToggleFacturado={handleToggleFacturado}
                onDeleteItem={handleDeleteItem}
                onResetClient={handleResetClient}
              />
            )}

            {activeTab === 'analizador' && (
              <div className="space-y-6">
                <UploadZone
                  onFileSelected={handleAnalyzeFile}
                  onTextSubmitted={handleAnalyzeText}
                  isProcessing={isProcessing}
                  user={user}
                  onGoToAuth={() => setActiveTab('auth')}
                  onGoToManual={() => setActiveTab('factura_manual')}
                />

                {/* Error Banner with Alternative Action Fallbacks */}
                {analysisError && (
                  <div className="p-4.5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-rose-800 animate-in fade-in duration-200 shadow-xs">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                          Error al procesar el comprobante
                        </h4>
                        <p className="text-xs text-rose-700 leading-relaxed">{analysisError}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setActiveTab('factura_manual')}
                        className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        Facturar por Texto / Manual
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnalysisError(null)}
                        className="p-1.5 text-rose-500 hover:text-rose-800 rounded-lg hover:bg-rose-100 transition-colors"
                        title="Descartar aviso"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Results Section */}
                {resultadoActual && (
                  <ResultCard
                    resultado={resultadoActual}
                    fileName={currentFileName}
                    onUpdateResultado={setResultadoActual}
                    user={user}
                    onGoToAuth={() => setActiveTab('auth')}
                  />
                )}
              </div>
            )}

            {activeTab === 'historial' && (
              <LedgerHistory
                historial={historial}
                onSelectHistorialItem={(item) => {
                  setResultadoActual(item.resultado);
                  setCurrentFileName(item.nombreArchivo);
                  setActiveTab('analizador');
                }}
                onDeleteItem={handleDeleteItem}
                onClearAll={handleClearHistorial}
              />
            )}

            {activeTab === 'presets' && <PresetsView onSelectPreset={handleSelectPreset} />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Cuentas Claras • Estudio Contable & Conciliación Impositiva</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Payway & POSNET</span>
            <span>•</span>
            <span>Mercado Pago & Bancos</span>
            <span>•</span>
            <span>AFIP / ARCA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
