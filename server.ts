import express from "express";
import path from "path";
import fs from "fs";
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

const CLIENTS_REGISTRY_FILE = path.join(process.cwd(), "clients_registry.json");
const FACTURAS_ARCA_FILE = path.join(process.cwd(), "facturas_arca.json");

function getStoredClients(): Array<{
  id?: string;
  email: string;
  nombre_comercio?: string;
  cuit?: string;
  role?: string;
  created_at: string;
  last_active: string;
}> {
  try {
    if (fs.existsSync(CLIENTS_REGISTRY_FILE)) {
      const raw = fs.readFileSync(CLIENTS_REGISTRY_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading clients registry file:", err);
  }
  return [];
}

function persistClients(clients: any[]) {
  try {
    fs.writeFileSync(CLIENTS_REGISTRY_FILE, JSON.stringify(clients, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving clients registry file:", err);
  }
}

function getStoredFacturasArca(): Array<any> {
  try {
    if (fs.existsSync(FACTURAS_ARCA_FILE)) {
      const raw = fs.readFileSync(FACTURAS_ARCA_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading facturas ARCA file:", err);
  }
  return [];
}

function persistFacturasArca(facturas: any[]) {
  try {
    fs.writeFileSync(FACTURAS_ARCA_FILE, JSON.stringify(facturas, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving facturas ARCA file:", err);
  }
}

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

      const systemInstruction = `Sos un asistente contable y perito en visión de comprobantes fiscales y comerciales para Argentina (AFIP / ARCA), billeteras virtuales y terminales de pago POS (POSNET, Payway, Getnet, Lapos, Mercado Pago Point, Clover, etc.).

Tu tarea es analizar fotos de tickets, capturas de transferencias, comprobantes individuales, resúmenes bancarios o cierres de lote y extraer con absoluta precisión la información contable.

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
   - En "pagador_nombre_cuit": Si no figura nombre o CUIT del cliente, escribir por defecto "Consumidor Final (Tarjeta [Marca] [Tipo] - Cupón #[N°] - [Cuotas] ctas)".

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

Devuelve ÚNICAMENTE el objeto JSON estricto estructurado según el schema especificado, sin texto introductorio ni markdown adicional.`;

      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

      // Clean and normalize MIME type and base64 payload
      if (fileData) {
        let cleanMimeType = mimeType || "image/jpeg";
        let cleanBase64 = String(fileData);

        if (cleanBase64.includes(";base64,")) {
          const splitHeader = cleanBase64.split(";base64,");
          cleanBase64 = splitHeader[1];
          if (splitHeader[0].startsWith("data:")) {
            cleanMimeType = splitHeader[0].replace("data:", "");
          }
        } else if (cleanBase64.includes("base64,")) {
          cleanBase64 = cleanBase64.split("base64,")[1];
        }

        // Normalize mime type for Gemini
        if (cleanMimeType === "image/jpg") cleanMimeType = "image/jpeg";
        if (fileName && fileName.toLowerCase().endsWith(".pdf")) cleanMimeType = "application/pdf";
        if (fileName && (fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".jpeg"))) cleanMimeType = "image/jpeg";
        if (fileName && fileName.toLowerCase().endsWith(".png")) cleanMimeType = "image/png";
        if (fileName && fileName.toLowerCase().endsWith(".webp")) cleanMimeType = "image/webp";

        // Remove any whitespaces/newlines from base64 string
        cleanBase64 = cleanBase64.replace(/\s+/g, "");

        parts.push({
          inlineData: {
            mimeType: cleanMimeType,
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

      const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
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
                    description: "Nombre de la app, terminal POS o banco (ej: POSNET / Payway, Getnet, Mercado Pago, Cierre de Lote)",
                  },
                  fecha_periodo: {
                    type: Type.STRING,
                    description: "Fecha puntual o rango de fechas del documento",
                  },
                  monto_total_acumulado: {
                    type: Type.NUMBER,
                    description: "Monto total numérico acumulado en pesos",
                  },
                  tipo_comprobante: {
                    type: Type.STRING,
                    description: "cupon_individual, cierre_lote, transferencia o extracto",
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
                    description: "Listado de operaciones, cupones o ingresos",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        fecha: {
                          type: Type.STRING,
                          description: "Fecha en formato YYYY-MM-DD o HH:mm",
                        },
                        monto: {
                          type: Type.NUMBER,
                          description: "Monto de la operación",
                        },
                        pagador_nombre_cuit: {
                          type: Type.STRING,
                          description: "Nombre/CUIT del pagador, o 'Consumidor Final'",
                        },
                        tarjeta: { type: Type.STRING },
                        tipo_tarjeta: { type: Type.STRING },
                        numero_cupon: { type: Type.STRING },
                        cuotas: { type: Type.NUMBER },
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
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "").trim();
      }
      
      let parsedJson;
      try {
        parsedJson = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.error("Error parseando respuesta JSON de Gemini:", responseText);
        throw new Error("No se pudo interpretar el formato devuelto por el modelo.");
      }

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

  // API: Get all registered clients
  app.get("/api/clients", (_req, res) => {
    try {
      const clients = getStoredClients();
      return res.json({ clients });
    } catch (err: any) {
      console.error("Error obteniendo clientes:", err);
      return res.status(500).json({ error: "Error al consultar clientes", details: String(err) });
    }
  });

  // API: Register or update active client
  app.post("/api/clients/register", (req, res) => {
    try {
      const { email, role, id, nombre_comercio, cuit } = req.body;
      if (!email) {
        return res.status(400).json({ error: "El email es obligatorio." });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const existing = getStoredClients();
      const now = new Date().toISOString();

      const existingIndex = existing.findIndex((c) => c.email.toLowerCase() === cleanEmail);

      if (existingIndex >= 0) {
        existing[existingIndex] = {
          ...existing[existingIndex],
          id: id || existing[existingIndex].id,
          role: role || existing[existingIndex].role,
          nombre_comercio: nombre_comercio || existing[existingIndex].nombre_comercio,
          cuit: cuit || existing[existingIndex].cuit,
          last_active: now,
        };
      } else {
        existing.push({
          id: id || `client-${Date.now()}`,
          email: cleanEmail,
          nombre_comercio: nombre_comercio || undefined,
          cuit: cuit || undefined,
          role: role || (cleanEmail === "ahilindalila94@gmail.com" ? "admin_contadora" : "cliente"),
          created_at: now,
          last_active: now,
        });
      }

      persistClients(existing);
      console.log(`[CLIENT REGISTER] Cliente registrado/actualizado: ${cleanEmail}`);

      return res.json({
        success: true,
        client: existing.find((c) => c.email.toLowerCase() === cleanEmail),
        totalClients: existing.length,
      });
    } catch (err: any) {
      console.error("Error al registrar cliente:", err);
      return res.status(500).json({ error: "No se pudo registrar el cliente", details: String(err) });
    }
  });

  // API: Delete client from registry
  app.delete("/api/clients/:email", (req, res) => {
    try {
      const targetEmail = req.params.email?.trim().toLowerCase();
      const existing = getStoredClients();
      const filtered = existing.filter((c) => c.email.toLowerCase() !== targetEmail);
      persistClients(filtered);
      return res.json({ success: true, remaining: filtered.length });
    } catch (err: any) {
      return res.status(500).json({ error: "Error eliminando cliente", details: String(err) });
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

  // API: Get Facturas ARCA (optionally filter by email)
  app.get("/api/facturas-arca", (req, res) => {
    try {
      const emailFilter = (req.query.email as string)?.trim().toLowerCase();
      const all = getStoredFacturasArca();
      if (emailFilter) {
        const filtered = all.filter((f) => f.client_email?.toLowerCase() === emailFilter);
        return res.json({ facturas: filtered });
      }
      return res.json({ facturas: all });
    } catch (err: any) {
      return res.status(500).json({ error: "Error obteniendo facturas ARCA", details: String(err) });
    }
  });

  // API: Save / Upload Factura ARCA PDF
  app.post("/api/facturas-arca", (req, res) => {
    try {
      const {
        id,
        client_email,
        numero_factura,
        tipo_factura,
        periodo,
        fecha_emision,
        monto_total,
        cae,
        vencimiento_cae,
        archivo_nombre,
        archivo_url,
        archivo_tipo,
        comentario_contadora,
        comprobantes_asociados_ids,
      } = req.body;

      if (!client_email || !archivo_url) {
        return res.status(400).json({ error: "El email del cliente y el archivo PDF de la factura son requeridos." });
      }

      const cleanEmail = String(client_email).trim().toLowerCase();
      const existing = getStoredFacturasArca();
      const now = new Date().toISOString();

      const newFactura = {
        id: id || `arca-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        client_email: cleanEmail,
        numero_factura: numero_factura || `Factura ARCA #${Date.now().toString().slice(-6)}`,
        tipo_factura: tipo_factura || "Factura C",
        periodo: periodo || new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
        fecha_emision: fecha_emision || now.slice(0, 10),
        monto_total: Number(monto_total) || 0,
        cae: cae || "",
        vencimiento_cae: vencimiento_cae || "",
        archivo_nombre: archivo_nombre || `Factura_ARCA_${cleanEmail.split("@")[0]}.pdf`,
        archivo_url,
        archivo_tipo: archivo_tipo || "application/pdf",
        comentario_contadora: comentario_contadora || "Factura oficial ARCA emitida por tu Estudio Contable Ahilin Torres.",
        created_at: now,
        comprobantes_asociados_ids: comprobantes_asociados_ids || [],
      };

      existing.unshift(newFactura);
      persistFacturasArca(existing);

      console.log(`[FACTURA ARCA CREADA] Factura ${newFactura.numero_factura} subida para ${cleanEmail} por $${newFactura.monto_total}`);

      return res.json({
        success: true,
        factura: newFactura,
        total: existing.length,
      });
    } catch (err: any) {
      console.error("Error al guardar factura ARCA:", err);
      return res.status(500).json({ error: "No se pudo guardar la factura ARCA", details: String(err) });
    }
  });

  // API: Delete Factura ARCA
  app.delete("/api/facturas-arca/:id", (req, res) => {
    try {
      const targetId = req.params.id;
      const existing = getStoredFacturasArca();
      const filtered = existing.filter((f) => f.id !== targetId);
      persistFacturasArca(filtered);
      return res.json({ success: true, remaining: filtered.length });
    } catch (err: any) {
      return res.status(500).json({ error: "Error eliminando factura ARCA", details: String(err) });
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
