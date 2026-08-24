import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  DollarSign,
  Users,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Database,
  CloudLightning,
  Check,
  AlertCircle
} from 'lucide-react';
import { ComprobanteResultado } from '../types';
import { formatCurrencyARS, exportToCSV } from '../utils/formatters';
import { JsonViewer } from './JsonViewer';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface ResultCardProps {
  resultado: ComprobanteResultado;
  fileName?: string;
  onUpdateResultado?: (updated: ComprobanteResultado) => void;
  user: any;
  onGoToAuth: () => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  resultado,
  fileName,
  onUpdateResultado,
  user,
  onGoToAuth,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'visual' | 'json'>('visual');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  const isConfigured = isSupabaseConfigured();

  const handleSaveToSupabase = async () => {
    if (!user) {
      onGoToAuth();
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');
    setSaveError(null);
    setIsOfflineSaved(false);

    try {
      // Prepare payload to insert in table 'extractos'
      const payload = {
        origen_billetera: resultado.origen_billetera,
        fecha_periodo: resultado.fecha_periodo,
        monto_total_acumulado: Number(resultado.monto_total_acumulado),
        detalle_movimientos: resultado.detalle_movimientos,
        nombre_archivo: fileName || 'comprobante_analizado.txt',
        user_id: (user.id === 'demo-user-123' || user.isLocalSession) ? null : user.id, // Keep null for local/demo user if not connected to real DB
        user_email: user?.email || 'cliente.demo@contasimpl.com',
        facturado: false
      };

      if (!isConfigured) {
        // Fallback to local storage when not configured
        const unsyncedStr = localStorage.getItem('local_unsynced_extractos') || '[]';
        const unsynced = JSON.parse(unsyncedStr);
        unsynced.push({
          ...payload,
          _local_id: 'local_ext_' + Date.now(),
          _synced: false,
          _created_at: new Date().toISOString()
        });
        localStorage.setItem('local_unsynced_extractos', JSON.stringify(unsynced));
        
        setIsOfflineSaved(true);
        setSaveStatus('success');
        return;
      }

      console.log('Insertando datos en tabla "extractos":', payload);
      const res = await supabase
        .from('extractos')
        .insert([payload]);

      if (res.error) {
        throw res.error;
      }

      if ((res as any).isOfflineSave) {
        setIsOfflineSaved(true);
      } else {
        setIsOfflineSaved(false);
      }
      setSaveStatus('success');
    } catch (err: any) {
      console.error('Error guardando en Supabase:', err);
      setSaveError(err?.message || 'Error al guardar en la tabla extractos de Supabase.');
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };


  const filteredMovimientos = resultado.detalle_movimientos.filter((mov) => {
    const term = searchTerm.toLowerCase();
    return (
      mov.pagador_nombre_cuit.toLowerCase().includes(term) ||
      mov.fecha.toLowerCase().includes(term) ||
      mov.monto.toString().includes(term)
    );
  });

  const getEntityBadgeColor = (origen: string) => {
    const org = origen.toLowerCase();
    if (org.includes('mercado pago')) return 'bg-sky-50 text-sky-700 border-sky-200';
    if (org.includes('naranja')) return 'bg-orange-50 text-orange-700 border-orange-200';
    if (org.includes('ualá') || org.includes('uala')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (org.includes('galicia')) return 'bg-amber-50 text-amber-800 border-amber-200';
    if (org.includes('santander')) return 'bg-red-50 text-red-700 border-red-200';
    if (org.includes('cuenta dni')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (org.includes('brubank')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getEntityBadgeColor(resultado.origen_billetera)} flex items-center gap-1.5`}>
                <Building2 className="w-3.5 h-3.5" />
                {resultado.origen_billetera}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {resultado.fecha_periodo}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>Resultado del Análisis Contable</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </h3>
            {fileName && (
              <p className="text-xs text-slate-400 mt-0.5">Archivo: {fileName}</p>
            )}
          </div>

          {/* Tab buttons: Visual Table vs Raw JSON */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              id="btn-vista-visual"
              onClick={() => setActiveSubTab('visual')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSubTab === 'visual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Vista Detallada
            </button>
            <button
              type="button"
              id="btn-vista-json"
              onClick={() => setActiveSubTab('json')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSubTab === 'json'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="font-mono text-[11px]">&lt;/&gt;</span>
              Objeto JSON
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">Monto Total Acumulado</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {formatCurrencyARS(resultado.monto_total_acumulado)}
            </p>
            <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" /> Total transferencias recibidas
            </span>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">Cantidad de Transferencias</span>
              <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {resultado.detalle_movimientos.length}
            </p>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Ingresos individuales registrados
            </span>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">Promedio por Ingreso</span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {formatCurrencyARS(
                resultado.detalle_movimientos.length > 0
                  ? resultado.monto_total_acumulado / resultado.detalle_movimientos.length
                  : 0
              )}
            </p>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Ticket promedio de cobro
            </span>
          </div>
        </div>
      </div>

      {/* Main Content: Table or JSON */}
      {activeSubTab === 'visual' ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 sm:p-5 bg-slate-50/50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por pagador, CUIT o fecha..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => exportToCSV(resultado)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs flex items-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exportar a Excel (CSV)</span>
              </button>

              <button
                type="button"
                id="btn-save-supabase"
                onClick={handleSaveToSupabase}
                disabled={isSaving}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all ${
                  saveStatus === 'success'
                    ? 'bg-teal-500 hover:bg-teal-600 text-white'
                    : saveStatus === 'error'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isSaving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : saveStatus === 'success' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Database className="w-3.5 h-3.5" />
                )}
                <span>
                  {isSaving
                    ? 'Guardando...'
                    : saveStatus === 'success'
                    ? '¡Guardado!'
                    : saveStatus === 'error'
                    ? 'Reintentar Guardado'
                    : 'Guardar en Supabase'}
                </span>
              </button>
            </div>
          </div>

          {saveStatus === 'error' && saveError && (
            <div className="mx-4 sm:mx-5 my-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {saveStatus === 'success' && (
            <div className={`mx-4 sm:mx-5 my-2 p-3 rounded-xl text-xs flex items-center gap-2 ${
              isOfflineSaved
                ? 'bg-amber-50 border border-amber-200 text-amber-800'
                : 'bg-teal-50 border border-teal-200 text-teal-800'
            }`}>
              {isOfflineSaved ? (
                <>
                  <CloudLightning className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                  <span><strong>¡Guardado localmente de forma persistente!</strong> Debido a inconvenientes de red/CORS, tus datos se han guardado de manera segura en el almacenamiento de tu navegador. Se sincronizarán automáticamente con Supabase en cuanto se restablezca la conexión.</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Los datos han sido guardados correctamente en la tabla 'extractos' de Supabase.</span>
                </>
              )}
            </div>
          )}


          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Pagador / CUIT</th>
                  <th className="py-3 px-4 text-right">Monto Recibido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovimientos.length > 0 ? (
                  filteredMovimientos.map((mov, index) => (
                    <tr
                      key={index}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                        {mov.fecha}
                      </td>
                      <td className="py-3.5 px-4 text-slate-900 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>{mov.pagador_nombre_cuit}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                        + {formatCurrencyARS(mov.monto)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No se encontraron movimientos coincidentes con "{searchTerm}".
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                  <td colSpan={3} className="py-3.5 px-4 text-right">
                    TOTAL GENERAL ACUMULADO:
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-emerald-700 text-sm sm:text-base font-black">
                    {formatCurrencyARS(resultado.monto_total_acumulado)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <JsonViewer resultado={resultado} />
      )}
    </div>
  );
};
