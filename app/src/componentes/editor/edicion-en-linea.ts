import type { Seccion } from "@/lib/contratos";
import { METAS } from "@/secciones/metas";

// Edición en línea (doble clic sobre un texto de la vista previa): qué campos de una sección son texto editable y cómo se
// escribe el valor nuevo. Las rutas son `ajustes.<campo>` o `bloques.<idBloque>.<campo>`; solo entran los campos de texto
// del schema (controles «texto» y «textoLargo» que no son listas).

export interface TextoEditable {
  ruta: string;
  valor: string;
  /** Máximo de caracteres si el schema lo declara (no se usa para bloquear la escritura, solo para avisar). */
  campo: string;
}

const ES_TEXTO = new Set(["texto", "textoLargo"]);

export function textosEditables(seccion: Seccion): TextoEditable[] {
  const meta = METAS[seccion.tipo];
  if (!meta) return [];
  const salida: TextoEditable[] = [];
  for (const [campo, def] of Object.entries(meta.ajustes)) {
    const valor = seccion.ajustes[campo];
    if (ES_TEXTO.has(def.control) && !def.lista && typeof valor === "string" && valor.trim()) salida.push({ ruta: `ajustes.${campo}`, valor, campo });
  }
  for (const bloque of seccion.bloques) {
    const def = meta.bloques[bloque.tipo];
    if (!def) continue;
    for (const [campo, c] of Object.entries(def.campos)) {
      const valor = bloque.ajustes[campo];
      if (ES_TEXTO.has(c.control) && !c.lista && typeof valor === "string" && valor.trim()) salida.push({ ruta: `bloques.${bloque.id}.${campo}`, valor, campo });
    }
  }
  return salida;
}

/** Texto sin saltos ni espacios repetidos: así se compara lo que se ve con lo que hay guardado. */
export const compactar = (t: string) => t.replace(/\s+/g, " ").trim();

/** Escribe `valor` en la ruta; `null` si la ruta no existe o no es un campo de texto editable. */
export function conValorEnRuta(seccion: Seccion, ruta: string, valor: string): Seccion | null {
  if (!textosEditables(seccion).some((t) => t.ruta === ruta)) return null;
  const partes = ruta.split(".");
  if (partes[0] === "ajustes" && partes.length === 2) return { ...seccion, ajustes: { ...seccion.ajustes, [partes[1]]: valor } };
  if (partes[0] === "bloques" && partes.length === 3) {
    return { ...seccion, bloques: seccion.bloques.map((b) => (b.id === partes[1] ? { ...b, ajustes: { ...b.ajustes, [partes[2]]: valor } } : b)) };
  }
  return null;
}
