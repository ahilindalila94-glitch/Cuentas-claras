import React, { useState } from 'react';
import { 
  FileText, 
  DollarSign, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Hash, 
  CreditCard, 
  Layers, 
  Receipt,
  Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FacturaManualViewProps {
  user: any;
  onSuccess: () => void;
}

export type TipoComprobante = 'Factura' | 'Cupón POS' | 'Cierre de Lote';

export const FacturaManualView: React.FC<FacturaManualViewProps> = ({ user, onSuccess }) => {
  const [tipoComprobante, setTipoComprobante] = useState<TipoComprobante>('Factura');
  const [esConsumidorFinal, setEsConsumidorFinal] = useState(false);
  const [cuitRazonSocial, setCuitRazonSocial] = useState('');
  const [monto, setMonto] = useState('');
  const [conceptoLote, setConceptoLote] = useState('');
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

  const parseMontoInput = (val: string): number => {
    if (!val) return 0;
    let cleaned = val.trim();
    // Remove currency symbols, extra spaces
    cleaned = cleaned.replace(/[$ARS\s]/gi, '');
    if (cleaned.includes('.') && cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    }
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setMsg(null);

    const finalCuit = esConsumidorFinal ? 'Consumidor Final' : (cuitRazonSocial.trim() || 'Consumidor Final');
    const finalConcepto = conceptoLote.trim();

    // Validations
    if (!finalCuit || !monto.trim() || !finalConcepto) {
      setMsg({ type: 'error', text: 'Por favor complete todos los campos obligatorios del formulario.' });
      return;
    }

    const numericMonto = parseMontoInput(monto);
    if (numericMonto <= 0) {
      setMsg({ type: 'error', text: 'Por favor ingrese un monto válido mayor a 0 (ej: 45000 o 1500,50).' });
      return;
    }

    setIsSubmitting(true);

    try {
      const email = user?.email || 'cliente@cuentasclaras.com';
      const userId = user?.id && !user?.isLocalSession && user?.id !== 'demo-user-123' ? user.id : null;

      // Determine standard internal operation type
      let tipoOperacion = 'factura_manual';
      if (tipoComprobante === 'Cupón POS') tipoOperacion = 'cupon_individual';
      if (tipoComprobante === 'Cierre de Lote') tipoOperacion = 'cierre_lote';

      const recordPayload = {
        cuit: finalCuit,
        monto: numericMonto,
        concepto: `${tipoComprobante}: ${finalConcepto}`,
        pagador_nombre_cuit: finalCuit,
        origen_billetera: tipoComprobante,
        tipo_comprobante: tipoOperacion,
        fecha_periodo: new Date().toLocaleDateString('es-AR', { month: '2-digit', year: 'numeric' }),
        monto_total_acumulado: numericMonto,
        detalle_movimientos: [
          {
            fecha: new Date().toISOString().split('T')[0],
            monto: numericMonto,
            pagador_nombre_cuit: finalCuit,
            concepto: finalConcepto,
            tipo_operacion: tipoOperacion,
            es_consumidor_final: esConsumidorFinal,
          },
        ],
        nombre_archivo: `${tipoComprobante} - ${finalCuit.substring(0, 24)}`,
        user_id: userId,
        user_email: email,
        facturado: false,
        created_at: new Date().toISOString(),
      };

      console.log('Enviando comprobante a Supabase receipts:', recordPayload);

      // Direct insert into receipts table
      const { error: receiptsError } = await supabase.from('receipts').insert([recordPayload]);
      if (receiptsError) {
        console.warn('Aviso en receipts, intentando fallback en extractos:', receiptsError);
        const { error: extractosError } = await supabase.from('extractos').insert([recordPayload]);
        if (extractosError) {
          console.error('Error insertando en base de datos:', extractosError);
          throw extractosError;
        }
      }

      setMsg({ 
        type: 'success', 
        text: `¡${tipoComprobante} guardado con éxito! Se ha sincronizado para la contadora.` 
      });
      
      if (!esConsumidorFinal) {
        setCuitRazonSocial('');
      }
      setMonto('');
      setConceptoLote('');

      // Reload lists and notify parent
      onSuccess();
    } catch (err: any) {
      console.error('Error al guardar comprobante:', err);
      setMsg({
        type: 'error',
        text: err?.message || 'Ocurrió un error al persistir la información en la base de datos.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
      
      {/* Header Title */}
      <div className="flex items-center gap-3.5 pb-6 border-b border-slate-100 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
          <Receipt className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Carga Manual de Comprobantes / Cierre de Lote
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registrá de forma directa tus ventas, cupones POS y cierres de lote para conciliar con la contadora.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Feedback Message */}
        {msg && (
          <div
            className={`p-4 rounded-2xl text-xs font-semibold border flex items-center gap-2.5 ${
              msg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {/* 1. Tipo de Comprobante Selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
            1. Tipo de Comprobante <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { id: 'Factura' as TipoComprobante, label: 'Factura', icon: FileText, desc: 'Venta o servicio directo' },
              { id: 'Cupón POS' as TipoComprobante, label: 'Cupón POS', icon: CreditCard, desc: 'Cobro Posnet/Payway' },
              { id: 'Cierre de Lote' as TipoComprobante, label: 'Cierre de Lote', icon: Layers, desc: 'Resumen total de terminal' },
            ].map((tipo) => {
              const Icon = tipo.icon;
              const isSelected = tipoComprobante === tipo.id;
              return (
                <button
                  key={tipo.id}
                  type="button"
                  onClick={() => setTipoComprobante(tipo.id)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-600/20 text-purple-950'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-purple-600' : 'text-slate-500'}`} />
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold">{tipo.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{tipo.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Checkbox Consumidor Final */}
        <div className="p-4 bg-purple-50/60 border border-purple-200/70 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-purple-950">Facturar a Consumidor Final</p>
              <p className="text-[11px] text-purple-700">Asigna automáticamente CUIT como "Consumidor Final"</p>
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
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {/* 3. CUIT / Razón Social */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
            2. CUIT / Razón Social <span className="text-rose-500">*</span>
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

        {/* 4. Monto ($) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
            3. Monto Total ($) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-xs">
              <DollarSign className="w-4 h-4" />
            </span>
            <input
              type="text"
              required
              placeholder="Ej: 75000 o 1500,50"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-900 outline-hidden"
            />
          </div>
        </div>

        {/* 5. Concepto / N° de Lote o Cupón */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
            4. Concepto / N° de Lote o Cupón <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 top-3 flex items-start text-slate-400">
              <Hash className="w-4 h-4" />
            </span>
            <textarea
              required
              rows={3}
              placeholder={
                tipoComprobante === 'Cierre de Lote'
                  ? 'Ej: Lote N° 045 terminal POSNET 8402, 18 operaciones'
                  : tipoComprobante === 'Cupón POS'
                  ? 'Ej: Cupón 235-0052, Tarjeta Visa Débito'
                  : 'Ej: Venta de mercadería en mostrador, Factura B'
              }
              value={conceptoLote}
              onChange={(e) => setConceptoLote(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-900 outline-hidden resize-none"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          id="btn-submit-comprobante"
          disabled={isSubmitting}
          className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Guardando en Supabase...</span>
            </>
          ) : (
            <span>Guardar Comprobante</span>
          )}
        </button>
      </form>
    </div>
  );
};
