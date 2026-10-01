import { crearManejadorConstruir } from "@/lib/ia/construir-http";

// Respuesta NDJSON (application/x-ndjson): un EventoConstruccion por línea.
export const POST = crearManejadorConstruir();
