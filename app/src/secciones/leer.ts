import type { Seccion } from "@/lib/contratos";

type Esquema = { safeParse(valor: unknown): { success: boolean; data?: unknown } };

const ESQUEMAS = new Map<string, Esquema>();

/** La app (editor, /crear, pruebas) registra los esquemas de las 18 secciones; ver `esquemas.ts`. */
export function registrarEsquemas(esquemas: Partial<Record<string, Esquema>>): void {
  for (const [tipo, esquema] of Object.entries(esquemas)) if (esquema) ESQUEMAS.set(tipo, esquema);
}

/**
 * Lee `ajustes` y `bloques` de una sección. Con el esquema de su tipo registrado los valida y devuelve `null` si no
 * cumplen, para que el componente no rompa la landing entera. Las páginas públicas no cargan los esquemas (zod pesa
 * ~90 KB en el navegador): `/l/[slug]` valida cada sección en el servidor y aquí solo se comprueba la forma.
 */
export function leerSeccion<D extends { ajustes: unknown; bloques: unknown }>(seccion: Seccion): D | null {
  const esquema = ESQUEMAS.get(seccion.tipo);
  if (esquema) {
    const resultado = esquema.safeParse({ ajustes: seccion.ajustes, bloques: seccion.bloques });
    return resultado.success ? (resultado.data as D) : null;
  }
  if (!seccion.ajustes || typeof seccion.ajustes !== "object" || !Array.isArray(seccion.bloques)) return null;
  return { ajustes: seccion.ajustes, bloques: seccion.bloques } as D;
}
