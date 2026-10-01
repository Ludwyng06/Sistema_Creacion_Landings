import { CATALOGO_FUENTES, buscarFuente, estaEnCatalogo, type EntradaFuente } from "@/lib/fuentes/catalogo";
import { TIPOGRAFIAS } from "@/lib/tecnicas/semillas";
import type { CategoriaFuente } from "./tipos";

// Catálogo del selector: los datos son los de la 10-A (`src/datos/fuentes.json`, 200 familias).
export const CATALOGO: readonly EntradaFuente[] = CATALOGO_FUENTES;
export const fuenteDe = buscarFuente;

export interface ParSugerido {
  id: string;
  titulos: string;
  cuerpo: string;
  origen: "semilla" | "catalogo";
}

/** Familias de la biblioteca de semillas que no están en el catálogo, con su equivalente cercano dentro de él. */
export const EQUIVALENTES: Record<string, string> = {
  "dm serif display": "Playfair Display",
  "instrument serif": "Cormorant Garamond",
};

const enCatalogo = (nombre: string) => (estaEnCatalogo(nombre) ? nombre : (EQUIVALENTES[nombre.trim().toLowerCase()] ?? nombre));

/** Combinaciones curadas del catálogo que se suman a los pares de la biblioteca de semillas. */
const CURADOS: { titulos: string; cuerpo: string }[] = [
  { titulos: "Libre Baskerville", cuerpo: "Source Sans 3" },
  { titulos: "Oswald", cuerpo: "Lato" },
];

/**
 * De 6 a 8 pares: los de la biblioteca de semillas (con las familias que el catálogo no trae cambiadas por su equivalente)
 * y los curados. Todas las familias existen en el catálogo, así que la vista previa y la landing las cargan.
 */
export function paresSugeridos(catalogo: readonly EntradaFuente[] = CATALOGO): ParSugerido[] {
  const hay = (n: string) => catalogo.some((x) => x.familia.toLowerCase() === n.toLowerCase());
  const deSemilla: ParSugerido[] = TIPOGRAFIAS.map((t) => ({ id: t.id, titulos: enCatalogo(t.titulos), cuerpo: enCatalogo(t.cuerpo), origen: "semilla" as const }));
  const curados: ParSugerido[] = CURADOS.map((c) => ({
    id: `${c.titulos}-${c.cuerpo}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    ...c,
    origen: "catalogo" as const,
  }));
  return [...deSemilla, ...curados].filter((p) => hay(p.titulos) && hay(p.cuerpo)).slice(0, 8);
}

/** Filtra por nombre (sin distinguir mayúsculas ni tildes) y por categoría; ordena por popularidad. */
export function filtrarFuentes(catalogo: readonly EntradaFuente[], busqueda: string, categoria: CategoriaFuente | "todas"): EntradaFuente[] {
  const limpiar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const q = limpiar(busqueda);
  return catalogo
    .filter((x) => (categoria === "todas" || x.categoria === categoria) && (q === "" || limpiar(x.familia).includes(q)))
    .sort((a, b) => a.popularidad - b.popularidad);
}
