import type { Seccion } from "@/lib/contratos";
import { idsConFondoSuave } from "./presentacion";

// Fondos de sección con personalidad: el ritmo de fondos (una sección de cuerpo sí y otra no) se pinta con un tratamiento que
// depende del estilo de la semilla. Todo sale de los tokens (`globals.css`, `[data-fondo]`): mezclas muy suaves de acento, superficie
// y texto, para que el contraste AA del texto no cambie.

export const FONDOS_RITMO = ["suave", "acento-suave", "linea", "linea-gruesa", "textura-puntos", "textura-cuadricula", "textura-diagonal", "textura-lineas"] as const;
export type FondoRitmo = (typeof FONDOS_RITMO)[number] | "liso";

/** Tratamientos por estilo, en el orden en que se reparten entre las secciones del ritmo. */
export const FONDOS_POR_ESTILO: Record<string, readonly FondoRitmo[]> = {
  "Bauhaus funcional": ["suave", "acento-suave", "linea"],
  "Swiss International": ["linea", "suave"],
  "editorial de revista de los 70": ["suave", "acento-suave"],
  "brutalismo tipográfico": ["linea-gruesa", "suave"],
  "Art Déco geométrico": ["acento-suave", "textura-lineas"],
  "catálogo técnico de patentes de los 50": ["textura-cuadricula", "suave"],
  "Memphis contenido": ["acento-suave", "textura-puntos"],
  "japonés ma (espacio negativo)": ["liso", "linea"],
  "constructivismo ruso": ["textura-diagonal", "acento-suave"],
  "cartel suizo de farmacia": ["linea", "acento-suave"],
  "manual de instrucciones industrial": ["textura-cuadricula", "linea"],
  "minimalismo de museo": ["liso", "suave"],
};
const POR_DEFECTO: readonly FondoRitmo[] = ["suave"];

/**
 * Qué fondo lleva cada sección del ritmo (las demás no aparecen). Con `numero` de la semilla arranca en un punto distinto del
 * ciclo, así dos landings del mismo estilo no alternan igual.
 */
export function fondosDeRitmo(secciones: Seccion[], estilo: string | undefined, numero = 0): Map<string, FondoRitmo> {
  const patron = (estilo && FONDOS_POR_ESTILO[estilo]) || POR_DEFECTO;
  const delRitmo = idsConFondoSuave(secciones);
  const salida = new Map<string, FondoRitmo>();
  let k = Math.abs(Math.trunc(numero)) % patron.length;
  for (const s of secciones) {
    if (!delRitmo.has(s.id)) continue;
    const f = patron[k % patron.length];
    k += 1;
    if (f !== "liso") salida.set(s.id, f);
  }
  return salida;
}
