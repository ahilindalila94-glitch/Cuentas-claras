import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setError(null);
      setCapturedPhoto(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Error al acceder a la cámara:', err);
      setError('No se pudo acceder a la cámara. Verifique los permisos en el navegador.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleTakePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedPhoto(dataUrl);
      }
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
  };

  const handleConfirmPhoto = () => {
    if (capturedPhoto) {
      // Convert dataUrl to File
      fetch(capturedPhoto)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], `comprobante_camara_${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          onCapture(file);
          onClose();
        });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-white">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold">Capturar Comprobante</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video / Photo Viewport */}
        <div className="relative aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center text-rose-400 text-xs">
              <p>{error}</p>
            </div>
          ) : capturedPhoto ? (
            <img
              src={capturedPhoto}
              alt="Foto capturada"
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Guide Overlay */}
          {!capturedPhoto && !error && (
            <div className="absolute inset-6 border-2 border-dashed border-emerald-400/40 rounded-xl pointer-events-none flex items-center justify-center">
              <span className="text-[11px] bg-slate-950/70 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
                Enfocá el comprobante o transferencia
              </span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-center gap-3">
          {capturedPhoto ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Volver a sacar
              </button>
              <button
                type="button"
                onClick={handleConfirmPhoto}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Check className="w-4 h-4" />
                Usar esta foto
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleTakePhoto}
              disabled={!!error}
              className="w-14 h-14 rounded-full bg-white hover:bg-slate-200 text-slate-900 flex items-center justify-center shadow-lg border-4 border-slate-800 active:scale-95 transition-all"
              title="Tomar foto"
            >
              <div className="w-10 h-10 rounded-full border-2 border-slate-900 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-emerald-600" />
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
