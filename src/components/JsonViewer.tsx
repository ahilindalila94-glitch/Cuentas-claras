import React, { useState } from 'react';
import { Copy, Check, Download, Code2, Sparkles, FileSpreadsheet } from 'lucide-react';
import { ComprobanteResultado } from '../types';
import { downloadJsonFile, exportToCSV } from '../utils/formatters';

interface JsonViewerProps {
  resultado: ComprobanteResultado;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ resultado }) => {
  const [copied, setCopied] = useState(false);

  // Exact JSON output format requested by the user
  const jsonString = JSON.stringify(resultado, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('No se pudo copiar al portapapeles', e);
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden flex flex-col">
      {/* Top action header */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            JSON Estricto Requerido
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            id="btn-copiar-json"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              copied
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                <span>¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar JSON</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => downloadJsonFile(resultado, `${resultado.origen_billetera.toLowerCase().replace(/\s+/g, '_')}_ingresos.json`)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1"
            title="Descargar archivo .json"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Descargar</span>
          </button>

          <button
            type="button"
            onClick={() => exportToCSV(resultado, `${resultado.origen_billetera.toLowerCase().replace(/\s+/g, '_')}_extracto.csv`)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 transition-colors flex items-center gap-1"
            title="Exportar a CSV para Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Excel / CSV</span>
          </button>
        </div>
      </div>

      {/* Code Editor Preview */}
      <div className="p-4 sm:p-5 font-mono text-xs sm:text-[13px] leading-relaxed overflow-x-auto text-emerald-300 selection:bg-emerald-800 selection:text-white max-h-[380px] overflow-y-auto">
        <pre className="text-slate-100 whitespace-pre font-mono">
          <code>
            {jsonString}
          </code>
        </pre>
      </div>

      <div className="px-4 py-2.5 bg-slate-950/50 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>Estructura JSON validada sin texto adicional</span>
        </div>
        <span>{resultado.detalle_movimientos?.length || 0} movimientos</span>
      </div>
    </div>
  );
};
