import type { CategoriaBrief } from "@/lib/contratos";
import { tieneCifra } from "./cifras";
import type { Fragmento } from "./fragmentos";
import { fuentesDe, type ResumenIA } from "./resumen";
import type { BorradorBrief, CampoBorrador, Fuente, Identificacion, Sugerencia, Sugerencias } from "@/lib/contratos";

// Arma el borrador del Brief. Solo existen los campos que se pueden proponer: precio, pruebaSocial, oferta y garantia
// no se construyen nunca, aunque las fuentes los traigan. Nada con cifras entra al borrador: sigue en `sugerencias`, marcado.

/** Confianza tope según cuántas fuentes distintas respaldan el dato: una sola fuente no da certeza. */
const TOPE_POR_FUENTES = [0, 0.55, 0.75, 0.9];
const tope = (n: number) => TOPE_POR_FUENTES[Math.min(n, 3)];
const redondear = (n: number) => Math.round(n * 100) / 100;
const unirFuentes = (listas: Fuente[][]): Fuente[] => [...new Map(listas.flat().map((f) => [f.url, f])).values()];

export interface EntradaBorrador {
  nombre: string;
  /** Categoría que la persona ya eligió, si la hay: entonces no se propone otra. */
  categoria?: CategoriaBrief;
  identificacion: Identificacion | null;
  resumen: ResumenIA;
  sugerencias: Sugerencias;
  fragmentos: Fragmento[];
  colores: string[];
  fotoRuta?: string;
}

export function armarBorrador(e: EntradaBorrador): BorradorBrief {
  const b: BorradorBrief = {};

  if (!e.categoria) {
    if (e.identificacion?.reconocido) {
      b.categoria = { valor: e.identificacion.categoriaSugerida, fuentes: [], confianza: redondear(e.identificacion.confianza), origen: "foto" };
    } else if (e.resumen.categoria) {
      b.categoria = { valor: e.resumen.categoria, fuentes: [], confianza: 0.4, origen: "busqueda" };
    }
  }

  const lista = (items: Sugerencia[], max: number): CampoBorrador<string[]> | undefined => {
    const limpias = items.filter((s) => !s.tieneCifra && !tieneCifra(s.texto, e.nombre)).slice(0, max);
    if (limpias.length === 0) return undefined;
    const fuentes = unirFuentes(limpias.map((s) => s.fuentes));
    return { valor: limpias.map((s) => s.texto), fuentes, confianza: redondear(Math.min(tope(fuentes.length), 0.85)), origen: "busqueda" };
  };
  const beneficios = lista(e.sugerencias.beneficios, 5);
  if (beneficios) b.beneficios = beneficios;
  const objeciones = lista(e.sugerencias.objeciones, 5);
  if (objeciones) b.objeciones = objeciones;

  const incluye = lista(
    e.resumen.incluye
      .map((i) => ({ texto: i.texto.replace(/\s+/g, " ").trim(), fuentes: fuentesDe(i.fuentes, e.fragmentos), tieneCifra: i.tieneCifra }))
      .filter((i) => i.fuentes.length > 0),
    8,
  );
  if (incluye) b.incluye = incluye;

  const frase = (c: ResumenIA["problema"]): CampoBorrador<string> | undefined => {
    if (!c) return undefined;
    const fuentes = fuentesDe(c.fuentes, e.fragmentos);
    const texto = c.texto.replace(/\s+/g, " ").trim();
    if (fuentes.length === 0 || tieneCifra(texto, e.nombre)) return undefined;
    return { valor: texto, fuentes, confianza: redondear(Math.min(c.confianza, tope(fuentes.length))), origen: "busqueda" };
  };
  const problema = frase(e.resumen.problema);
  if (problema) b.problema = problema;
  const publico = frase(e.resumen.publico);
  if (publico) b.publico = publico;

  const n = e.resumen.nivelConciencia;
  if (n && !tieneCifra(n.motivo, e.nombre)) {
    b.nivelConciencia = {
      valor: n.valor,
      motivo: n.motivo.replace(/\s+/g, " ").trim(),
      fuentes: fuentesDe(n.fuentes, e.fragmentos),
      confianza: redondear(Math.min(n.confianza, 0.7)),
      origen: "busqueda",
    };
  }

  if (e.colores.length > 0) b.coloresMarca = { valor: e.colores.slice(0, 3), fuentes: [], confianza: 0.6, origen: "foto" };
  if (e.fotoRuta) b.fotos = { valor: [e.fotoRuta], fuentes: [], confianza: 1, origen: "foto" };
  return b;
}
