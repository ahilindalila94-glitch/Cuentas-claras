import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker to avoid browser bundling issues
if (typeof window !== 'undefined') {
  try {
    // Setting workerSrc to standard CDN build matching installed version
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('PDF Worker setup note:', e);
  }
}

export interface PdfExtractionResult {
  text: string;
  firstPageImageBase64?: string;
  numPages: number;
}

/**
 * Extract plain text and first page canvas image from a PDF file using pdfjs-dist
 */
export async function extractPdfData(file: File): Promise<PdfExtractionResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Attempt loading document
    const loadingTask = (pdfjsLib as any).getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages || 1;
    let fullText = '';
    let firstPageImageBase64: string | undefined = undefined;

    // Extract text from pages (up to 10 pages)
    for (let pageNum = 1; pageNum <= Math.min(numPages, 10); pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');

        if (pageText.trim()) {
          fullText += (fullText ? '\n' : '') + `[Página ${pageNum}]: ${pageText}`;
        }

        // Render first page as visual image canvas for Gemini Vision
        if (pageNum === 1) {
          try {
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (context) {
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              await (page as any).render({
                canvasContext: context,
                viewport: viewport,
                canvas: canvas,
              }).promise;
              firstPageImageBase64 = canvas.toDataURL('image/jpeg', 0.85);
            }
          } catch (renderErr) {
            console.warn('No se pudo generar imagen de la página 1 del PDF:', renderErr);
          }
        }
      } catch (pageErr) {
        console.warn(`Aviso al leer página ${pageNum} del PDF:`, pageErr);
      }
    }

    return {
      text: fullText.trim(),
      firstPageImageBase64,
      numPages,
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.toLowerCase().includes('password') || errMsg.toLowerCase().includes('encrypt')) {
      throw new Error('El archivo PDF está protegido con contraseña. Por favor remuévela o utilizá Carga Manual.');
    }
    throw new Error(`No se pudo leer el archivo PDF: ${errMsg}`);
  }
}
