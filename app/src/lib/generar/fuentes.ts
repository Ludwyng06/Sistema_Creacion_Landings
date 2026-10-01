import type { Tematica, TipoLanding } from "@/lib/contratos";
import type { VarianteWidget } from "@/lib/vitrina/tipos";

// Enrutamiento de fuentes por temática (docs/bitacora/tarea-16.md §16-A.2):
//  - espacio → NASA Images, APOD, NeoWs, NOAA, USNO, ISS, Launch Library y los datos curiosos b8;
//  - producto → Google Shopping CO (y Open Food o Beauty Facts si aplica);
//  - todo lo demás → Openverse y Wikimedia;
//  - y siempre FLUX (Hugging Face) como respaldo de imagen.
// Un evento o una divulgación sobre el espacio también usa NASA y el dato en vivo que corresponda.

export type FuenteId =
  | "nasa-images"
  | "apod"
  | "neows"
  | "noaa-kp"
  | "usno-luna"
  | "iss"
  | "lanzamientos"
  | "datos-curiosos"
  | "serpapi-shopping"
  | "open-food-facts"
  | "open-beauty-facts"
  | "openverse"
  | "wikimedia"
  | "flux";

const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const PALABRAS_ESPACIO = ["espacio", "cohete", "lanzamiento", "estacion espacial", "iss", "asteroide", "aurora", "luna", "lunar", "meteoro", "estrella", "galaxia", "planeta", "telescopio", "nasa", "astronom", "cometa", "eclipse", "constelacion", "universo"];

export function esEspacial(texto: string): boolean {
  const t = sinTildes(texto);
  return PALABRAS_ESPACIO.some((p) => (p === "iss" ? /\biss\b/.test(t) : t.includes(p)));
}

/** Dato en vivo que corresponde al tema; `null` si no es de espacio. «Lluvia de meteoros» y «noche de observación» usan la fase lunar (próxima luna llena). */
export function detectarWidget(texto: string): VarianteWidget | null {
  const t = sinTildes(texto);
  if (t.includes("lanzamiento") || t.includes("cohete")) return "cuenta-regresiva-lanzamiento";
  if (t.includes("estacion espacial") || /\biss\b/.test(t)) return "iss";
  if (t.includes("asteroide")) return "asteroides";
  if (t.includes("aurora")) return "auroras";
  if (t.includes("luna") || t.includes("lunar") || t.includes("meteoro") || t.includes("estrella") || t.includes("observacion")) return "fase-lunar";
  return null;
}

export interface Enrutado {
  fuentes: FuenteId[];
  widget: VarianteWidget | null;
  /** Fuentes de datos en vivo que se consultan para comprobar que el widget responde. */
  datosEnVivo: FuenteId[];
  /** Fuentes de imágenes, en orden de preferencia (FLUX siempre al final). */
  imagenes: FuenteId[];
}

const VIVO_DE_WIDGET: Record<VarianteWidget, FuenteId> = { auroras: "noaa-kp", "fase-lunar": "usno-luna", iss: "iss", "cuenta-regresiva-lanzamiento": "lanzamientos", asteroides: "neows" };

export function enrutarFuentes(p: { tipo: TipoLanding; tematica: Tematica; descripcion: string }): Enrutado {
  const fuentes: FuenteId[] = [];
  const espacial = p.tematica === "espacio" || esEspacial(p.descripcion);
  const widget = espacial ? (detectarWidget(p.descripcion) ?? "fase-lunar") : null;
  if (espacial) fuentes.push("nasa-images", "apod", "neows", "noaa-kp", "usno-luna", "iss", "lanzamientos", "datos-curiosos");
  if (p.tipo === "producto") {
    fuentes.push("serpapi-shopping");
    if (p.tematica === "alimentos") fuentes.push("open-food-facts");
    if (p.tematica === "belleza") fuentes.push("open-beauty-facts");
  }
  const generico = !espacial && p.tipo !== "producto";
  if (generico) fuentes.push("openverse", "wikimedia");
  fuentes.push("flux");
  const imagenes: FuenteId[] = [...(espacial ? (["nasa-images", "apod", "wikimedia"] as FuenteId[]) : []), ...(generico ? (["openverse", "wikimedia"] as FuenteId[]) : []), "flux"];
  return { fuentes: [...new Set(fuentes)], widget, datosEnVivo: widget ? [VIVO_DE_WIDGET[widget]] : [], imagenes };
}
