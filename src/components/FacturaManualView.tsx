import React, { useState } from 'react';
import { FileText, DollarSign, User, CheckCircle2, AlertCircle, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FacturaManualViewProps {
  user: any;
  onSuccess: () => void;
}

export const FacturaManualView: React.FC<FacturaManualViewProps> = ({ user, onSuccess }) => {
  const [esConsumidorFinal, setEsConsumidorFinal] = useState(false);
  const [cuitRazonSocial, setCuitRazonSocial] = useState('');
  const [monto, setMonto] = useState('');
  const [conceptoNota, setConceptoNota] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleToggleConsumidorFinal = (checked: boolean) => {
    setEsConsumidorFinal(checked);
    if (checked) {
      setCuitRazonSocial('Consumidor Final');
    } else {
      if (cuitRazonSocial === 'Consumidor Final') {
        setCuitRazonSocial('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const finalCuit = esConsumidorFinal ? 'Consumidor Final' : cuitRazonSocial.trim();

    // Form Validations
    if (!finalCuit || !monto.trim() || !conceptoNota.trim()) {
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
            pagador_nombre_cuit: `${finalCuit} (${conceptoNota.trim()})`,
            tipo_operacion: 'factura_manual',
            es_consumidor_final: esConsumidorFinal,
          },
        ],
        nombre_archivo: `Factura Manual - ${finalCuit.substring(0, 24)}`,
        user_id: userId,
        user_email: email,
        facturado: false,
        created_at: new Date().toISOString(),
      };

      // Direct client insert into Supabase table 'extractos'
      const { error } = await supabase.from('extractos').insert([payload]);
      if (error) throw error;

      setMsg({ type: 'success', text: '¡Comprobante / Solicitud manual registrado con éxito en Supabase!' });
      if (!esConsumidorFinal) {
        setCuitRazonSocial('');
      }
      setMonto('');
      setConceptoNota('');

      setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (err: any) {
      console.error('Error al guardar solicitud manual en Supabase:', err);
      setMsg({
        type: 'error',
        text: err?.message || 'Ocurrió un error al persistir la información en la base de datos.',
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
            Registrá ventas, tickets o transferencias sin comprobante adjunto para conciliar con la contadora.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {msg && (
          <div
            className={`p-4 rounded-2xl text-xs font-semibold border flex items-center gap-2.5 ${
              msg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Consumidor Final Switch / Checkbox */}
        <div className="p-3.5 bg-purple-50/60 border border-purple-200/70 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-purple-950">Facturar a Consumidor Final</p>
              <p className="text-[11px] text-purple-700">Autocompleta CUIT/Razón Social sin datos fiscales</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              id="switch-consumidor-final"
              checked={esConsumidorFinal}
              onChange={(e) => handleToggleConsumidorFinal(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

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
              disabled={esConsumidorFinal}
              placeholder={esConsumidorFinal ? 'Consumidor Final' : 'Ej: 20-34981290-3 o Perez Construcciones S.A.'}
              value={esConsumidorFinal ? 'Consumidor Final' : cuitRazonSocial}
              onChange={(e) => setCuitRazonSocial(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-900 outline-hidden ${
                esConsumidorFinal
                  ? 'border-purple-200 bg-purple-50/40 text-purple-900 font-bold cursor-not-allowed'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
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
            placeholder="Ej: Venta en mostrador, Honorarios o Cobro POSNET cupón #492"
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
              <span>Guardando en Supabase...</span>
            </>
          ) : (
            <span>Guardar y Enviar a la Contadora</span>
          )}
        </button>
      </form>
    </div>
  );
};
