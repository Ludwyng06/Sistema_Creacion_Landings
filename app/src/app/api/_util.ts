import { z, type ZodType } from "zod";
import { ErrorCascadaAgotada, ErrorIA } from "@/lib/ia/tipos";
import { LandingNoEncontrada, VersionNoEncontrada } from "@/lib/landings";

// Utilidades comunes de los Route Handlers: validación con Zod y respuestas de error uniformes.

/** Error con código HTTP y un mensaje legible para la persona. */
export class ErrorHttp extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(mensaje);
    this.name = "ErrorHttp";
  }
}

export const json = (datos: unknown, status = 200) => Response.json(datos, { status });

/** Lee y valida el cuerpo JSON; 400 con el mensaje de Zod si no cumple. */
export async function leerCuerpo<T>(request: Request, esquema: ZodType<T>): Promise<T> {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    throw new ErrorHttp(400, "El cuerpo de la petición debe ser un JSON válido.");
  }
  return validarEntrada(esquema, cuerpo);
}

export function validarEntrada<T>(esquema: ZodType<T>, valor: unknown): T {
  const r = esquema.safeParse(valor);
  if (!r.success) throw new ErrorHttp(400, z.prettifyError(r.error));
  return r.data;
}

/** Ejecuta el manejador y traduce los errores conocidos a respuestas JSON `{ error }`. */
export async function manejar(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErrorHttp) return json({ error: e.message, ...e.extra }, e.status);
    if (e instanceof LandingNoEncontrada || e instanceof VersionNoEncontrada) return json({ error: e.message }, 404);
    if (e instanceof ErrorCascadaAgotada) {
      return json({ error: e.message, intentos: e.intentos, promptManual: e.promptManual }, 503);
    }
    if (e instanceof ErrorIA) return json({ error: e.message }, 502);
    if (e instanceof z.ZodError) return json({ error: z.prettifyError(e) }, 500);
    console.error(e);
    return json({ error: "Error interno del servidor." }, 500);
  }
}

export type Contexto<P extends Record<string, string>> = { params: Promise<P> };
