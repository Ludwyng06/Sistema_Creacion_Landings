import type { PromptsImagen } from "@/lib/ia/prompts/imagen";
import { RESTRICCIONES_DE_IMAGEN } from "@/lib/ia/prompts/imagen";
import type { SlotVitrina } from "./imagenes";
import { escenaDeSlot } from "./escenas";

// Respaldo de las imágenes que NO necesita cuota de texto (tarea 24-A, agregado urgente): prompts deterministas para FLUX y consultas a los
// bancos por palabras clave. Con todos los proveedores de texto caídos, la landing igual sale con fotos reales o generadas.

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Palabras que dan una buena búsqueda en inglés (los bancos de NASA, Openverse y Wikimedia titulan en inglés). */
const GLOSARIO: [RegExp, string][] = [
  [/aurora/, "aurora borealis"],
  [/meteor|estrella fugaz|lluvia de/, "meteor shower"],
  [/orionid|perseid|gemini|leonid/, "meteor shower night sky"],
  [/luna|lunar/, "moon"],
  [/eclipse/, "eclipse"],
  [/telescop/, "telescope"],
  [/estrella|cielo|astronom|galaxia|constelacion/, "night sky stars"],
  [/cohete|lanzamiento/, "rocket launch"],
  [/espacio|estacion espacial|satelite/, "space"],
  [/marte|planeta/, "planet"],
  [/montana|senderismo|caminata/, "mountain landscape"],
  [/playa|mar |oceano/, "beach ocean"],
  [/cafe|cafeteria/, "coffee"],
  [/pan |panaderia|pasteler/, "bakery bread"],
  [/bosque|reforest|arbol/, "forest trees"],
  [/fotograf/, "photography camera"],
  [/yoga|meditacion/, "yoga"],
  [/mascota|perro|gato/, "pet"],
  [/hogar|casa|tareas del hogar/, "home interior"],
  [/lampara|luz/, "lamp light"],
  [/curso|clase|taller/, "workshop classroom"],
];

const RUIDO = new Set(["landing", "para", "una", "uno", "unos", "unas", "con", "los", "las", "del", "que", "como", "tours", "tour", "vender", "noche", "curso", "app", "sobre", "desde", "este", "esta", "quiero", "crear", "hacer", "pagina"]);

/** Palabras clave del brief (nombre, propuesta y temática) sin IA: en español y, cuando el glosario las conoce, en inglés. */
export function palabrasClave(textos: string[], tematica?: string): string[] {
  const texto = sinAcentos(textos.join(" "));
  const es = [...new Set(texto.split(/[^a-z0-9]+/).filter((p) => p.length > 3 && !RUIDO.has(p)))];
  const en = GLOSARIO.filter(([re]) => re.test(`${texto} `)).flatMap(([, ing]) => ing.split(" "));
  const base = tematica === "espacio" ? ["space", "night", "sky", "stars"] : [];
  return [...new Set([...es.slice(0, 10), ...en, ...base])];
}

/** Consultas para los bancos y las APIs de fotos, de la más específica a la más general (todas sin IA). */
export function consultasDeBanco(nombre: string, textos: string[], tematica?: string): string[] {
  const texto = sinAcentos([nombre, ...textos].join(" "));
  const consultas: string[] = [];
  for (const [re, ing] of GLOSARIO) if (re.test(`${texto} `)) consultas.push(ing);
  if (tematica === "espacio" && consultas.length === 0) consultas.push("night sky stars");
  const limpio = sinAcentos(nombre).split(/[^a-z0-9]+/).filter((p) => p.length > 3 && !RUIDO.has(p)).slice(0, 3).join(" ");
  if (limpio) consultas.push(limpio);
  return [...new Set(consultas)].slice(0, 4);
}

const FORMA: Record<string, string> = { "1:1": "Square 1:1.", "4:5": "Vertical 4:5.", "16:9": "Wide 16:9 landscape.", "9:16": "Tall vertical 9:16." };

const ESCENAS: Record<SlotVitrina["rol"], string[]> = {
  heroe: ["a wide establishing shot with generous empty space on one side for a headline", "a dramatic hero view, the subject centered with calm negative space around it"],
  problema: ["an everyday scene that shows the need before the solution, flat neutral light", "a quiet empty setting that makes the viewer feel the missing piece"],
  galeria: ["a detail shot with natural texture and soft depth of field", "the subject in its real setting, seen from a slightly different angle", "a close, intimate composition that shows quality and atmosphere"],
  incluye: ["everything that comes together laid out neatly on a plain surface, top-down view"],
  otro: ["a clean editorial photograph with a clear single subject"],
};

const DESCRIPCION_ALT: Record<SlotVitrina["rol"], string> = {
  heroe: "Vista amplia y despejada que presenta el tema principal de la landing",
  problema: "Escena cotidiana que muestra la necesidad antes de la solución",
  galeria: "Detalle del tema en su ambiente real con luz natural",
  incluye: "Todo lo que incluye la propuesta, ordenado sobre una superficie lisa",
  otro: "Fotografía limpia con un solo protagonista",
};

export interface ContextoDeterminista {
  nombre: string;
  /** Texto con la propuesta o el problema, para sacar el sujeto. */
  descripcion?: string;
  tematica?: string;
  /** Tipo de landing: con él, cada slot pide una escena distinta según su sección (`escenas.ts`). */
  tipo?: string;
  /** Colores de los tokens, para que las imágenes parezcan de la misma sesión que la landing. */
  colores?: { fondo: string; acento: string };
}

/** Sujeto en inglés para el generador: el nombre y lo que el glosario reconoce. */
function sujetoDe(c: ContextoDeterminista): string {
  const en = [...new Set(palabrasClave([c.nombre, c.descripcion ?? ""], c.tematica).filter((p) => /^[a-z]+$/.test(p)))];
  const ingles = GLOSARIO.filter(([re]) => re.test(`${sinAcentos(`${c.nombre} ${c.descripcion ?? ""}`)} `)).map(([, e]) => e);
  const pista = ingles.length ? `(${ingles.slice(0, 3).join(", ")})` : en.length ? `(${en.slice(0, 4).join(", ")})` : "";
  return `${c.nombre.replace(/[«»"]/g, "")} ${pista}`.trim();
}

export function fichaDeterminista(c: ContextoDeterminista): PromptsImagen["ficha"] {
  return {
    paleta: c.colores ? `palette matching ${c.colores.fondo} background and ${c.colores.acento} accent` : "balanced natural palette with one accent color",
    luz: c.tematica === "espacio" ? "low-key night light with a soft glow" : "soft natural daylight from one side",
    lente: "35 mm lens, natural shallow depth of field",
    estilo: "clean realistic editorial photography",
    fondo: "uncluttered, no visible text or signs",
  };
}

/** Prompt y texto alternativo de un slot, armados por plantilla: sujeto del brief, escena según el rol, composición, proporción y restricciones. */
export function guionDeSlot(s: SlotVitrina, c: ContextoDeterminista, indice = 0, usadas?: Map<string, number>): PromptsImagen["slots"][number] {
  const f = fichaDeterminista(c);
  if (c.tipo) {
    const esc = escenaDeSlot(s, c, usadas ?? new Map());
    const prompt = `Photograph of ${sujetoDe(c)}: ${esc.en}. ${f.paleta}, ${f.luz}, ${f.lente}, ${f.estilo}, ${f.fondo}. ${FORMA[s.relacion] ?? ""} ${RESTRICCIONES_DE_IMAGEN}`.replace(/\s+/g, " ").trim();
    return { slot: s.slot, prompt: prompt.slice(0, 700), alt: esc.es };
  }
  const escenas = ESCENAS[s.rol] ?? ESCENAS.otro;
  const escena = escenas[indice % escenas.length];
  const prompt = `Photograph of ${sujetoDe(c)}: ${escena}. ${f.paleta}, ${f.luz}, ${f.lente}, ${f.estilo}, ${f.fondo}. ${FORMA[s.relacion] ?? ""} ${RESTRICCIONES_DE_IMAGEN}`.replace(/\s+/g, " ").trim();
  const alt = `${DESCRIPCION_ALT[s.rol] ?? DESCRIPCION_ALT.otro}: ${c.nombre.replace(/[«»"]/g, "")}`.slice(0, 200);
  return { slot: s.slot, prompt: prompt.slice(0, 700), alt: alt.length >= 30 ? alt : `${alt}, foto de ambiente sin texto ni logos` };
}

/** Los prompts de todos los slots sin llamar a ninguna IA. Nunca se queda sin prompts. */
export function promptsDeterministas(slots: SlotVitrina[], c: ContextoDeterminista): PromptsImagen {
  const porRol = new Map<string, number>();
  const usadas = new Map<string, number>();
  return {
    ficha: fichaDeterminista(c),
    slots: slots.map((s) => {
      const i = porRol.get(s.rol) ?? 0;
      porRol.set(s.rol, i + 1);
      return guionDeSlot(s, c, i, usadas);
    }),
  };
}
