import React, { useState, useRef } from 'react';
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
  Check,
  Camera,
  Upload,
  Image as ImageIcon,
  X,
  Sparkles,
  Smartphone,
  FileUp,
  FileCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiUrl, apiFetch } from '../lib/apiConfig';

interface FacturaManualViewProps {
  user: any;
  onSuccess: () => void;
}

export type TipoComprobante = 'Factura' | 'Cupón POS' | 'Cierre de Lote';

export const FacturaManualView: React.FC<FacturaManualViewProps> = ({ user, onSuccess }) => {
  const [activeMode, setActiveMode] = useState<'foto' | 'manual'>('foto');
  const [tipoComprobante, setTipoComprobante] = useState<TipoComprobante>('Factura');
  const [esConsumidorFinal, setEsConsumidorFinal] = useState(false);
  const [cuitRazonSocial, setCuitRazonSocial] = useState('');
  const [monto, setMonto] = useState('');
  const [conceptoLote, setConceptoLote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Attached file state
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
    cleaned = cleaned.replace(/[$ARS\s]/gi, '');
    if (cleaned.includes('.') && cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    }
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachedFile(file);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachedPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachedPreview(null);
      }

      // Automatically offer AI extraction if in photo mode
      if (activeMode === 'foto') {
        analyzeFileWithAI(file);
      }
    }
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
    setAttachedPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const analyzeFileWithAI = async (file: File) => {
    setIsAnalyzingAi(true);
    setMsg(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await apiFetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileData: base64Data,
              fileName: file.name,
              mimeType: file.type || 'image/jpeg',
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const a = data.analysis || data;
            if (a) {
              if (a.monto_total_acumulado) {
                setMonto(String(a.monto_total_acumulado));
              }
              if (a.pagador_nombre_cuit) {
                setCuitRazonSocial(a.pagador_nombre_cuit);
                if (a.pagador_nombre_cuit.toLowerCase().includes('consumidor final')) {
                  setEsConsumidorFinal(true);
                }
              }
              if (a.tipo_comprobante === 'cupon_individual') {
                setTipoComprobante('Cupón POS');
                setConceptoLote(a.origen_billetera ? `Cupón POS (${a.origen_billetera})` : 'Cupón POS');
              } else if (a.tipo_comprobante === 'cierre_lote') {
                setTipoComprobante('Cierre de Lote');
                setConceptoLote(a.origen_billetera || 'Cierre de Lote Terminal');
              } else {
                setTipoComprobante('Factura');
                setConceptoLote(a.origen_billetera || 'Comprobante de Venta');
              }
              setMsg({
                type: 'success',
                text: '¡Datos detectados automáticamente por IA! Verificá y confirmá para enviar a la contadora.',
              });
            }
          }
        } catch (apiErr) {
          console.warn('Aviso procesando IA de comprobante:', apiErr);
        } finally {
          setIsAnalyzingAi(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error('Error leyendo archivo:', e);
      setIsAnalyzingAi(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setMsg(null);

    const finalCuit = esConsumidorFinal ? 'Consumidor Final' : (cuitRazonSocial.trim() || 'Consumidor Final');
    const finalConcepto = conceptoLote.trim() || `${tipoComprobante} - ${new Date().toLocaleDateString('es-AR')}`;

    const numericMonto = parseMontoInput(monto);
    if (numericMonto <= 0) {
      setMsg({ type: 'error', text: 'Por favor ingrese un monto válido mayor a $0 (ej: 45000 o 1500,50).' });
      return;
    }

    setIsSubmitting(true);

    try {
      const email = user?.email?.toLowerCase().trim() || 'cliente@cuentasclaras.com';
      const userId = user?.id && !user?.isLocalSession && user?.id !== 'demo-user-123' ? user.id : null;

      // Determine standard internal operation type
      let tipoOperacion = 'factura_manual';
      if (tipoComprobante === 'Cupón POS') tipoOperacion = 'cupon_individual';
      if (tipoComprobante === 'Cierre de Lote') tipoOperacion = 'cierre_lote';

      const recordId = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();

      const recordPayload = {
        id: recordId,
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
            fecha: nowIso.split('T')[0],
            monto: numericMonto,
            pagador_nombre_cuit: finalCuit,
            concepto: finalConcepto,
            tipo_operacion: tipoOperacion,
            es_consumidor_final: esConsumidorFinal,
          },
        ],
        nombre_archivo: attachedFile ? attachedFile.name : `${tipoComprobante} - ${finalCuit.substring(0, 24)}`,
        preview_url: attachedPreview || undefined,
        user_id: userId,
        user_email: email,
        facturado: false,
        created_at: nowIso,
      };

      console.log('[CLOUD PERSISTENCE] Enviando comprobante al backend central (/api/records):', {
        id: recordPayload.id,
        user_email: recordPayload.user_email,
        monto: recordPayload.monto,
        tipo: recordPayload.tipo_comprobante,
      });

      // 1. Primary Cloud Database Persistence (Authoritative Backend Storage)
      const srvRes = await apiFetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordPayload),
      });

      if (!srvRes.ok) {
        const errorText = await srvRes.text().catch(() => 'Error en el servidor');
        if (srvRes.status === 404 && errorText.includes('<!DOCTYPE')) {
          throw new Error('Error de conexión con el backend (404). Si estás usando Netlify, verificá que VITE_API_URL apunte al servidor backend.');
        }
        throw new Error(`Error en el servidor central (${srvRes.status}): ${errorText}`);
      }

      const srvJson = await srvRes.json();
      console.log('[CLOUD PERSISTENCE SUCCESS] Confirmación de guardado en base de datos central:', srvJson);

      // 2. Auxiliary Supabase / cloud store sync if available
      try {
        await supabase.from('receipts').insert([recordPayload]);
      } catch (dbErr) {
        console.warn('Aviso auxiliar insertando en Supabase:', dbErr);
      }

      setMsg({ 
        type: 'success', 
        text: `¡${tipoComprobante} guardado y sincronizado en la nube! Se notificó a la Contadora Ahilin Torres.` 
      });
      
      // Reset form
      if (!esConsumidorFinal) {
        setCuitRazonSocial('');
      }
      setMonto('');
      setConceptoLote('');
      removeAttachedFile();

      // Notify parent & reload lists
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err: any) {
      console.error('Error al guardar comprobante:', err);
      setMsg({
        type: 'error',
        text: err?.message || 'Ocurrió un error al persistir la información.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl w-full mx-auto bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-7 shadow-xs space-y-5">
      
      {/* Header Title */}
      <div className="flex items-start sm:items-center gap-3.5 pb-4 border-b border-slate-100">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100 shadow-xs">
          <Receipt className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Cargar Comprobante / Ticket / Lote
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Subí la foto de tus tickets, cupones POS o cierres de lote para que la contadora emita tus facturas.
          </p>
        </div>
      </div>

      {/* Mode Selector: Foto / Cámara vs Carga Manual */}
      <div className="grid grid-cols-2 gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => {
            setActiveMode('foto');
            setMsg(null);
          }}
          className={`py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeMode === 'foto'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Foto / Cámara / PDF</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveMode('manual');
            setMsg(null);
          }}
          className={`py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeMode === 'manual'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Carga Manual Directa</span>
        </button>
      </div>

      {/* Feedback Message */}
      {msg && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold border flex items-center gap-2.5 animate-in fade-in ${
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

      {/* Hidden File / Camera Inputs for Android / iPhone and Desktop */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Section: Foto / Cámara Mode Direct Capture */}
      {activeMode === 'foto' && (
        <div className="space-y-4">
          {!attachedFile ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mobile Camera Direct Button */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-5 rounded-2xl border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50/80 transition-all flex flex-col items-center justify-center gap-2 text-center cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black text-slate-800">
                    Sacar Foto con Cámara
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ideal para celular: ticket, cupón o comprobante
                  </p>
                </div>
              </button>

              {/* Gallery / File / PDF Picker */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-purple-400 bg-slate-50 hover:bg-purple-50/30 transition-all flex flex-col items-center justify-center gap-2 text-center cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black text-slate-800">
                    Subir Archivo o Galería
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Seleccionar imagen JPG, PNG o PDF
                  </p>
                </div>
              </button>
            </div>
          ) : (
            <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {attachedPreview ? (
                  <img
                    src={attachedPreview}
                    alt="Preview"
                    className="w-14 h-14 object-cover rounded-xl border border-purple-200 shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <FileUp className="w-6 h-6" />
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {attachedFile.name}
                  </p>
                  <p className="text-[11px] text-purple-700 font-semibold">
                    {(attachedFile.size / 1024).toFixed(1)} KB • Archivo adjunto
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => analyzeFileWithAI(attachedFile)}
                  disabled={isAnalyzingAi}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAnalyzingAi ? 'Analizando...' : 'Re-analizar con IA'}</span>
                </button>
                <button
                  type="button"
                  onClick={removeAttachedFile}
                  className="p-1.5 rounded-xl bg-slate-200 hover:bg-rose-100 hover:text-rose-600 text-slate-600 transition-colors cursor-pointer"
                  title="Eliminar archivo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {isAnalyzingAi && (
            <div className="p-3 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl text-xs font-semibold flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Analizando documento y extrayendo montos con inteligencia artificial...</span>
            </div>
          )}
        </div>
      )}

      {/* Main Form Fields */}
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        
        {/* 1. Tipo de Comprobante */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
            1. Tipo de Comprobante <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: 'Factura' as TipoComprobante, label: 'Factura', icon: FileText, desc: 'Venta directa' },
              { id: 'Cupón POS' as TipoComprobante, label: 'Cupón POS', icon: CreditCard, desc: 'Tarjeta / Payway' },
              { id: 'Cierre de Lote' as TipoComprobante, label: 'Cierre de Lote', icon: Layers, desc: 'Cierre de terminal' },
            ].map((tipo) => {
              const Icon = tipo.icon;
              const isSelected = tipoComprobante === tipo.id;
              return (
                <button
                  key={tipo.id}
                  type="button"
                  onClick={() => setTipoComprobante(tipo.id)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-600/20 text-purple-950 font-bold'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-purple-600' : 'text-slate-500'}`} />
                    <div>
                      <p className="text-xs font-bold">{tipo.label}</p>
                      <p className="text-[10px] text-slate-500">{tipo.desc}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Checkbox Consumidor Final */}
        <div className="p-3.5 bg-purple-50/60 border border-purple-200/70 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-purple-950">Facturar a Consumidor Final</p>
              <p className="text-[10px] text-purple-700">Sin necesidad de CUIT individual</p>
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
            <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {/* 3. CUIT / Razón Social */}
        <div className="space-y-1">
          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
            2. CUIT / Nombre del Pagador <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <User className="w-4 h-4" />
            </span>
            <input
              type="text"
              required
              disabled={esConsumidorFinal}
              placeholder={esConsumidorFinal ? 'Consumidor Final' : 'Ej: 20-34981290-3 o Perez Construcciones'}
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
        <div className="space-y-1">
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
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-hidden"
            />
          </div>
        </div>

        {/* 5. Concepto / Detalle */}
        <div className="space-y-1">
          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
            4. Concepto / Detalle / N° Cupón
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 top-3 flex items-start text-slate-400">
              <Hash className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder={
                tipoComprobante === 'Cierre de Lote'
                  ? 'Ej: Cierre Lote #045 POSNET, 18 ventas'
                  : tipoComprobante === 'Cupón POS'
                  ? 'Ej: Cupón 235-0052, Tarjeta Visa Débito'
                  : 'Ej: Venta en mostrador'
              }
              value={conceptoLote}
              onChange={(e) => setConceptoLote(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-900 outline-hidden"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          id="btn-submit-comprobante"
          disabled={isSubmitting}
          className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-xl text-xs sm:text-sm font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Guardando y Notificando a la Contadora...</span>
            </>
          ) : (
            <>
              <FileCheck className="w-4 h-4" />
              <span>Enviar Comprobante a la Contadora</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
