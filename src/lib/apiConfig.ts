/**
 * Configuración centralizada de endpoints y URL base del Backend.
 * Permite que el frontend funcione tanto en desarrollo local, Cloud Run,
 * Netlify, Vercel o servidores externos mediante la variable VITE_API_URL.
 */

// Obtener la URL del backend desde las variables de entorno de Vite
const envApiUrl = ((import.meta as any).env?.VITE_API_URL || '').trim();

// Normalizar la URL base eliminando barras finales
export const API_BASE_URL = envApiUrl.replace(/\/+$/, '');

/**
 * Genera la URL completa para un endpoint de la API.
 * Si VITE_API_URL está configurada (ej. "https://mi-backend.onrender.com"), devuelve "https://mi-backend.onrender.com/api/..."
 * Si no está configurada, devuelve la ruta relativa "/api/..."
 */
export const apiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!API_BASE_URL) {
    return cleanEndpoint;
  }
  return `${API_BASE_URL}${cleanEndpoint}`;
};

/**
 * Wrapper de fetch para llamadas a la API con manejo de URLs absolutas/relativas,
 * cabeceras JSON por defecto y detección de respuestas HTML 404 de hosts estáticos (Netlify / Vercel).
 */
export const apiFetch = async (endpoint: string, options?: RequestInit): Promise<Response> => {
  const url = apiUrl(endpoint);
  
  try {
    const res = await fetch(url, options);
    
    // Si devuelve 404 y el contenido es HTML (típico de SPA fallback o página 404 de Netlify)
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok && res.status === 404 && contentType.includes('text/html')) {
      console.error(
        `[API CONFIG] El endpoint ${url} devolvió 404 (página HTML). ` +
        `Si estás en Netlify, configurá VITE_API_URL con la URL de tu servidor backend o revisá _redirects.`
      );
    }
    
    return res;
  } catch (error: any) {
    console.error(`[API FETCH ERROR] Error conectando a ${url}:`, error);
    throw error;
  }
};
