import React, { useState } from 'react';
import { FileText, DollarSign, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FacturaManualViewProps {
  user: any;
  onSuccess: () => void;
}

export const FacturaManualView: React.FC<FacturaManualViewProps> = ({ user, onSuccess }) => {
  const [cuitRazonSocial, setCuitRazonSocial] = useState('');
  const [monto, setMonto] = useState('');
  const [conceptoNota, setConceptoNota] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    // Form Validations
    if (!cuitRazonSocial.trim() || !monto.trim() || !conceptoNota.trim()) {
      setMsg({ type: 'error', text: 'Por favor complete todos los campos obligatorios.' });
      return;
    }

    const numericMonto = parseFloat(monto);
    if (isNaN(numericMonto) || numericMonto <= 0) {
      setMsg({ type: 'error', text: 'Por favor ingrese un monto numérico válido mayor a cero.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const email = user?.email || 'cliente.anonimo@cuentasclaras.com';
      const userId = user?.id || null;

      const payload = {
        origen_billetera: 'Carga Manual / Factura',
        fecha_periodo: new Date().toLocaleDateString('es-AR', { month: '2-digit', year: 'numeric' }),
        monto_total_acumulado: numericMonto,
        detalle_movimientos: [
          {
            fecha: new Date().toISOString().split('T')[0],
            monto: numericMonto,
            pagador_nombre_cuit: `${cuitRazonSocial.trim()} (${conceptoNota.trim()})`
          }
        ],
        nombre_archivo: `Factura Manual - ${cuitRazonSocial.trim().substring(0, 24)}`,
        user_id: userId,
        user_email: email,
        facturado: false,
        created_at: new Date().toISOString()
      };

      // Save to Supabase Cloud Database directly
      const { error } = await supabase.from('extractos').insert([payload]);
      if (error) throw error;

      setMsg({ type: 'success', text: '¡Comprobante / Solicitud manual registrado con éxito en la nube!' });
      setCuitRazonSocial('');
      setMonto('');
      setConceptoNota('');
      
      setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (err: any) {
      console.error('Error al guardar solicitud manual en Supabase:', err);
      setMsg({ 
        type: 'error', 
        text: err?.message || 'Ocurrió un error al persistir la información en la base de datos.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
      <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
            Factura por Texto / Carga Manual
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registrá directamente operaciones sin comprobante adjunto para conciliar con la contadora.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {msg && (
          <div className={`p-4 rounded-2xl text-xs font-semibold border flex items-center gap-2.5 ${
            msg.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {/* 1. CUIT / Razón Social */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
            CUIT / Razón Social <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <User className="w-4 h-4" />
            </span>
            <input
              type="text"
              required
              placeholder="Ej: 20-34981290-3 o Perez Construcciones S.A."
              value={cuitRazonSocial}
              onChange={(e) => setCuitRazonSocial(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-900 outline-hidden"
            />
          </div>
        </div>

        {/* 2. Monto ($) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
            Monto ($) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-xs">
              <DollarSign className="w-4 h-4" />
            </span>
            <input
              type="number"
              step="any"
              required
              placeholder="Ej: 75000"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-900 outline-hidden"
            />
          </div>
        </div>

        {/* 3. Concepto / Nota */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
            Concepto / Nota <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            placeholder="Ej: Honorarios profesionales del mes o Venta de mercadería según presupuesto #104"
            value={conceptoNota}
            onChange={(e) => setConceptoNota(e.target.value)}
            className="w-full p-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-900 outline-hidden resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Guardando en la nube...</span>
            </>
          ) : (
            <span>Guardar y Enviar a la Contadora</span>
          )}
        </button>
      </form>
    </div>
  );
};
