import React, { useState } from 'react';
import {
  Trash2,
  FileSpreadsheet,
  Download,
  Calendar,
  Building2,
  ExternalLink,
  Search,
  Receipt,
  Layers,
  ArrowRight,
  TrendingUp,
  FileCheck,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { ItemHistorial, FacturaArca } from '../types';
import { formatCurrencyARS, exportCombinedToCSV, downloadJsonFile } from '../utils/formatters';
import { FacturasArcaList } from './FacturasArcaList';

interface LedgerHistoryProps {
  historial: ItemHistorial[];
  facturasArca?: FacturaArca[];
  onSelectHistorialItem: (item: ItemHistorial) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export const LedgerHistory: React.FC<LedgerHistoryProps> = ({
  historial,
  facturasArca = [],
  onSelectHistorialItem,
  onDeleteItem,
  onClearAll,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const totalGeneral = historial.reduce(
    (acc, curr) => acc + (curr.resultado.monto_total_acumulado || 0),
    0
  );

  const totalFacturado = historial
    .filter((h) => h.facturado)
    .reduce((acc, curr) => acc + (curr.resultado.monto_total_acumulado || 0), 0);

  const totalPendiente = totalGeneral - totalFacturado;

  const totalMovimientos = historial.reduce(
    (acc, curr) => acc + (curr.resultado.detalle_movimientos?.length || 0),
    0
  );

  const filteredItems = historial.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      item.nombreArchivo.toLowerCase().includes(term) ||
      item.resultado.origen_billetera.toLowerCase().includes(term) ||
      item.resultado.fecha_periodo.toLowerCase().includes(term) ||
      item.resultado.detalle_movimientos?.some((m) =>
        (m.concepto || '').toLowerCase().includes(term) ||
        (m.rubro_concepto || '').toLowerCase().includes(term)
      )
    );
  });

  const handleExportAllJson = () => {
    const allData = historial.map((h) => h.resultado);
    downloadJsonFile(allData, 'todos_los_comprobantes_analizados.json');
  };

  const handleExportAllCsv = () => {
    const allData = historial.map((h) => h.resultado);
    exportCombinedToCSV(allData, 'libro_contable_acumulado.csv');
  };

  return (
    <div className="space-y-6">
      {/* Official ARCA Invoices from Accountant Section */}
      <div className="bg-white rounded-2xl border border-emerald-200/90 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Mis Facturas Oficiales de ARCA</span>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                  Emitidas por tu Contadora
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Descargá directamente en PDF las facturas de AFIP / ARCA ya emitidas sobre tus comprobantes y cupones.
              </p>
            </div>
          </div>
        </div>

        <FacturasArcaList facturas={facturasArca} isAdmin={false} />
      </div>

      {/* Header & Metrics */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              <span>Mis Comprobantes y Cupones Cargados</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Estado de facturación de tus comprobantes, cierres de lote y cupones POS
            </p>
          </div>

          {historial.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportAllCsv}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exportar (CSV)</span>
              </button>

              <button
                type="button"
                onClick={handleExportAllJson}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar (JSON)</span>
              </button>

              <button
                type="button"
                onClick={onClearAll}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Vaciar historial"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80">
            <span className="text-xs font-semibold text-slate-500 block mb-1">
              Monto Total Cargado
            </span>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {formatCurrencyARS(totalGeneral)}
            </p>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {historial.length} comprobante(s) registrado(s)
            </span>
          </div>

          <div className="bg-amber-50/70 rounded-xl p-4 border border-amber-200/80">
            <span className="text-xs font-bold text-amber-800 block mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Pendiente de Facturar
            </span>
            <p className="text-xl sm:text-2xl font-black text-amber-700">
              {formatCurrencyARS(totalPendiente)}
            </p>
            <span className="text-[11px] text-amber-600 mt-1 block">
              En proceso por tu contadora
            </span>
          </div>

          <div className="bg-emerald-50/70 rounded-xl p-4 border border-emerald-200/80">
            <span className="text-xs font-bold text-emerald-800 block mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ya Facturado por Contadora
            </span>
            <p className="text-xl sm:text-2xl font-black text-emerald-700">
              {formatCurrencyARS(totalFacturado)}
            </p>
            <span className="text-[11px] text-emerald-600 mt-1 block">
              Factura oficial disponible arriba
            </span>
          </div>
        </div>
      </div>

      {/* History List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar en historial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <span className="text-xs text-slate-500">
            {filteredItems.length} comprobante(s)
          </span>
        </div>

        {filteredItems.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item, index) => (
              <div
                key={`${item.id || 'item'}-${index}`}
                className="p-4 sm:p-5 hover:bg-slate-50/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {item.resultado.origen_billetera}
                      </span>
                      <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {item.resultado.fecha_periodo}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      {item.nombreArchivo}
                    </p>
                    <span className="text-[11px] text-slate-400">
                      {item.resultado.detalle_movimientos.length} movimiento(s) • Analizado {new Date(item.fechaAnalisis).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                    <span className="text-base font-black text-emerald-700 font-mono">
                      {formatCurrencyARS(item.resultado.monto_total_acumulado)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectHistorialItem(item)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1"
                    >
                      <span>Ver Detalle & JSON</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400">
            <Layers className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Aún no hay comprobantes en el historial</p>
            <p className="text-xs text-slate-400 mt-1">
              Carga una foto, comprobante o probá los ejemplos para empezar a registrar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
