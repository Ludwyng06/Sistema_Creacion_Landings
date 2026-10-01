import { z } from "zod";
import { crearLead, obtenerLanding } from "@/lib/landings";
import { formularioDe, registrarEnvio, validarLead } from "../_leads";
import { ErrorHttp, json, leerCuerpo, manejar } from "../_util";

const Cuerpo = z.object({
  landingId: z.string().min(1),
  datos: z.record(z.string(), z.string()),
  /** Honeypot: campo oculto que las personas dejan vacío. */
  sitio: z.string().optional(),
});

/**
 * `POST { landingId, datos: { nombre, correo, telefono, ... }, sitio?: "" }` → 201 `{ ok: true, id }`.
 * 400 con `{ error, errores? }` si falta un campo obligatorio, el correo o el teléfono no son válidos o el honeypot trae texto;
 * 404 si la landing no existe; 429 si la landing recibió más de 10 envíos en el último minuto.
 */
export async function POST(request: Request) {
  return manejar(async () => {
    const { landingId, datos, sitio } = await leerCuerpo(request, Cuerpo);
    const landing = await obtenerLanding(landingId);
    if (!registrarEnvio(landingId)) throw new ErrorHttp(429, "Demasiados envíos: espera un minuto e inténtalo de nuevo.");
    if ((sitio ?? datos.sitio ?? "").trim() !== "") throw new ErrorHttp(400, "No se pudo enviar el formulario.");
    const form = formularioDe(landing.doc);
    if (!form) throw new ErrorHttp(400, "Esta landing no tiene formulario de contacto.");
    const r = validarLead(form, datos);
    if (!r.ok) throw new ErrorHttp(400, r.errores.join(" "), { errores: r.errores });
    const lead = await crearLead(landingId, r.datos);
    return json({ ok: true, id: lead.id }, 201);
  });
}
