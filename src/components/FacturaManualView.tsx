import React, { useState } from 'react';
import { FileText, DollarSign, User, HelpCircle, CheckCircle2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatCurrencyARS } from '../utils/formatters';

interface FacturaManualViewProps {
  user: any;
  onSuccess: () => void;
}

export const FacturaManualView: React.FC<FacturaManualViewProps> = ({ user, onSuccess }) => {
  const [cuit, setCuit] = useState('');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    // Basic Validations
    if (!cuit.trim() || !monto.trim() || !concepto.trim()) {
      setMsg({ type: 'error', text: 'Por favor complete todos los campos obligatorios.' });
      return;
    }

    const numericMonto = parseFloat(monto);
    if (isNaN(numericMonto) || numericMonto <= 0) {
      setMsg({ type: 'error', text: 'Por favor ingrese un monto válido mayor a cero.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const email = user?.email || 'cliente.demo@contasimpl.com';
      const userId = (user?.id === 'demo-user-123' || user?.isLocalSession) ? null : user?.id;

      const payload = {
        origen_billetera: 'Carga Manual',
        fecha_periodo: new Date().toLocaleDateString('es-AR', { month: '2-digit', year: 'numeric' }),
        monto_total_acumulado: numericMonto,
        detalle_movimientos: [
          {
            fecha: new Date().toLocaleDateString('es-AR'),
            descripcion: concepto,
            referencia: `Destinatario: ${cuit}`,
            monto: numericMonto
          }
        ],
        nombre_archivo: `Solicitud Manual - ${cuit.substring(0, 16)}`,
        user_id: userId,
        user_email: email,
        facturado: false
      };

      const isConfigured = isSupabaseConfigured();

      if (!isConfigured) {
        // Fallback to local storage
        const unsyncedStr = localStorage.getItem('local_unsynced_extractos') || '[]';
        const unsynced = JSON.parse(unsyncedStr);
        unsynced.push({
          ...payload,
          id: 'manual_' + Date.now(),
          _local_id: 'local_ext_' + Date.now(),
          _synced: false,
          _created_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
        localStorage.setItem('local_unsynced_extractos', JSON.stringify(unsynced));
        
        setMsg({ type: 'success', text: 'Solicitud guardada localmente de forma segura. Lista para ser procesada por tu contadora.' });
        setCuit('');
        setMonto('');
        setConcepto('');
        onSuccess();
        return;
      }

      // Save directly to Supabase
      const { error } = await supabase.from('extractos').insert([payload]);
      if (error) throw error;

      setMsg({ type: 'success', text: '¡Solicitud de facturación enviada con éxito a tu contadora!' });
      setCuit('');
      setMonto('');
      setConcepto('');
      onSuccess();
    } catch (err: any) {
      console.error('Error saving manual invoice:', err);
      setMsg({ type: 'error', text: err?.message || 'Error de red al intentar registrar la solicitud manual.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
      <div className="flex items-center gap-3 pb-5 border-b border-slate-100 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            Nueva Solicitud Manual de Facturación
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Carga un destinatario directo si no posees comprobante digital o captura de pantalla.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {msg && (
          <div className={`p-4 rounded-xl text-xs font-semibold border ${
            msg.type === 'success' 
              ? 'bg-purple-50 border-purple-200 text-purple-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <div className="flex items-center gap-2">
              {msg.type === 'success' && <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          </div>
        )}

        {/* Input: CUIT / Razón Social Destinatario */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            CUIT o Razón Social Destinatario <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <User className="w-4 h-4" />
            </span>
            <input
              type="text"
              required
              placeholder="Ej: 30-71400000-9 o Rossi SRL"
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-800 outline-hidden"
            />
          </div>
        </div>

        {/* Input: Monto */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Monto de la Operación ($) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">
              <DollarSign className="w-4 h-4" />
            </span>
            <input
              type="number"
              step="any"
              required
              placeholder="Ej: 15500"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-800 outline-hidden"
            />
          </div>
        </div>

        {/* Input: Concepto */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Concepto o Descripción <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Ej: Honorarios profesionales agosto o Venta de insumos"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-800 outline-hidden"
          />
        </div>

        {/* Information Box */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-[11px] font-bold text-slate-700">Integración con Panel Contable</h4>
            <p className="text-[10px] text-slate-500 leading-normal">
              Al guardar esta solicitud, figurará automáticamente en la bandeja de entrada de tu contadora como un registro manual pendiente de liquidación y facturación impositiva.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white disabled:bg-slate-300 disabled:text-slate-500 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Registrando solicitud...</span>
            </>
          ) : (
            <span>Registrar Solicitud en Panel Contadora</span>
          )}
        </button>
      </form>
    </div>
  );
};
