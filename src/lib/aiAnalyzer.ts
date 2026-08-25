import { GoogleGenAI, Type } from '@google/genai';
import { ComprobanteResultado } from '../types';

export const SYSTEM_INSTRUCTION_CONTABLE = `Sos un asistente contable y perito en visión de comprobantes fiscales y comerciales para Argentina (AFIP / ARCA), billeteras virtuales y terminales de pago POS (POSNET, Payway, Getnet, Lapos, Mercado Pago Point, Clover, etc.).

Tu tarea es analizar fotos de tickets, capturas de pantalla, archivos PDF o texto y extraer con absoluta precisión la información contable.

DISTINCIÓN DE TIPOS DE DOCUMENTO:

1. CUPÓN INDIVIDUAL DE TARJETA (Ticket POSNET / Payway / Getnet / Point / Lapos):
   - "origen_billetera": Nombre de la terminal o red (ej: "POSNET / Payway", "Getnet", "Mercado Pago Point", "Lapos").
   - "tipo_comprobante": "cupon_individual"
   - Identificar:
     * Tarjeta: Marca de la tarjeta (Visa, Mastercard, Cabal, American Express, Maestro, Naranja).
     * Tipo: Crédito, Débito, Prepaga.
     * N° de Cupón / N° de Comprobante / N° de Operación / Trace.
     * Cantidad de Cuotas: Número entero (1, 3, 6, 12...).
     * Monto Total ($).
   - En "pagador_nombre_cuit": Si no figura nombre del cliente o CUIT, escribir por defecto "Consumidor Final (Tarjeta [Marca] [Tipo] - Cupón #[N°] - [Cuotas] ctas)".

2. CIERRE DE LOTE (Ticket de Cierre / Resumen de Lote / Batch Close POSNET / Getnet / Payway / Lapos):
   - "origen_billetera": "Cierre de Lote " + (terminal o procesador, ej: "Cierre de Lote - Payway / POSNET").
   - "tipo_comprobante": "cierre_lote"
   - Identificar:
     * N° de Lote (Batch Number).
     * N° de Terminal / N° de Comercio / Merchant ID.
     * Cantidad total de cupones / transacciones / operaciones del lote.
     * Monto total acumulado del lote ($).
   - En "pagador_nombre_cuit": Escribir "Cierre de Lote #[N° Lote] - Terminal #[Terminal] ([Cantidad] Cupones)".

3. TRANSFERENCIA BANCARIA O BILLETERA VIRTUAL (Mercado Pago, Naranja X, Ualá, Cuenta DNI, Galicia, Santander, BBVA, Macro, Nación, etc.):
   - "origen_billetera": Nombre de la billetera o banco.
   - "tipo_comprobante": "transferencia" o "extracto".
   - "monto_total_acumulado": Suma de transferencias recibidas.
   - "detalle_movimientos": Lista de ingresos con fecha, monto y pagador/CUIT (o "Consumidor Final" / "No identificado").

4. REGLA MONETARIA: Todos los montos deben ser valores numéricos positivos en pesos argentinos (ej: 45000.50).`;

export async function analyzeComprobanteWithAI(params: {
  fileData?: string; // base64 string
  mimeType?: string;
  rawText?: string;
  fileName?: string;
}): Promise<ComprobanteResultado> {
  const { fileData, mimeType, rawText, fileName } = params;

  // 1. Try server API route first
  try {
    const serverResponse = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileData,
        mimeType,
        rawText,
        fileName,
      }),
    });

    if (serverResponse.ok) {
      const data = await serverResponse.json();
      if (data && typeof data.monto_total_acumulado !== 'undefined') {
        return normalizeResultado(data);
      }
    }
  } catch (serverErr) {
    console.warn('Ruta de servidor /api/analyze no disponible, intentando en cliente:', serverErr);
  }

  // 2. Direct Client-side Gemini processing fallback
  const clientApiKey =
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    '';

  if (!clientApiKey) {
    throw new Error(
      'No se pudo conectar con el servicio de análisis de IA. Verifique su conexión y la configuración de API.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey: clientApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (fileData) {
    let cleanMimeType = mimeType || 'image/jpeg';
    let cleanBase64 = String(fileData);

    if (cleanBase64.includes(';base64,')) {
      const splitHeader = cleanBase64.split(';base64,');
      cleanBase64 = splitHeader[1];
      if (splitHeader[0].startsWith('data:')) {
        cleanMimeType = splitHeader[0].replace('data:', '');
      }
    } else if (cleanBase64.includes('base64,')) {
      cleanBase64 = cleanBase64.split('base64,')[1];
    }

    if (cleanMimeType === 'image/jpg') cleanMimeType = 'image/jpeg';
    if (fileName && fileName.toLowerCase().endsWith('.pdf')) cleanMimeType = 'application/pdf';
    if (fileName && (fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')))
      cleanMimeType = 'image/jpeg';
    if (fileName && fileName.toLowerCase().endsWith('.png')) cleanMimeType = 'image/png';
    if (fileName && fileName.toLowerCase().endsWith('.webp')) cleanMimeType = 'image/webp';

    cleanBase64 = cleanBase64.replace(/\s+/g, '');

    parts.push({
      inlineData: {
        mimeType: cleanMimeType,
        data: cleanBase64,
      },
    });
  }

  const promptText = `Por favor analiza este comprobante comercial, cupón de tarjeta, cierre de lote o extracto bancario ${
    fileName ? `(Archivo: ${fileName})` : ''
  }:
${rawText ? `\n--- CONTENIDO TEXTO / DETALLE ---\n${rawText}` : ''}
Determina si es un Cupón Individual (POSNET/Payway/Getnet), un Cierre de Lote, o una Transferencia, y extrae todos los importes y datos contables en formato JSON.`;

  parts.push({ text: promptText });

  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: parts as any,
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_CONTABLE,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              origen_billetera: {
                type: Type.STRING,
                description: 'Terminal, banco o billetera (ej: POSNET / Payway, Getnet, Mercado Pago, Cierre de Lote)',
              },
              fecha_periodo: {
                type: Type.STRING,
                description: 'Fecha u hora de la operación o rango del lote',
              },
              monto_total_acumulado: {
                type: Type.NUMBER,
                description: 'Monto numérico total en pesos',
              },
              tipo_comprobante: {
                type: Type.STRING,
                description: 'cupon_individual, cierre_lote, transferencia o extracto',
              },
              info_cupon: {
                type: Type.OBJECT,
                properties: {
                  tarjeta: { type: Type.STRING },
                  tipo_tarjeta: { type: Type.STRING },
                  numero_cupon: { type: Type.STRING },
                  cuotas: { type: Type.NUMBER },
                  monto: { type: Type.NUMBER },
                },
              },
              info_lote: {
                type: Type.OBJECT,
                properties: {
                  numero_lote: { type: Type.STRING },
                  numero_terminal: { type: Type.STRING },
                  cantidad_cupones: { type: Type.NUMBER },
                  monto_lote: { type: Type.NUMBER },
                },
              },
              detalle_movimientos: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    fecha: { type: Type.STRING },
                    monto: { type: Type.NUMBER },
                    pagador_nombre_cuit: { type: Type.STRING },
                    tarjeta: { type: Type.STRING },
                    tipo_tarjeta: { type: Type.STRING },
                    numero_cupon: { type: Type.STRING },
                    cuotas: { type: Type.NUMBER },
                  },
                  required: ['fecha', 'monto', 'pagador_nombre_cuit'],
                },
              },
            },
            required: ['origen_billetera', 'fecha_periodo', 'monto_total_acumulado', 'detalle_movimientos'],
          },
        },
      });

      const responseText = response.text || '{}';
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleanJson);
      return normalizeResultado(parsed);
    } catch (err: any) {
      console.warn(`Error con modelo ${modelName}:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error('No se pudo procesar la imagen con los modelos de visión de Gemini.');
}

function normalizeResultado(data: any): ComprobanteResultado {
  const monto = Number(data.monto_total_acumulado) || 0;
  const movimientos = Array.isArray(data.detalle_movimientos)
    ? data.detalle_movimientos.map((m: any) => ({
        fecha: m.fecha || new Date().toISOString().split('T')[0],
        monto: Number(m.monto) || 0,
        pagador_nombre_cuit: m.pagador_nombre_cuit || 'Consumidor Final',
        tarjeta: m.tarjeta || data.info_cupon?.tarjeta,
        tipo_tarjeta: m.tipo_tarjeta || data.info_cupon?.tipo_tarjeta,
        numero_cupon: m.numero_cupon || data.info_cupon?.numero_cupon,
        cuotas: m.cuotas || data.info_cupon?.cuotas,
        numero_lote: m.numero_lote || data.info_lote?.numero_lote,
        numero_terminal: m.numero_terminal || data.info_lote?.numero_terminal,
        cantidad_cupones: m.cantidad_cupones || data.info_lote?.cantidad_cupones,
        tipo_operacion: data.tipo_comprobante || 'transferencia',
      }))
    : [
        {
          fecha: data.fecha_periodo || new Date().toISOString().split('T')[0],
          monto: monto,
          pagador_nombre_cuit: 'Consumidor Final',
        },
      ];

  return {
    origen_billetera: data.origen_billetera || 'Comprobante Comercial',
    fecha_periodo: data.fecha_periodo || new Date().toLocaleDateString('es-AR'),
    monto_total_acumulado: monto,
    detalle_movimientos: movimientos,
    tipo_comprobante: data.tipo_comprobante,
    info_cupon: data.info_cupon,
    info_lote: data.info_lote,
  };
}
