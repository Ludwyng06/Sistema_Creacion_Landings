import type { FuenteMedio } from "@/lib/contratos";

// Los bancos de medios de la 12-A (docs/sistema-creacion-landings-v2.md §14.1 y docs/bitacora/tarea-12-A.md §2).
// Las consultas semilla van en inglés: así las indexan NASA Images y Wikimedia.

export type Tematica = "espacio" | "producto";

export interface DefinicionBanco {
  id: string;
  nombre: string;
  tematica: Tematica;
  /** Fuentes que llenan el banco, en orden de preferencia. */
  fuentes: Extract<FuenteMedio, "nasa-images" | "wikimedia" | "openverse" | "pixabay" | "pexels" | "apod">[];
  consultas: string[];
  /** Palabras (en minúscula) que descartan un resultado: logos, insignias, dibujos y capturas que no sirven de fondo. */
  excluir: string[];
  /** Solo se guardan imágenes con al menos este ancho, en píxeles. */
  anchoMinimo: number;
}

const EXCLUIR_ESPACIO = [
  // logos, insignias y material gráfico
  "logo", "insignia", "patch", "emblem", "poster", "diagram", "chart", "graph", "infographic", "illustration", "artist", "concept", "cartoon", "lego", "t-shirt", "all-sky", "sky map", "map of", "albedo", "mosaic map",
  // personas, eventos y pies de foto de oficina
  "crew portrait", "official portrait", "biography", "briefing", "panel", "presentation", "lecture", "speaks", "speaking", "discuss", "answers questions", "administrator", "podium", "ceremony", "conference", "award", "employee", "visit", "reception", "press", "interview", "meeting", "audience",
  // hardware de laboratorio y pruebas
  "laboratory", "clean room", "test article", "technician", "engineer", "facility", "mockup", "training",
];
const EXCLUIR_PRODUCTO = [
  "logo", "icon", "diagram", "chart", "screenshot", "map", "flag", "poster", "cartoon", "drawing", "svg", "book cover",
  "car", "hyundai", "museum", "painting", "church", "kirche", "cathedral", "calendar", "stamp", "coin", "circuit", "board", "chip", "protest", "demonstration", "conference", "ceremony", "meeting", "portrait", "wedding",
];

export const BANCOS: DefinicionBanco[] = [
  {
    id: "b1",
    nombre: "Espacio profundo",
    tematica: "espacio",
    fuentes: ["nasa-images"],
    consultas: ["galaxy hubble", "nebula webb", "milky way", "star cluster", "deep field"],
    excluir: EXCLUIR_ESPACIO,
    anchoMinimo: 1600,
  },
  {
    id: "b3",
    nombre: "La Luna",
    tematica: "espacio",
    fuentes: ["nasa-images"],
    consultas: ["full moon", "moon surface", "lunar crater", "earthrise", "moon"],
    excluir: EXCLUIR_ESPACIO,
    anchoMinimo: 1600,
  },
  {
    id: "b4",
    nombre: "Marte y planetas",
    tematica: "espacio",
    fuentes: ["nasa-images"],
    consultas: ["mars surface", "perseverance rover", "jupiter", "saturn rings", "curiosity rover mars"],
    excluir: EXCLUIR_ESPACIO,
    anchoMinimo: 1600,
  },
  {
    id: "b5",
    nombre: "Auroras y cielo nocturno",
    tematica: "espacio",
    fuentes: ["nasa-images"],
    consultas: ["aurora from ISS", "aurora borealis", "aurora australis", "night sky stars", "earth at night"],
    excluir: EXCLUIR_ESPACIO,
    anchoMinimo: 1600,
  },
  {
    id: "b7",
    nombre: "Cohetes, misiones e ISS",
    tematica: "espacio",
    fuentes: ["nasa-images"],
    consultas: ["rocket launch", "international space station", "astronaut spacewalk", "falcon 9 launch", "space shuttle launch"],
    excluir: EXCLUIR_ESPACIO,
    anchoMinimo: 1600,
  },
  {
    id: "p-belleza",
    nombre: "Belleza y cuidado de la piel",
    tematica: "producto",
    fuentes: ["wikimedia", "openverse", "pixabay", "pexels"],
    consultas: ["skin care serum bottle", "dropper bottle", "cosmetic cream jar", "facial skincare products", "orange slice", "face cream", "collagen powder", "powder spoon"],
    excluir: EXCLUIR_PRODUCTO,
    anchoMinimo: 1000,
  },
  {
    id: "p-bienestar",
    nombre: "Bienestar y salud",
    tematica: "producto",
    fuentes: ["wikimedia", "openverse", "pixabay", "pexels"],
    consultas: ["protein powder scoop", "electric toothbrush", "sonic toothbrush", "toothbrush toothpaste", "glass of water", "healthy smoothie drink", "yoga wellness", "dietary supplement powder"],
    excluir: EXCLUIR_PRODUCTO,
    anchoMinimo: 1000,
  },
  {
    id: "p-tecnologia",
    nombre: "Tecnología y seguridad",
    tematica: "producto",
    fuentes: ["wikimedia", "openverse", "pixabay", "pexels"],
    consultas: ["video doorbell", "smart doorbell", "door intercom camera", "smartphone home app", "amateur telescope", "telescope tripod", "beginner telescope", "smart home"],
    excluir: EXCLUIR_PRODUCTO,
    anchoMinimo: 1000,
  },
  {
    id: "p-hogar",
    nombre: "Hogar y ambiente",
    tematica: "producto",
    fuentes: ["wikimedia", "openverse", "pixabay", "pexels"],
    consultas: ["moon lamp", "night light lamp", "star projector ceiling", "galaxy projector", "bedroom night light", "toy rocket", "model rocket", "living room interior", "children bedroom", "table lamp warm light"],
    excluir: EXCLUIR_PRODUCTO,
    anchoMinimo: 1000,
  },
];

export const BANCOS_ESPACIALES = BANCOS.filter((b) => b.tematica === "espacio").map((b) => b.id);
export const bancoPorId = (id: string): DefinicionBanco | undefined => BANCOS.find((b) => b.id === id);

/** Imágenes por banco: entre 12 y 20 alcanzan para la vitrina; el resto de los 40 a 80 queda para después. */
export const IMAGENES_POR_BANCO = 16;
