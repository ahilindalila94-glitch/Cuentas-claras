import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const currentFilename = typeof __filename !== "undefined"
  ? __filename
  : fileURLToPath((typeof import.meta !== "undefined" && import.meta.url) || "file://");
const currentDirname = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(currentFilename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON body parsing with large payload capacity for PDFs and photos
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API: Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "asistente-contable-ai" });
  });

  // API: Direct Download of compiled dist archive
  app.get("/descargar-dist", (_req, res) => {
    const archivePath = path.join(process.cwd(), 'dist.tar.gz');
    res.download(archivePath, 'dist.tar.gz');
  });

  // API: Analyze Receipt or Bank Statement (Image / PDF / Raw Text)
  app.post("/api/analyze", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY no está configurada en el entorno del servidor.",
        });
      }

      const { fileData, mimeType, rawText, fileName } = req.body;

      if (!fileData && !rawText) {
        return res.status(400).json({
          error: "Debe proporcionar una imagen/PDF en base64 o texto del comprobante.",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction = `Sos un asistente contable automatizado de alta precisión para billeteras virtuales (Mercado Pago, Naranja X, Ualá, Personal Pay, Brubank, Cuenta DNI, BNA+, Modo) y bancos (Galicia, Santander, BBVA, Macro, Banco Nación, Banco Provincia, etc.).
Tu tarea es analizar comprobantes individuales, capturas de transferencias, fotos o resúmenes/extractos bancarios en PDF o texto.
Debes extraer la información de las transferencias RECIBIDAS, acreditaciones e INGRESOS DE DINERO.

REGLAS DE EXTRACCIÓN:
1. "origen_billetera": Identificar el nombre de la app, billetera virtual o entidad bancaria de donde proviene o donde se recibió la transferencia (Ejemplos: "Mercado Pago", "Naranja X", "Ualá", "Banco Galicia", "Santander", "Cuenta DNI", "Brubank", "Personal Pay", "BNA+"). Si no se deduce con certeza, indicar "Billetera / Banco No Especificado".
2. "fecha_periodo": Fecha puntual de la operación (ej: "2026-08-14 10:42") o rango de fechas si es un extracto/resumen (ej: "01/08/2026 al 15/08/2026").
3. "monto_total_acumulado": Suma matemática total numérica de los ingresos/transferencias recibidas (número flotante decimal, ej: 154800.50).
4. "detalle_movimientos": Lista de cada transferencia recibida/ingreso detectado:
   - "fecha": Fecha ("YYYY-MM-DD" o "YYYY-MM-DD HH:mm" o "HH:mm" según figure).
   - "monto": Valor numérico positivo del ingreso (ej: 45000.00).
   - "pagador_nombre_cuit": Nombre completo de la persona o empresa que envió el dinero y su CUIT/CUIL si figura en el comprobante (ej: "Juan Ignacio Rossi - CUIT 20-38491029-4"). Si no figura el pagador, poner exactamente "No identificado".

Devuelve ÚNICAMENTE el objeto JSON estricto estructurado según el schema especificado, sin texto introductorio ni markdown adicional.`;

      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

      if (fileData && mimeType) {
        // Clean base64 header if present (e.g. data:image/png;base64,...)
        const cleanBase64 = fileData.includes("base64,")
          ? fileData.split("base64,")[1]
          : fileData;

        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64,
          },
        });
      }

      const promptText = `Por favor analiza este comprobante o extracto ${fileName ? `(Archivo: ${fileName})` : ""}:
${rawText ? `\n--- CONTENIDO TEXTO / DETALLE ---\n${rawText}` : ""}
Extrae todas las transferencias recibidas e ingresos y genera la respuesta JSON con la estructura solicitada.`;

      parts.push({
        text: promptText,
      });

      const modelsToTry = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"];
      let response;
      let lastError;

      for (const modelName of modelsToTry) {
        try {
          console.log(`Intentando analizar comprobante con el modelo: ${modelName}`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: parts as any,
            },
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  origen_billetera: {
                    type: Type.STRING,
                    description: "Nombre de la app, billetera o banco (ej: Mercado Pago, Naranja X, Ualá, etc.)",
                  },
                  fecha_periodo: {
                    type: Type.STRING,
                    description: "Fecha puntual o rango de fechas del documento",
                  },
                  monto_total_acumulado: {
                    type: Type.NUMBER,
                    description: "Monto total numérico acumulado de transferencias recibidas",
                  },
                  detalle_movimientos: {
                    type: Type.ARRAY,
                    description: "Listado de transferencias e ingresos recibidos",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        fecha: {
                          type: Type.STRING,
                          description: "Fecha en formato YYYY-MM-DD o HH:mm",
                        },
                        monto: {
                          type: Type.NUMBER,
                          description: "Monto de la transferencia recibida",
                        },
                        pagador_nombre_cuit: {
                          type: Type.STRING,
                          description: "Nombre o CUIT del pagador si figura, sino 'No identificado'",
                        },
                      },
                      required: ["fecha", "monto", "pagador_nombre_cuit"],
                    },
                  },
                },
                required: [
                  "origen_billetera",
                  "fecha_periodo",
                  "monto_total_acumulado",
                  "detalle_movimientos",
                ],
              },
            },
          });
          
          if (response) {
            console.log(`Éxito con el modelo ${modelName}`);
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`El modelo ${modelName} falló o no está disponible:`, err?.message || err);
          // Continúa al siguiente modelo del bucle
        }
      }

      if (!response) {
        throw lastError || new Error("Todos los modelos de Gemini fallaron al intentar analizar el documento.");
      }

      const responseText = response.text || "{}";
      const parsedJson = JSON.parse(responseText);

      // Return the parsed JSON directly as requested
      return res.json(parsedJson);
    } catch (err: any) {
      console.error("Error al procesar comprobante con Gemini:", err);
      return res.status(500).json({
        error: "Ocurrió un error al analizar el comprobante.",
        details: err?.message || String(err),
      });
    }
  });

  // API: Send Email Reminder
  app.post("/api/send-reminder", async (req, res) => {
    try {
      const { email, pendingAmount } = req.body;
      if (!email) {
        return res.status(400).json({ error: "El email del destinatario es obligatorio." });
      }

      console.log(`\n==================================================`);
      console.log(`[EMAIL SEND OUTBOX] Enviando correo electrónico...`);
      console.log(`Destinatario: ${email}`);
      console.log(`Asunto: Recordatorio de Cuentas Claras: Subí tus comprobantes pendientes`);
      console.log(`Mensaje: Hola, te recordamos subir al sistema tus transferencias y extractos bancarios pendientes del mes actual.`);
      if (pendingAmount && pendingAmount > 0) {
        console.log(`Monto Pendiente de Conciliar Detectado: $${pendingAmount}`);
      }
      console.log(`==================================================\n`);

      // Simulate network sending latency for high-fidelity interactive experience
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return res.json({
        success: true,
        message: `Recordatorio enviado con éxito a ${email}`,
      });
    } catch (err: any) {
      console.error("Error al enviar recordatorio de correo:", err);
      return res.status(500).json({
        error: "No se pudo procesar el envío de correo.",
        details: err?.message || String(err),
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor contable iniciado en http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fallo al iniciar el servidor:", err);
});
