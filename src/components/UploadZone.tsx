import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  Camera,
  FileSpreadsheet,
  FileCheck2,
  X,
  AlertCircle,
  Sparkles,
  Clipboard,
  Layers
} from 'lucide-react';
import { SAMPLES } from '../data/samples';
import { PresetSample } from '../types';

interface UploadZoneProps {
  onAnalyzeFile: (file: File) => Promise<void>;
  onAnalyzeText: (text: string, title?: string) => Promise<void>;
  onLoadPreset: (sample: PresetSample) => void;
  onOpenCam: () => void;
  isLoading: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onAnalyzeFile,
  onAnalyzeText,
  onLoadPreset,
  onOpenCam,
  isLoading,
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
    if (activeInputMode === 'archivo' && selectedFile) {
      await onAnalyzeFile(selectedFile);
    } else if (activeInputMode === 'texto' && rawText.trim()) {
      await onAnalyzeText(rawText.trim());
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
            <span>Cargar Comprobante o Extracto</span>
          </h2>
          <p className="text-xs text-slate-500">
            Soporta fotos, capturas, resúmenes bancarios PDF o texto copiado
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center bg-slate-200/70 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveInputMode('archivo')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              activeInputMode === 'archivo'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Archivo / Foto / PDF
          </button>
          <button
            type="button"
            onClick={() => setActiveInputMode('texto')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
              activeInputMode === 'texto'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clipboard className="w-3 h-3" />
            Pegar Texto
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {activeInputMode === 'archivo' ? (
          <div>
            {!selectedFile ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                  dragActive
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  onChange={handleChange}
                />

                <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-xs">
                  <UploadCloud className="w-7 h-7" />
                </div>

                <p className="text-sm font-semibold text-slate-800 mb-1">
                  Arrastrá acá tu comprobante o hacé clic para explorar
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  Mercado Pago, Naranja X, Ualá, Cuenta DNI, Banco Galicia, Santander, BBVA, etc. (PNG, JPG, WEBP, PDF)
                </p>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCam();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-2xs transition-colors"
                  >
                    <Camera className="w-4 h-4 text-emerald-600" />
                    Sacar foto con cámara
                  </button>
                </div>
              </div>
            ) : (
              /* Selected File Preview Box */
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 w-full sm:w-auto">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Vista previa"
                      className="w-16 h-16 rounded-lg object-cover border border-slate-200 shadow-2xs shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-8 h-8" />
                    </div>
                  )}

                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-slate-800 truncate max-w-xs sm:max-w-md">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Documento'}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium mt-1">
                      <FileCheck2 className="w-3.5 h-3.5" /> Listo para procesar
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={isLoading}
                    className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
                    title="Remover archivo"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all"
                  >
                    {isLoading ? (
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
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Pegá el texto del comprobante, e-mail o extracto bancario:
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Ejemplo:\n¡Recibiste una transferencia en Mercado Pago!\nMonto: $ 45.000,00\nDe: Carlos Alberto Gomez - CUIT: 20-33445566-7\nFecha: 15/08/2026 18:30`}
              rows={5}
              className="w-full text-xs sm:text-sm p-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono bg-slate-50/50"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !rawText.trim()}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-all"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analizando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analizar Texto</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Quick Sample Presets Chips */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-600">
              O probá al instante con comprobantes argentinos de prueba:
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => onLoadPreset(sample)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200/80 text-slate-700 transition-all flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>{sample.entidad}</span>
                <span className="text-[10px] text-slate-400">({sample.tipo === 'comprobante_individual' ? 'Comprobante' : 'Extracto'})</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
