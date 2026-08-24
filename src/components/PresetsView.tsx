import React from 'react';
import {
  Layers,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Building2,
  Zap,
  CreditCard,
  Smartphone
} from 'lucide-react';
import { SAMPLES } from '../data/samples';
import { PresetSample } from '../types';
import { formatCurrencyARS } from '../utils/formatters';

interface PresetsViewProps {
  onSelectPreset: (sample: PresetSample) => void;
}

export const PresetsView: React.FC<PresetsViewProps> = ({ onSelectPreset }) => {
  const getIcon = (entidad: string) => {
    switch (entidad) {
      case 'Mercado Pago':
        return <Smartphone className="w-5 h-5 text-sky-600" />;
      case 'Naranja X':
        return <Zap className="w-5 h-5 text-orange-600" />;
      case 'Ualá':
        return <CreditCard className="w-5 h-5 text-rose-600" />;
      default:
        return <Building2 className="w-5 h-5 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-600" />
          <span>Comprobantes y Extractos de Ejemplo</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Hacé clic en cualquiera de estos ejemplos reales de billeteras argentinas para probar la extracción automática y ver el objeto JSON generado.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {SAMPLES.map((sample) => (
          <div
            key={sample.id}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                    {getIcon(sample.entidad)}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {sample.entidad}
                    </span>
                    <span className="text-[11px] text-slate-500 capitalize">
                      {sample.tipo.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  {formatCurrencyARS(sample.datosEjemplo.resultadoSimulado.monto_total_acumulado)}
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-900 mb-1">
                {sample.titulo}
              </h3>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                {sample.descripcion}
              </p>

              {/* Sample preview box */}
              <div className="bg-slate-50 rounded-xl p-3 text-[11px] font-mono text-slate-600 border border-slate-200/80 mb-4 max-h-28 overflow-y-auto whitespace-pre-line">
                {sample.datosEjemplo.texto}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectPreset(sample)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cargar y Extraer JSON</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
