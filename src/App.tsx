import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { ResultCard } from './components/ResultCard';
import { LedgerHistory } from './components/LedgerHistory';
import { PresetsView } from './components/PresetsView';
import { AuthScreen } from './components/AuthScreen';
import { AdminPanel } from './components/AdminPanel';
import { FacturaManualView } from './components/FacturaManualView';
import { ComprobanteResultado, ItemHistorial, UserRole } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';
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
  
  // Real history initialized to empty array (no fake samples)
  const [historial, setHistorial] = useState<ItemHistorial[]>([]);

  // Function to load extractos from Supabase / Storage
  const fetchExtractos = async (currentUser: any) => {
    if (!currentUser) {
      setHistorial([]);
      return;
    }

    try {
      const isContadora = currentUser.role === 'admin_contadora' && currentUser.email?.trim().toLowerCase() === 'ahilindalila94@gmail.com';
      
      let query = supabase.from('extractos').select('*');
      
      // If client, strictly filter only by their user_id
      if (!isContadora) {
        query = query.eq('user_id', currentUser.id);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.warn('Error al consultar extractos en Supabase:', error);
        return;
      }

      if (data && Array.isArray(data)) {
        const mapped: ItemHistorial[] = data.map((item: any) => ({
          id: item.id || item._local_id || `db-${Date.now()}-${Math.random()}`,
          nombreArchivo: item.nombre_archivo || 'extracto_bancario.pdf',
          tamanoArchivo: 0,
          tipoMime: 'application/pdf',
          fechaAnalisis: item.created_at || item._created_at || new Date().toISOString(),
          resultado: {
            origen_billetera: item.origen_billetera || 'No especificado',
            fecha_periodo: item.fecha_periodo || 'Periodo actual',
            monto_total_acumulado: Number(item.monto_total_acumulado) || 0,
            detalle_movimientos: Array.isArray(item.detalle_movimientos) ? item.detalle_movimientos : []
          },
          rawJson: JSON.stringify(item, null, 2),
          user_id: item.user_id,
          user_email: item.user_email,
          facturado: item.facturado || false
        }));

        setHistorial(mapped);
      }
    } catch (err) {
      console.error('Error fetching extractos:', err);
    }
  };

  // Auth Initialization on application mount
  useEffect(() => {
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
              role
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
              role
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
          role
        };
        setUser(authenticatedUser);
        fetchExtractos(authenticatedUser);
      } else if (!localStorage.getItem('local_supabase_session')) {
        setUser(null);
        setHistorial([]);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
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
    
    const userWithVerifiedRole = {
      ...authenticatedUser,
      email,
      role
    };

    setUser(userWithVerifiedRole);
    fetchExtractos(userWithVerifiedRole);
    
    if (role === 'admin_contadora') {
      setActiveTab('panel_control');
    } else {
      setActiveTab('analizador');
    }
  };

  // Toggle invoice status for Admin Contadora
  const handleToggleFacturado = async (id: string, currentStatus: boolean) => {
    setHistorial((prev) =>
      prev.map((item) => (item.id === id ? { ...item, facturado: !currentStatus } : item))
    );
    try {
      await supabase.from('extractos').update({ facturado: !currentStatus }).eq('id', id);
    } catch (e) {
      console.error('Error actualizando facturado:', e);
    }
  };

  // Delete an individual extract
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

  // Analyze File
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

      let requestBody: any = {
        fileName: file.name,
        mimeType: mimeType,
      };

      if (mimeType.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.csv')) {
        const text = await file.text();
        requestBody.rawText = text;
      } else {
        const base64 = await fileToBase64(file);
        requestBody.fileData = base64;
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || `Error en el servidor (HTTP ${response.status})`
        );
      }

      const extracted: ComprobanteResultado = await response.json();

      if (!extracted || typeof extracted.monto_total_acumulado === 'undefined') {
        throw new Error('El modelo de IA no devolvió los datos en el formato esperado.');
      }

      setResultadoActual(extracted);

      const newItem: ItemHistorial = {
        id: `item-${Date.now()}`,
        nombreArchivo: file.name,
        tamanoArchivo: file.size,
        tipoMime: file.type,
        fechaAnalisis: new Date().toISOString(),
        resultado: extracted,
        rawJson: JSON.stringify(extracted, null, 2),
        user_id: user?.id || null,
        user_email: user?.email || null,
        facturado: false
      };

      setHistorial((prev) => [newItem, ...prev]);

      // Auto-save to Supabase if logged in
      if (user) {
        const payload = {
          origen_billetera: extracted.origen_billetera,
          fecha_periodo: extracted.fecha_periodo,
          monto_total_acumulado: Number(extracted.monto_total_acumulado),
          detalle_movimientos: extracted.detalle_movimientos,
          nombre_archivo: file.name,
          user_id: (user.id === 'demo-user-123' || user.isLocalSession) ? null : user.id,
          user_email: user.email,
          facturado: false
        };
        supabase.from('extractos').insert([payload]).catch((err: any) => {
          console.warn('Auto insert note:', err);
        });
      }
    } catch (err: any) {
      console.error('Error al analizar imagen/archivo con IA:', err);
      setAnalysisError(
        `Error al procesar la imagen con IA: ${err?.message || 'No se pudo extraer la información del comprobante.'}`
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
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawText: text,
          fileName: 'texto_transferencia.txt',
          mimeType: 'text/plain',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || `Error en el servidor (HTTP ${response.status})`
        );
      }

      const extracted: ComprobanteResultado = await response.json();

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
        facturado: false
      };

      setHistorial((prev) => [newItem, ...prev]);

      // Auto-save to Supabase if logged in
      if (user) {
        const payload = {
          origen_billetera: extracted.origen_billetera,
          fecha_periodo: extracted.fecha_periodo,
          monto_total_acumulado: Number(extracted.monto_total_acumulado),
          detalle_movimientos: extracted.detalle_movimientos,
          nombre_archivo: 'Carga por Texto',
          user_id: (user.id === 'demo-user-123' || user.isLocalSession) ? null : user.id,
          user_email: user.email,
          facturado: false
        };
        supabase.from('extractos').insert([payload]).catch((err: any) => {
          console.warn('Auto insert note:', err);
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

  const handleSelectPreset = (preset: { nombre: string; contenido: string }) => {
    setActiveTab('analizador');
    handleAnalyzeText(preset.contenido);
  };

  const totalAcumuladoGeneral = historial.reduce(
    (acc, curr) => acc + (curr.resultado.monto_total_acumulado || 0),
    0
  );

  const isContadora = user?.role === 'admin_contadora' && user?.email?.trim().toLowerCase() === 'ahilindalila94@gmail.com';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* Top Bar Header */}
      <Header
        historialCount={historial.length}
        totalAcumuladoHistorial={totalAcumuladoGeneral}
        onClearHistorial={() => setHistorial([])}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        
        {/* Loading Auth State */}
        {isAuthLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-purple-500/20 border-t-purple-600 rounded-full animate-spin"></div>
          </div>
        )}

        {!isAuthLoading && (
          <>
            {/* View: Admin Control Panel (Contadora Only) */}
            {activeTab === 'panel_control' && isContadora && (
              <AdminPanel
                historial={historial}
                onToggleFacturado={handleToggleFacturado}
                onDeleteItem={handleDeleteItem}
                onResetClient={handleResetClient}
              />
            )}

            {/* View: Auth Screen */}
            {activeTab === 'auth' && (
              <AuthScreen
                onAuthSuccess={handleAuthSuccess}
              />
            )}

            {/* View: Manual Invoice Request */}
            {activeTab === 'factura_manual' && (
              <FacturaManualView
                user={user}
                onSuccess={() => {
                  fetchExtractos(user);
                  setActiveTab('historial');
                }}
              />
            )}

            {/* View: Presets */}
            {activeTab === 'presets' && (
              <PresetsView
                onSelectPreset={handleSelectPreset}
                isProcessing={isProcessing}
              />
            )}

            {/* View: History / Ledger */}
            {activeTab === 'historial' && (
              <LedgerHistory
                historial={historial}
                onClearAll={() => setHistorial([])}
                onDeleteItem={handleDeleteItem}
                onSelectHistorialItem={(item) => {
                  setResultadoActual(item.resultado);
                  setCurrentFileName(item.nombreArchivo);
                  setActiveTab('analizador');
                }}
              />
            )}

            {/* View: Analyzer (Client / Guest default) */}
            {activeTab === 'analizador' && (
              <div className="space-y-6">
                
                {/* Upload & Dropzone Area */}
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
                          Error al procesar la imagen con IA
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

                {/* Results Card */}
                {resultadoActual && (
                  <ResultCard
                    resultado={resultadoActual}
                    fileName={currentFileName}
                    user={user}
                    onGoToAuth={() => setActiveTab('auth')}
                    onUpdateResultado={(updated) => setResultadoActual(updated)}
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium">
            © {new Date().getFullYear()} Cuentas Claras Studio — Estudio Ahilin Torres
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Privacidad y Aislamiento de Datos AFIP</span>
            <span>•</span>
            <span>Versión 3.7</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
