import { z } from "zod";

// Contratos de bancos de medios y datos en vivo (docs/bitacora/plan-v2.md y tarea-12-A.md §0).
// Solo el orquestador los modifica; las peticiones de cambio van en docs/bitacora/peticiones.md.

export const FUENTES_MEDIO = [
  "nasa-images",
  "apod",
  "epic",
  "wikimedia",
  "open-food-facts",
  "open-beauty-facts",
  "pexels",
  "openverse",
  "pixabay",
  "usuario",
  "ia-flux",
  "ia-openai",
] as const;
export const FuenteMedio = z.enum(FUENTES_MEDIO);
export type FuenteMedio = z.infer<typeof FuenteMedio>;

// `cc0` agrupa CC0 y dominio público; `cc-by` es CC BY de una versión distinta de 4.0. El texto exacto de la licencia va en `credito`.
export const LICENCIAS_MEDIO = ["dominio-publico-nasa", "cc0", "cc-by-4.0", "cc-by", "cc-by-sa", "pexels", "pixabay", "generada", "usuario"] as const;
export const LicenciaMedio = z.enum(LICENCIAS_MEDIO);
export type LicenciaMedio = z.infer<typeof LicenciaMedio>;

export const OrientacionMedio = z.enum(["horizontal", "vertical", "cuadrada"]);
export type OrientacionMedio = z.infer<typeof OrientacionMedio>;

export const MedioBanco = z.object({
  id: z.string().min(1),
  bancoId: z.string().min(1), // b1, b3, b4, b5, b7, p-belleza…
  tipo: z.enum(["imagen", "video"]),
  fuente: FuenteMedio,
  idFuente: z.string().min(1), // nasa_id, id de Pexels, título de Wikimedia, código de barras…
  ruta: z.string().min(1), // /media/bancos/<banco>/<archivo>.webp
  ancho: z.number().int().positive(),
  alto: z.number().int().positive(),
  orientacion: OrientacionMedio,
  coloresDominantes: z.array(z.string()),
  titulo: z.string(), // en español
  descripcion: z.string(), // en español
  etiquetas: z.array(z.string()),
  credito: z.string().min(1),
  licencia: LicenciaMedio,
  usoComercial: z.boolean(), // false: nunca se ofrece
  urlOrigen: z.string().optional(),
});
export type MedioBanco = z.infer<typeof MedioBanco>;

// ---------- Datos en vivo (GET /api/vivo/[widget]) ----------

export const WIDGETS_VIVO = ["auroras", "fase-lunar", "iss", "lanzamiento", "asteroides"] as const;
export const WidgetVivo = z.enum(WIDGETS_VIVO);
export type WidgetVivo = z.infer<typeof WidgetVivo>;

const Fecha = z.string(); // ISO 8601

export const DatoEnVivo = z.discriminatedUnion("widget", [
  z.object({
    widget: z.literal("auroras"),
    kp: z.number(), // índice Kp planetario, 0 a 9
    nivel: z.enum(["baja", "moderada", "alta", "muy-alta"]),
    actualizadoEn: Fecha,
  }),
  z.object({
    widget: z.literal("fase-lunar"),
    fase: z.string(), // «Luna llena», «Cuarto creciente»…
    iluminacion: z.number().min(0).max(100).nullable(), // porcentaje
    proximaLlena: Fecha.nullable(),
    actualizadoEn: Fecha,
  }),
  z.object({
    widget: z.literal("iss"),
    latitud: z.number(),
    longitud: z.number(),
    altitudKm: z.number(),
    velocidadKmh: z.number(),
    actualizadoEn: Fecha,
  }),
  z.object({
    widget: z.literal("lanzamiento"),
    mision: z.string(),
    cohete: z.string(),
    proveedor: z.string().nullable(),
    lugar: z.string().nullable(),
    fechaLanzamiento: Fecha, // NET
    actualizadoEn: Fecha,
  }),
  z.object({
    widget: z.literal("asteroides"),
    cantidad: z.number().int().nonnegative(), // que pasan hoy cerca de la Tierra
    masCercano: z
      .object({ nombre: z.string(), distanciaKm: z.number(), diametroMaxM: z.number() })
      .nullable(),
    fecha: Fecha,
    actualizadoEn: Fecha,
  }),
]);
export type DatoEnVivo = z.infer<typeof DatoEnVivo>;

// ---------- Datos curiosos (banco b8): src/datos/datos-curiosos.json ----------

export const DatoCurioso = z.object({
  id: z.string().min(1), // b8-01
  frase: z.string().min(1), // «¿Sabías que…?»
  tema: z.string(), // banco de origen (b1, b3…) o «neows», «lanzamientos»
  fuente: z.object({ nombre: z.string().min(1), url: z.string().optional() }),
});
export type DatoCurioso = z.infer<typeof DatoCurioso>;
