import React, { useState } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  Calendar,
  DollarSign,
  AlertCircle,
  Building2,
  Lock,
  FileCheck
} from 'lucide-react';
import { FacturaArca } from '../types';
import { formatCurrencyARS } from '../utils/formatters';

interface SubirFacturaArcaModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientEmail: string;
  clientName?: string;
  clientCuit?: string;
  pendingAmount?: number;
  onSaveFactura: (facturaData: Partial<FacturaArca>, markItemsAsFacturado?: boolean) => Promise<void>;
}

export const SubirFacturaArcaModal: React.FC<SubirFacturaArcaModalProps> = ({
  isOpen,
  onClose,
  clientEmail,
  clientName,
  clientCuit,
  pendingAmount = 0,
  onSaveFactura,
}) => {
  const [numeroFactura, setNumeroFactura] = useState('');
  const [tipoFactura, setTipoFactura] = useState('Factura C');
  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${meses[d.getMonth()]} ${d.getFullYear()}`;
  });
  const [montoTotal, setMontoTotal] = useState<string>(
    pendingAmount > 0 ? String(pendingAmount) : ''
  );
  const [cae, setCae] = useState('');
  const [vencimientoCae, setVencimientoCae] = useState('');
  const [comentario, setComentario] = useState('Factura oficial ARCA emitida por tu Estudio Contable Ahilin Torres.');
  const [markPendingAsFacturado, setMarkPendingAsFacturado] = useState(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSelectedFile(file);
    setFileName(file.name);

    // If invoice number is empty, suggest from filename
    if (!numeroFactura) {
      const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
      setNumeroFactura(`Factura ARCA - ${cleanName}`);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFileDataUrl(result);
    };
    reader.onerror = () => {
      setErrorMsg('Error al leer el archivo seleccionado.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientEmail) {
      setErrorMsg('El email del cliente es obligatorio.');
      return;
    }
    if (!fileDataUrl || !fileName) {
      setErrorMsg('Por favor seleccioná el archivo PDF de la Factura ARCA.');
      return;
    }

    const finalMonto = parseFloat(montoTotal) || pendingAmount || 0;

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      await onSaveFactura(
        {
          client_email: clientEmail.toLowerCase().trim(),
          numero_factura: numeroFactura || `Factura ARCA - ${periodo}`,
          tipo_factura: tipoFactura,
          periodo,
          fecha_emision: new Date().toISOString().slice(0, 10),
          monto_total: finalMonto,
          cae,
          vencimiento_cae: vencimientoCae,
          archivo_nombre: fileName,
          archivo_url: fileDataUrl,
          archivo_tipo: selectedFile?.type || 'application/pdf',
          comentario_contadora: comentario,
        },
        markPendingAsFacturado
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar la factura ARCA.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Subir Factura ARCA (AFIP)
              </h3>
              <p className="text-xs text-slate-500">
                El cliente podrá verla y descargarla automáticamente desde su perfil
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Client Destination Info */}
          <div className="p-4 bg-purple-50/70 border border-purple-100 rounded-2xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-purple-700">
                Destinatario (Cliente)
              </span>
              {pendingAmount > 0 && (
                <span className="text-xs font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-lg">
                  Pendiente: {formatCurrencyARS(pendingAmount)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900 break-all">{clientEmail}</span>
              {clientName && (
                <span className="text-[11px] bg-white text-slate-700 px-2 py-0.5 rounded-md font-semibold border border-purple-200">
                  {clientName}
                </span>
              )}
              {clientCuit && (
                <span className="text-[11px] bg-white text-purple-800 px-2 py-0.5 rounded-md font-mono font-semibold border border-purple-200">
                  CUIT: {clientCuit}
                </span>
              )}
            </div>
          </div>

          {/* File Upload Drop Area */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Archivo PDF de la Factura ARCA *
            </label>
            <div className="relative border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/30 rounded-2xl p-5 text-center transition-all">
              <input
                type="file"
                accept=".pdf,application/pdf,image/png,image/jpeg"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                required={!fileDataUrl}
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                {fileName ? (
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span>{fileName}</span>
                    </p>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                      ✓ Archivo cargado correctamente (Listo para enviar)
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      Hacé clic o arrastrá el PDF de la factura ARCA acá
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Formatos soportados: PDF, PNG, JPG (Máx 50MB)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tipo de Comprobante
              </label>
              <select
                value={tipoFactura}
                onChange={(e) => setTipoFactura(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-purple-500 outline-hidden"
              >
                <option value="Factura C">Factura C (Monotributo)</option>
                <option value="Factura B">Factura B (Resp. Inscripto a Consumidor)</option>
                <option value="Factura A">Factura A (Entre Resp. Inscriptos)</option>
                <option value="Factura M">Factura M</option>
                <option value="Recibo C">Recibo C</option>
                <option value="Comprobante Fiscal">Comprobante Fiscal Oficial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Número de Factura / Punto de Vta
              </label>
              <input
                type="text"
                placeholder="Ej: 00004-00001234"
                value={numeroFactura}
                onChange={(e) => setNumeroFactura(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-purple-500 outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Período Fiscal
              </label>
              <input
                type="text"
                placeholder="Ej: Agosto 2026"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-purple-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Monto Total Facturado ($ ARS) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={montoTotal}
                onChange={(e) => setMontoTotal(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:border-purple-500 outline-hidden font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                CAE (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: 74382910482910"
                value={cae}
                onChange={(e) => setCae(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-purple-500 outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Vto. CAE (Opcional)
              </label>
              <input
                type="date"
                value={vencimientoCae}
                onChange={(e) => setVencimientoCae(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-purple-500 outline-hidden"
              />
            </div>
          </div>

          {/* Comment for client */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mensaje o Nota de la Contadora para el Cliente
            </label>
            <input
              type="text"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-purple-500 outline-hidden"
            />
          </div>

          {/* Auto mark pending as facturado */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-emerald-950">
                Marcar comprobantes del cliente como "Facturados"
              </p>
              <p className="text-[10px] text-emerald-700">
                Pone al día el saldo pendiente del cliente en el panel
              </p>
            </div>
            <input
              type="checkbox"
              checked={markPendingAsFacturado}
              onChange={(e) => setMarkPendingAsFacturado(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing || !fileDataUrl}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              {isProcessing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Guardando y Notificando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Publicar Factura ARCA</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
