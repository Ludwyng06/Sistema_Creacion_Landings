import { crearManejadorGenerar } from "@/lib/generar/http";

// Respuesta NDJSON (application/x-ndjson): un EventoGenerar por línea (tarea-16 §16-A.5). `/api/construir` sigue por compatibilidad.
export const POST = crearManejadorGenerar();
