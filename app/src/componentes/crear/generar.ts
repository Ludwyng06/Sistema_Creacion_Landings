import { leerFlujoNdjson } from "./ndjson";
import { leerEventoGenerar, limpiarEncargo, type Encargo, type EventoGenerar } from "./encargo";

// Cliente de `POST /api/generar` (16-A): lee el flujo NDJSON y entrega cada evento válido a la pantalla.

export type Emitir = (evento: EventoGenerar) => void;

export interface OpcionesGenerar {
  senal?: AbortSignal;
  /** Para las pruebas. */
  buscar?: typeof fetch;
}

export async function generarLanding(encargo: Encargo, emitir: Emitir, { senal, buscar = fetch }: OpcionesGenerar = {}): Promise<void> {
  const limpio = limpiarEncargo(encargo);
  let respuesta: Response;
  try {
    respuesta = await buscar("/api/generar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(limpio), signal: senal });
  } catch (e) {
    if (senal?.aborted) return;
    emitir({ tipo: "error", mensaje: e instanceof Error ? e.message : "No pudimos conectar con el generador." });
    return;
  }
  if (!respuesta.ok || !respuesta.body) {
    let mensaje = "No pudimos generar la landing. Inténtalo otra vez.";
    try {
      const cuerpo = (await respuesta.json()) as { error?: string };
      if (cuerpo.error) mensaje = cuerpo.error;
    } catch {
      // Sin JSON: queda el mensaje genérico.
    }
    emitir({ tipo: "error", mensaje });
    return;
  }
  let terminado = false;
  await leerFlujoNdjson<unknown>(
    respuesta.body,
    (bruto) => {
      const evento = leerEventoGenerar(bruto);
      if (!evento) return;
      if (evento.tipo === "listo" || evento.tipo === "error") terminado = true;
      emitir(evento);
    },
    () => {},
    new Set(["etapa", "faltantes", "listo", "error"]),
  ).catch(() => {});
  if (!terminado && !senal?.aborted) emitir({ tipo: "error", mensaje: "El generador se cortó antes de terminar. Inténtalo otra vez." });
}
