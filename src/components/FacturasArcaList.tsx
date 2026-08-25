import React, { useState } from 'react';
import {
  FileText,
  Download,
  Eye,
  Trash2,
  Calendar,
  DollarSign,
  CheckCircle2,
  Building2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  X
} from 'lucide-react';
import { FacturaArca } from '../types';
import { formatCurrencyARS } from '../utils/formatters';

interface FacturasArcaListProps {
  facturas: FacturaArca[];
  onDeleteFactura?: (id: string) => Promise<void>;
  isContadora?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
}

export const FacturasArcaList: React.FC<FacturasArcaListProps> = ({
  facturas,
  onDeleteFactura,
  isContadora = false,
  emptyTitle = 'No hay Facturas ARCA emitidas aún',
  emptySubtitle = 'Cuando la contadora emita la factura oficial en AFIP / ARCA y la cargue al sistema, aparecerá acá para su descarga inmediata.',
}) => {
  const [previewFactura, setPreviewFactura] = useState<FacturaArca | null>(null);

  const handleDownload = (factura: FacturaArca) => {
    if (!factura.archivo_url) {
      alert('El archivo no está disponible.');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = factura.archivo_url;
      link.download = factura.archivo_nombre || `Factura_ARCA_${factura.numero_factura || 'oficial'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      // Fallback open
      window.open(factura.archivo_url, '_blank');
    }
  };

  if (facturas.length === 0) {
    return (
      <div className="bg-white border border-dashed border-purple-200/90 rounded-2xl p-6 sm:p-8 text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
          <FileText className="w-6 h-6" />
        </div>
        <h4 className="text-xs sm:text-sm font-bold text-slate-800">{emptyTitle}</h4>
        <p className="text-[11px] sm:text-xs text-slate-500 max-w-md mx-auto">{emptySubtitle}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Facturas Cards */}
      <div className="grid grid-cols-1 gap-3">
        {facturas.map((f) => (
          <div
            key={f.id}
            className="bg-white border border-purple-200/80 hover:border-purple-300 rounded-2xl p-4 sm:p-5 shadow-3xs hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden"
          >
            {/* Top Accent Strip */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500"></div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Facturado Oficial ARCA
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100 rounded-md">
                  {f.tipo_factura || 'Factura C'}
                </span>
                {f.periodo && (
                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" /> Período: {f.periodo}
                  </span>
                )}
                {isContadora && f.client_email && (
                  <span className="text-[10px] font-mono text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md">
                    Para: {f.client_email}
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5 break-all">
                  <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>{f.numero_factura || 'Factura Oficial ARCA'}</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Archivo: <span className="font-mono text-slate-700 font-semibold">{f.archivo_nombre}</span>
                </p>
              </div>

              {/* CAE Details if available */}
              {(f.cae || f.vencimiento_cae) && (
                <div className="text-[11px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 flex flex-wrap items-center gap-3">
                  {f.cae && (
                    <span>
                      CAE: <strong className="font-mono text-slate-800">{f.cae}</strong>
                    </span>
                  )}
                  {f.vencimiento_cae && (
                    <span>
                      Vto CAE: <strong>{f.vencimiento_cae}</strong>
                    </span>
                  )}
                </div>
              )}

              {/* Contadora comment */}
              {f.comentario_contadora && (
                <p className="text-[11px] text-purple-900 bg-purple-50/50 px-3 py-1.5 rounded-xl border border-purple-100 italic">
                  "{f.comentario_contadora}"
                </p>
              )}

              <p className="text-[10px] text-slate-400">
                Emitida el: {new Date(f.fecha_emision || f.created_at).toLocaleDateString('es-AR')} • Estudio Ahilin Torres
              </p>
            </div>

            {/* Right side: Amount & Download Action */}
            <div className="flex items-center justify-between md:justify-end gap-5 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
              <div className="text-left md:text-right">
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                  Monto Facturado
                </span>
                <span className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                  {formatCurrencyARS(f.monto_total || 0)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Download Button */}
                <button
                  type="button"
                  onClick={() => handleDownload(f)}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  title="Descargar comprobante en PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar PDF</span>
                </button>

                {/* View Preview Button */}
                <button
                  type="button"
                  onClick={() => setPreviewFactura(f)}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                  title="Ver vista previa"
                >
                  <Eye className="w-4 h-4" />
                </button>

                {/* Delete button (only for contadora) */}
                {isContadora && onDeleteFactura && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`¿Desea eliminar la factura ARCA ${f.numero_factura}?`)) {
                        onDeleteFactura(f.id);
                      }
                    }}
                    className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200/60 transition-all cursor-pointer"
                    title="Eliminar factura ARCA"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* PDF / File Preview Modal */}
      {previewFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{previewFactura.numero_factura}</h3>
                  <p className="text-[11px] text-slate-500">
                    {previewFactura.tipo_factura} • {previewFactura.periodo} • {formatCurrencyARS(previewFactura.monto_total)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(previewFactura)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFactura(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 bg-slate-100 overflow-y-auto min-h-[400px] flex items-center justify-center">
              {previewFactura.archivo_url.startsWith('data:application/pdf') || previewFactura.archivo_nombre.endsWith('.pdf') ? (
                <iframe
                  src={previewFactura.archivo_url}
                  className="w-full h-[65vh] rounded-xl border border-slate-300 bg-white"
                  title={previewFactura.numero_factura}
                />
              ) : previewFactura.archivo_url.startsWith('data:image') || previewFactura.archivo_url.startsWith('http') ? (
                <img
                  src={previewFactura.archivo_url}
                  alt={previewFactura.numero_factura}
                  className="max-h-[65vh] object-contain rounded-xl shadow-md border border-slate-200"
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">{previewFactura.archivo_nombre}</p>
                  <button
                    onClick={() => handleDownload(previewFactura)}
                    className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl"
                  >
                    Descargar Archivo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
