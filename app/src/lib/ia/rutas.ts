import type { LandingDoc } from "@/lib/contratos";

// Rutas como `secciones[2].bloques[0].ajustes.texto`: leer, escribir y proteger campos editados a mano.

type Parte = string | number;

export function partesDeRuta(ruta: string): Parte[] {
  const partes: Parte[] = [];
  for (const m of ruta.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) partes.push(m[2] !== undefined ? Number(m[2]) : m[1]);
  return partes;
}

export function leerRuta(objeto: unknown, ruta: string): unknown {
  let actual: unknown = objeto;
  for (const p of partesDeRuta(ruta)) {
    if (actual === null || typeof actual !== "object") return undefined;
    actual = (actual as Record<Parte, unknown>)[p];
  }
  return actual;
}

/** Devuelve una copia con `valor` en `ruta`, o el mismo objeto si la ruta no existe. */
export function escribirRuta<T>(objeto: T, ruta: string, valor: unknown): T {
  const partes = partesDeRuta(ruta);
  if (partes.length === 0 || leerRuta(objeto, ruta) === undefined) return objeto;
  const copia = structuredClone(objeto);
  let actual = copia as Record<Parte, unknown>;
  for (const p of partes.slice(0, -1)) actual = actual[p] as Record<Parte, unknown>;
  actual[partes[partes.length - 1]] = valor;
  return copia;
}

/**
 * Un campo está protegido si la sección lo lista en `editadoPorHumano`. Se aceptan la ruta
 * completa, la ruta relativa a la sección (`ajustes.titular`), el nombre del ajuste (`titular`)
 * o un ancestro (`bloques[0]`).
 */
export function rutaProtegida(doc: LandingDoc, ruta: string): boolean {
  const m = /^secciones\[(\d+)\]\.?(.*)$/.exec(ruta);
  if (!m) return false;
  const lista = doc.secciones[Number(m[1])]?.editadoPorHumano ?? [];
  if (lista.length === 0) return false;
  const relativa = m[2];
  const sinAjustes = relativa.replace(/^ajustes\./, "");
  return lista.some(
    (e) =>
      e === ruta ||
      e === relativa ||
      e === sinAjustes ||
      relativa.startsWith(`${e}.`) ||
      relativa.startsWith(`${e}[`) ||
      sinAjustes.startsWith(`${e}.`) ||
      sinAjustes.startsWith(`${e}[`),
  );
}

/** Todos los strings de `ajustes` y `bloques`, con su ruta. */
export function textosDelDoc(doc: LandingDoc): { ruta: string; texto: string }[] {
  const salida: { ruta: string; texto: string }[] = [];
  const recorrer = (valor: unknown, ruta: string) => {
    if (typeof valor === "string") salida.push({ ruta, texto: valor });
    else if (Array.isArray(valor)) valor.forEach((v, i) => recorrer(v, `${ruta}[${i}]`));
    else if (valor && typeof valor === "object") {
      for (const [k, v] of Object.entries(valor)) recorrer(v, `${ruta}.${k}`);
    }
  };
  doc.secciones.forEach((s, i) => {
    recorrer(s.ajustes, `secciones[${i}].ajustes`);
    s.bloques.forEach((b, j) => recorrer(b.ajustes, `secciones[${i}].bloques[${j}].ajustes`));
  });
  return salida;
}

/** Como `escribirRuta`, pero crea los objetos y arreglos intermedios que falten. */
export function forzarRuta<T>(objeto: T, ruta: string, valor: unknown): T {
  const partes = partesDeRuta(ruta);
  if (partes.length === 0) return objeto;
  const copia = structuredClone(objeto);
  let actual = copia as Record<Parte, unknown>;
  partes.slice(0, -1).forEach((p, i) => {
    if (actual[p] === undefined || actual[p] === null || typeof actual[p] !== "object") {
      actual[p] = typeof partes[i + 1] === "number" ? [] : {};
    }
    actual = actual[p] as Record<Parte, unknown>;
  });
  actual[partes[partes.length - 1]] = structuredClone(valor);
  return copia;
}

type Seccion = LandingDoc["secciones"][number];

/** Rutas relativas a la sección (`ajustes.titular`, `bloques[0].ajustes.texto`) de todos sus textos. */
function textosDeSeccion(s: Seccion): { ruta: string; texto: string }[] {
  const salida: { ruta: string; texto: string }[] = [];
  const recorrer = (valor: unknown, ruta: string) => {
    if (typeof valor === "string") salida.push({ ruta, texto: valor });
    else if (Array.isArray(valor)) valor.forEach((v, i) => recorrer(v, `${ruta}[${i}]`));
    else if (valor && typeof valor === "object") {
      for (const [k, v] of Object.entries(valor)) recorrer(v, `${ruta}.${k}`);
    }
  };
  recorrer(s.ajustes, "ajustes");
  s.bloques.forEach((b, j) => recorrer(b.ajustes, `bloques[${j}].ajustes`));
  return salida;
}

/**
 * Compara un documento guardado con el que edita una persona y añade a `editadoPorHumano`
 * de cada sección las rutas (relativas a la sección) de los textos que cambiaron.
 * Las secciones y bloques nuevos no se marcan: traen los valores por defecto del editor.
 */
export function marcarEditadoPorHumano(anterior: LandingDoc, nuevo: LandingDoc): LandingDoc {
  const previas = new Map(anterior.secciones.map((s) => [s.id, s]));
  const secciones = nuevo.secciones.map((s) => {
    const previa = previas.get(s.id);
    if (!previa) return s;
    const bloquesPrevios = new Map(previa.bloques.map((b) => [b.id, b]));
    const cambiadas: string[] = [];
    for (const { ruta, texto } of textosDeSeccion(s)) {
      const bloque = /^bloques\[(\d+)\]/.exec(ruta);
      let base: unknown = previa;
      let rutaPrevia = ruta;
      if (bloque) {
        const previo = bloquesPrevios.get(s.bloques[Number(bloque[1])].id);
        if (!previo) continue; // bloque nuevo
        base = { ...previa, bloques: [previo] };
        rutaPrevia = ruta.replace(/^bloques\[\d+\]/, "bloques[0]");
      }
      const antes = leerRuta(base, rutaPrevia);
      if (typeof antes === "string" && antes !== texto) cambiadas.push(ruta);
      if (antes === undefined && !bloque) cambiadas.push(ruta); // campo de la sección que la persona añadió
    }
    if (cambiadas.length === 0) return s;
    const marcadas = [...new Set([...(s.editadoPorHumano ?? []), ...cambiadas])];
    return { ...s, editadoPorHumano: marcadas };
  });
  return { ...nuevo, secciones };
}

/** Valores de las rutas protegidas de una sección, listos para restaurarlos en otra versión. */
export function valoresProtegidos(seccion: Seccion): { ruta: string; valor: unknown }[] {
  const salida: { ruta: string; valor: unknown }[] = [];
  for (const e of seccion.editadoPorHumano ?? []) {
    if (leerRuta(seccion, e) !== undefined) salida.push({ ruta: e, valor: leerRuta(seccion, e) });
    else if (leerRuta(seccion.ajustes, e) !== undefined) salida.push({ ruta: `ajustes.${e}`, valor: leerRuta(seccion.ajustes, e) });
  }
  return salida;
}
