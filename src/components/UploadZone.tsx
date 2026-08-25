import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileCheck2,
  X,
  Sparkles,
  Clipboard,
  FileUp,
  Image as ImageIcon,
  LogIn,
  FileText
} from 'lucide-react';

interface UploadZoneProps {
  onFileSelected: (file: File) => Promise<void>;
  onTextSubmitted: (text: string) => Promise<void>;
  isProcessing: boolean;
  user?: any;
  onGoToAuth?: () => void;
  onGoToManual?: () => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFileSelected,
  onTextSubmitted,
  isProcessing,
  user,
  onGoToAuth,
  onGoToManual,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeInputMode, setActiveInputMode] = useState<'archivo' | 'texto'>('archivo');
  const [rawText, setRawText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    try {
      if (activeInputMode === 'archivo' && selectedFile) {
        await onFileSelected(selectedFile);
      } else if (activeInputMode === 'texto' && rawText.trim()) {
        await onTextSubmitted(rawText.trim());
      }
    } catch (err) {
      console.error('Error al enviar comprobante:', err);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-4.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
            <span>Carga de Comprobantes y Extractos</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Soporta PDFs, JPG, JPEG, PNG de Mercado Pago, bancos y billeteras virtuales
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center bg-slate-200/70 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveInputMode('archivo')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeInputMode === 'archivo'
                ? 'bg-white text-purple-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Archivo / Foto / PDF
          </button>
          <button
            type="button"
            onClick={() => setActiveInputMode('texto')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeInputMode === 'texto'
                ? 'bg-white text-purple-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            Pegar Texto
          </button>
        </div>
      </div>

      <div className="p-6 sm:p-7">
        {!user && (
          <div className="mb-5 bg-purple-50/70 border border-purple-200/70 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <LogIn className="w-4 h-4" />
              </div>
              <p className="text-xs text-purple-900 font-semibold">
                Iniciá sesión para que tus comprobantes se sincronicen directamente en la nube con tu contadora.
              </p>
            </div>
            {onGoToAuth && (
              <button
                type="button"
                onClick={onGoToAuth}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs self-start sm:self-auto shrink-0"
              >
                Ingresar / Registrarme
              </button>
            )}
          </div>
        )}

        {activeInputMode === 'archivo' ? (
          <div>
            {!selectedFile ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 ${
                  dragActive
                    ? 'border-purple-500 bg-purple-50/40'
                    : 'border-slate-300 hover:border-purple-400 hover:bg-slate-50/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                  className="hidden"
                  onChange={handleChange}
                />

                <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100 shadow-xs">
                  <UploadCloud className="w-7 h-7" />
                </div>

                <p className="text-sm font-bold text-slate-800 mb-1">
                  Arrastrá acá tu comprobante o hacé clic para seleccionarlo
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  Mercado Pago, Naranja X, Ualá, Galicia, Santander, BBVA, Macro, Cuenta DNI, etc.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 font-semibold">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 flex items-center gap-1">
                    <FileUp className="w-3.5 h-3.5 text-purple-600" /> PDF
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-purple-600" /> JPG / JPEG
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-purple-600" /> PNG
                  </span>
                </div>
              </div>
            ) : (
              /* Selected File Preview Box */
              <div className="border border-slate-200 rounded-2xl p-4.5 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 w-full sm:w-auto">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Vista previa"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-8 h-8" />
                    </div>
                  )}

                  <div className="overflow-hidden">
                    <p className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-xs sm:max-w-md">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Documento'}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold mt-1">
                      <FileCheck2 className="w-3 h-3" /> Archivo listo para procesar
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={isProcessing}
                    className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                    title="Remover archivo"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isProcessing}
                    className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Analizando con Gemini...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Extraer Ingresos y JSON</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Raw Text Input Mode */
          <div className="space-y-3.5">
            <label className="block text-xs font-bold text-slate-700">
              Pegá el texto del comprobante, e-mail o extracto bancario:
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Ejemplo:\n¡Recibiste una transferencia en Mercado Pago!\nMonto: $ 45.000,00\nDe: Carlos Alberto Gomez - CUIT: 20-33445566-7\nFecha: 15/08/2026 18:30`}
              rows={5}
              className="w-full text-xs p-3.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono bg-slate-50/50 text-slate-900"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              {onGoToManual && (
                <button
                  type="button"
                  onClick={onGoToManual}
                  className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  ¿Preferís cargar los datos campo por campo? Ir a Carga Manual
                </button>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isProcessing || !rawText.trim()}
                className="ml-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analizando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Extraer Ingresos y JSON</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
