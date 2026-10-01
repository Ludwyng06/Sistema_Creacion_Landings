import type { EfectoId, LandingDoc, Seccion, Semilla, TipoLanding, TipoSeccion, Tokens } from "@/lib/contratos";
import { CATALOGO_EFECTOS } from "@/lib/contratos/efectos";
import { PALETAS, TIPOGRAFIAS, mulberry32, semillaManual, tirarSemilla } from "@/lib/tecnicas/semillas";
import { conVariante, tieneVariantes, varianteActual, variantesDe } from "@/secciones/catalogo-variantes";
import { BLUEPRINTS } from "./blueprints";

// Motor de diversidad (tarea 24-A): cada landing sale distinta de las anteriores.
// Todas las decisiones de forma (semilla, tokens, héroe, variantes, orden, efectos, marco, entrada) salen de un número de semilla al azar,
// que queda en `meta.semilla.numero` para reproducirlas. Antes de aceptar el número se compara su huella con la de las últimas 12 landings.

export const HISTORIAL = 12;
export const RECIENTES = 4;
export const DISTANCIA_MINIMA = 0.5;
export const MAX_INTENTOS = 20;

export const MARCOS = ["PAS", "AIDA", "BAB", "4P", "StoryBrand"] as const;
export type Marco = (typeof MARCOS)[number];
/** El contrato (`meta.marco`) solo admite AIDA o PAS: los otros tres se registran con el más cercano. */
export const MARCO_EN_META: Record<Marco, "AIDA" | "PAS"> = { PAS: "PAS", AIDA: "AIDA", BAB: "PAS", "4P": "AIDA", StoryBrand: "AIDA" };

type Entrada = "subir" | "aparecer" | "escala";

export interface Decisiones {
  semilla: Semilla;
  tokens: Tokens;
  heroe: string;
  marco: Marco;
  /** Variante por tipo de sección (solo tipos con variantes que se ven sin imagen extra). */
  variantes: Record<string, string>;
  /** Orden de las secciones que escribe la IA (el héroe siempre primero; el cierre, al final). */
  orden: TipoSeccion[];
  /** Efectos por tipo de sección, ya compatibles con la variante del héroe y la intensidad. */
  efectos: Record<string, EfectoId[]>;
  entrada: Record<string, Entrada>;
}

export interface Huella {
  estilo: string;
  industria: string;
  paleta: string;
  tipografia: string;
  radio: number;
  espaciado: string;
  borde: string;
  imagen: string;
  escala: string;
  intensidad: number;
  heroe: string;
  marco: string;
  variantes: Record<string, string>;
  orden: string[];
  efectos: string[];
}

// ---------- Helpers ----------

type Azar = () => number;

function elegirPonderado<T>(azar: Azar, opciones: { valor: T; peso: number }[]): T {
  const total = opciones.reduce((t, o) => t + o.peso, 0);
  let r = azar() * total;
  for (const o of opciones) {
    r -= o.peso;
    if (r <= 0) return o.valor;
  }
  return opciones[opciones.length - 1].valor;
}

function barajar<T>(azar: Azar, lista: readonly T[]): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Secciones de las que el sistema decide el contenido y el lugar: no entran en el orden ni en las decisiones de la IA. */
const SECCIONES_DEL_SISTEMA: readonly string[] = ["dato-en-vivo", "dato-curioso", "sellos-confianza", "ficha-tecnica", "creditos", "cta-fija"];
/** Secciones con un lugar fijo en el camino de la persona: el resto se permuta entre sus huecos. */
const FIJAS: readonly string[] = ["heroe", "problema-solucion", "resumen", "linea-tiempo", "oferta", "garantia", "faq", "formulario-lead"];
/** Variantes que necesitan una imagen extra del banco: no se eligen al azar. */
const VARIANTES_CON_IMAGEN_EXTRA: readonly string[] = ["imagen-alterna", "pasos-con-imagen", "con-imagen", "fondo-banco"];
/** El héroe de dato en vivo o de otro tipo lo fija el sistema. */
const SIN_VARIANTE_AL_AZAR: readonly string[] = ["heroe", "dato-en-vivo", "dato-curioso"];

/** Héroes que funcionan con una sola imagen o con ninguna (nunca el héroe partido). `antes-despues-heroe` y `mosaico-editorial` piden varias imágenes. */
export const HEROES_DE_UNA_IMAGEN = ["producto-monumental", "poster-a-sangre", "titular-tipografico", "problema-primero", "video-inmersivo", "orbita-beneficios"] as const;

const P_INTENSIDAD_3: Record<TipoLanding, number> = { producto: 0.8, evento: 0.7, curso: 0.6, app: 0.6, servicio: 0.5, local: 0.4, causa: 0.4, divulgacion: 0.3 };

// ---------- Huella ----------

function efectosDe(secciones: Seccion[]): string[] {
  return secciones.flatMap((s) => (s.efectos ?? []).map((e) => `${s.tipo}:${e}`)).sort();
}

export function huellaDeDoc(doc: LandingDoc): Huella {
  const heroe = doc.secciones.find((s) => s.tipo === "heroe");
  const propias = doc.secciones.filter((s) => !SECCIONES_DEL_SISTEMA.includes(s.tipo));
  const variantes: Record<string, string> = {};
  for (const s of doc.secciones) {
    if (SIN_VARIANTE_AL_AZAR.includes(s.tipo) || !tieneVariantes(s.tipo)) continue;
    const v = varianteActual(s);
    if (v) variantes[s.tipo] = v;
  }
  const t = doc.tokens;
  return {
    estilo: doc.meta.semilla.estilo,
    industria: doc.meta.semilla.industria,
    paleta: doc.meta.semilla.paletaId,
    tipografia: doc.meta.semilla.tipografiaId,
    radio: t.radio,
    espaciado: t.espaciado,
    borde: t.borde,
    imagen: t.imagen,
    escala: t.tipografia.escala,
    intensidad: t.intensidad,
    heroe: heroe?.variante ?? "",
    marco: doc.meta.marco,
    variantes,
    orden: propias.map((s) => s.tipo),
    efectos: efectosDe(propias),
  };
}

const CAMPOS_ESCALARES = ["estilo", "industria", "paleta", "tipografia", "radio", "espaciado", "borde", "imagen", "escala", "intensidad", "heroe", "marco"] as const;

function fraccionDistinta(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const union = new Set([...A, ...B]);
  if (union.size === 0) return 0;
  let comunes = 0;
  for (const x of A) if (B.has(x)) comunes++;
  return 1 - comunes / union.size;
}

/** Proporción de campos distintos entre dos huellas (0 = iguales, 1 = nada en común). Variantes, orden y efectos cuentan por fracción. */
export function distanciaHuellas(a: Huella, b: Huella): number {
  let suma = 0;
  for (const c of CAMPOS_ESCALARES) if (a[c] !== b[c]) suma++;
  const tiposComunes = Object.keys(a.variantes).filter((k) => k in b.variantes);
  suma += tiposComunes.length ? tiposComunes.filter((k) => a.variantes[k] !== b.variantes[k]).length / tiposComunes.length : 0;
  suma += fraccionDistinta(a.orden.map((t, i) => `${i}:${t}`), b.orden.map((t, i) => `${i}:${t}`));
  suma += fraccionDistinta(a.efectos, b.efectos);
  return suma / (CAMPOS_ESCALARES.length + 3);
}

export function huellaDeDecisiones(d: Decisiones): Huella {
  return {
    estilo: d.semilla.estilo,
    industria: d.semilla.industria,
    paleta: d.semilla.paletaId,
    tipografia: d.semilla.tipografiaId,
    radio: d.tokens.radio,
    espaciado: d.tokens.espaciado,
    borde: d.tokens.borde,
    imagen: d.tokens.imagen,
    escala: d.tokens.tipografia.escala,
    intensidad: d.tokens.intensidad,
    heroe: d.heroe,
    marco: MARCO_EN_META[d.marco],
    variantes: d.variantes,
    orden: d.orden.filter((t) => !SECCIONES_DEL_SISTEMA.includes(t)),
    efectos: Object.entries(d.efectos).flatMap(([t, es]) => es.map((e) => `${t}:${e}`)).sort(),
  };
}

// ---------- Decisiones a partir de un número ----------

export interface EntradaDecisiones {
  numero: number;
  tipo: TipoLanding;
  /** Secciones que escribe la IA (obligatorias, en su orden, y las opcionales que entran). */
  obligatorias: TipoSeccion[];
  opcionales: TipoSeccion[];
  /** Secciones del sistema que entrarán (para sus variantes). */
  delSistema: TipoSeccion[];
  /** Huellas de las últimas landings, la más reciente primero. */
  historial: Huella[];
  /** Héroes que no se pueden repetir (los de las últimas 4). */
  heroesRecientes: string[];
  /** Reparación final: paleta y tipografía forzadas cuando 20 tiradas no lograron esquivar las de las últimas 4. */
  forzar?: { paletaId?: string; tipografiaId?: string };
}

function ordenarPlan(azar: Azar, obligatorias: TipoSeccion[], opcionales: TipoSeccion[]): TipoSeccion[] {
  // Las opcionales entran antes de la pregunta frecuente (o del cierre) y las obligatorias sueltas se permutan entre sus huecos.
  const cierre = obligatorias.findIndex((t) => t === "faq" || t === "garantia" || t === "formulario-lead");
  const cuerpo = obligatorias.slice(0, cierre === -1 ? obligatorias.length : cierre);
  const resto = obligatorias.slice(cuerpo.length);
  const todas = [...cuerpo];
  for (const o of barajar(azar, opcionales)) todas.splice(1 + Math.floor(azar() * Math.max(1, todas.length)), 0, o);
  const sueltas = todas.filter((t) => !FIJAS.includes(t));
  const baraja = barajar(azar, sueltas);
  let k = 0;
  const colocadas = todas.map((t) => (FIJAS.includes(t) ? t : baraja[k++]));
  return [...colocadas, ...resto];
}

function elegirEfectos(azar: Azar, orden: TipoSeccion[], heroe: string, intensidad: number): Record<string, EfectoId[]> {
  const out: Record<string, EfectoId[]> = {};
  let nivel3 = 0;
  const MAX3 = 2; // el tope del catálogo es 3; se deja uno de margen para los 60 fps
  const poner = (tipo: string, e: EfectoId, p: number): void => {
    const def = CATALOGO_EFECTOS[e];
    if (azar() >= p || def.nivel > intensidad) return;
    if (def.secciones.length && !def.secciones.includes("global") && !(def.secciones as string[]).includes(tipo)) return;
    if (tipo === "heroe" && def.variantesHeroe && !def.variantesHeroe.some((v) => v === heroe)) return;
    if (def.nivel === 3) {
      if (nivel3 >= MAX3) return;
      nivel3++;
    }
    const lista = (out[tipo] ??= []);
    if (!lista.includes(e)) lista.push(e);
  };
  // Héroe: un movimiento de titular o de máscara, el botón magnético a veces y, con intensidad 3, a veces un shader de nivel 3.
  poner("heroe", elegirPonderado<EfectoId>(azar, [{ valor: "titular-cinetico", peso: 3 }, { valor: "mascara-circular", peso: 2 }, { valor: "mascara-persiana", peso: 2 }]), 0.75);
  poner("heroe", "boton-magnetico", 0.6);
  poner("heroe", "shader-ondas", 0.3);
  poner("heroe", "grano", 0.35);
  poner("heroe", "cursor-vivo", 0.25);
  const unica = new Set<string>();
  for (const tipo of orden) {
    if (tipo === "heroe") continue;
    if (tipo === "galeria") {
      poner(tipo, "horizontal", 0.35);
      poner(tipo, elegirPonderado<EfectoId>(azar, [{ valor: "mascara-circular", peso: 1 }, { valor: "mascara-persiana", peso: 1 }]), 0.3);
    }
    if ((tipo === "beneficios" || tipo === "como-funciona") && !unica.has("pin") && azar() < 0.5) {
      unica.add("pin");
      poner(tipo, "pin-coreografia", 0.6);
    }
    if (tipo === "oferta") {
      poner(tipo, "precio-cae", 0.6);
      poner(tipo, "boton-magnetico", 0.5);
    }
    if (tipo === "formulario-lead") poner(tipo, elegirPonderado<EfectoId>(azar, [{ valor: "boton-magnetico", peso: 2 }, { valor: "titular-cinetico", peso: 1 }]), 0.45);
    if (tipo === "problema-solucion") poner(tipo, "titular-cinetico", 0.3);
    poner(tipo, "revelar-suave", 0.5);
  }
  return out;
}

export function decidir(e: EntradaDecisiones): Decisiones {
  const azarForma = mulberry32(e.numero + 31); // flujo aparte del de la semilla y los tokens
  const intensidad = azarForma() < P_INTENSIDAD_3[e.tipo] ? 3 : 2;
  const tirada = tirarSemilla(e.numero, intensidad);
  const { semilla, tokens } = e.forzar
    ? semillaManual({ ...tirada.semilla, paletaId: e.forzar.paletaId ?? tirada.semilla.paletaId, tipografiaId: e.forzar.tipografiaId ?? tirada.semilla.tipografiaId, intensidad })
    : tirada;
  const bp = BLUEPRINTS[e.tipo];
  const heroe = elegirPonderado<string>(
    azarForma,
    HEROES_DE_UNA_IMAGEN.filter((h) => !e.heroesRecientes.includes(h)).map((h) => ({ valor: h as string, peso: bp.heroes.includes(h) ? 3 : 1 })),
  );
  const marco = MARCOS[Math.floor(azarForma() * MARCOS.length)];
  const orden = ordenarPlan(azarForma, e.obligatorias, e.opcionales);
  const previa = e.historial[0]?.variantes ?? {};
  const variantes: Record<string, string> = {};
  for (const tipo of [...orden, ...e.delSistema]) {
    if (SIN_VARIANTE_AL_AZAR.includes(tipo) || !tieneVariantes(tipo) || tipo in variantes) continue;
    const claves = variantesDe(tipo).map((v) => v.clave).filter((c) => !VARIANTES_CON_IMAGEN_EXTRA.includes(c));
    const libres = claves.filter((c) => c !== previa[tipo]);
    const lista = libres.length ? libres : claves;
    if (lista.length) variantes[tipo] = lista[Math.floor(azarForma() * lista.length)];
  }
  const efectos = elegirEfectos(azarForma, orden, heroe, intensidad);
  const dominante = elegirPonderado<Entrada>(azarForma, [{ valor: "subir", peso: 5 }, { valor: "aparecer", peso: 3 }, { valor: "escala", peso: 2 }]);
  const entrada: Record<string, Entrada> = {};
  for (const tipo of orden) entrada[tipo] = azarForma() < 0.7 ? dominante : elegirPonderado<Entrada>(azarForma, [{ valor: "subir", peso: 1 }, { valor: "aparecer", peso: 1 }, { valor: "escala", peso: 1 }]);
  return { semilla, tokens, heroe, marco, variantes, orden, efectos, entrada };
}

// ---------- Anti-repetición ----------

export interface ResultadoDiversidad {
  decisiones: Decisiones;
  huella: Huella;
  intentos: number;
  /** Distancia mínima contra las últimas 12 (1 si no hay historial). */
  distanciaMinima: number;
  /** `true` si ningún número de los 20 intentos cumplió todas las reglas y se tomó el mejor. */
  agotado: boolean;
}

function violaciones(h: Huella, d: Decisiones, historial: Huella[]): { cuenta: number; min: number } {
  const recientes = historial.slice(0, RECIENTES);
  let cuenta = 0;
  if (recientes.some((r) => r.paleta === h.paleta)) cuenta++;
  if (recientes.some((r) => r.tipografia === h.tipografia)) cuenta++;
  if (recientes.some((r) => r.heroe === d.heroe)) cuenta++;
  let min = 1;
  for (const r of historial.slice(0, HISTORIAL)) {
    const dist = distanciaHuellas(h, r);
    if (dist < min) min = dist;
    if (dist < DISTANCIA_MINIMA) cuenta++;
  }
  return { cuenta, min };
}

/**
 * Tira números al azar (hasta 20 veces) hasta que la huella no repita paleta, tipografía ni héroe de las últimas 4
 * y esté a ≥ 0,5 de distancia de cada una de las últimas 12. Si ninguno cumple, se queda con el que menos reglas rompe.
 */
export function elegirDiversidad(base: Omit<EntradaDecisiones, "numero" | "heroesRecientes">, azar: Azar = Math.random, maxIntentos = MAX_INTENTOS): ResultadoDiversidad {
  const heroesRecientes = base.historial.slice(0, RECIENTES).map((h) => h.heroe);
  let mejor: { d: Decisiones; h: Huella; cuenta: number; min: number; intento: number } | null = null;
  for (let intento = 1; intento <= maxIntentos; intento++) {
    const numero = Math.floor(azar() * 1_000_000);
    const d = decidir({ ...base, numero, heroesRecientes });
    const h = huellaDeDecisiones(d);
    const v = violaciones(h, d, base.historial);
    if (!mejor || v.cuenta < mejor.cuenta || (v.cuenta === mejor.cuenta && v.min > mejor.min)) mejor = { d, h, ...v, intento };
    if (v.cuenta === 0) return { decisiones: d, huella: h, intentos: intento, distanciaMinima: v.min, agotado: false };
  }
  const m = mejor!;
  // Ninguna tirada cumplió todo: se repara lo duro (paleta y tipografía distintas de las últimas 4) y se mide de nuevo.
  const recientes = base.historial.slice(0, RECIENTES);
  const libresPaleta = PALETAS.filter((p) => !recientes.some((r) => r.paleta === p.id));
  const libresTipo = TIPOGRAFIAS.filter((t) => !recientes.some((r) => r.tipografia === t.id));
  const forzar = {
    ...(recientes.some((r) => r.paleta === m.h.paleta) && libresPaleta.length ? { paletaId: libresPaleta[Math.floor(azar() * libresPaleta.length)].id } : {}),
    ...(recientes.some((r) => r.tipografia === m.h.tipografia) && libresTipo.length ? { tipografiaId: libresTipo[Math.floor(azar() * libresTipo.length)].id } : {}),
  };
  if (!Object.keys(forzar).length) return { decisiones: m.d, huella: m.h, intentos: maxIntentos, distanciaMinima: m.min, agotado: m.cuenta > 0 };
  const d = decidir({ ...base, numero: m.d.semilla.numero, heroesRecientes, forzar });
  const h = huellaDeDecisiones(d);
  const v = violaciones(h, d, base.historial);
  return { decisiones: d, huella: h, intentos: maxIntentos, distanciaMinima: v.min, agotado: v.cuenta > 0 };
}

// ---------- Aplicar las decisiones al documento ----------

/** Ordena el plan que devolvió el modelo según las decisiones y deja el héroe primero. */
export function ordenarSegunDecisiones<T extends { tipo: string }>(plan: T[], orden: string[]): T[] {
  const pos = (t: string) => {
    const i = orden.indexOf(t);
    return i === -1 ? orden.length : i;
  };
  return plan.map((s, i) => ({ s, i })).sort((a, b) => pos(a.s.tipo) - pos(b.s.tipo) || a.i - b.i).map((x) => x.s);
}

/** Variante, entrada de animación y efectos elegidos para una sección (el héroe conserva su variante). */
export function aplicarASeccion(s: Seccion, d: Decisiones): Seccion {
  let r = s;
  const v = d.variantes[s.tipo];
  if (v && s.tipo !== "heroe") r = conVariante(r, v);
  const entrada = d.entrada[s.tipo];
  if (entrada) r = { ...r, animacion: { entrada, retraso: r.animacion?.retraso ?? 0 } };
  const efectos = d.efectos[s.tipo];
  if (efectos?.length) r = { ...r, efectos: [...new Set([...(r.efectos ?? []), ...efectos])] };
  return r;
}

/** Texto para la estrategia: lo que ya usaron las últimas landings y no se debe repetir. */
export function resumenParaEvitar(docs: LandingDoc[], max = 3): string {
  const lineas = docs.slice(0, max).map((doc, i) => {
    const h = doc.secciones.find((s) => s.tipo === "heroe");
    const titular = typeof h?.ajustes.titular === "string" ? h.ajustes.titular : doc.meta.nombre;
    const estructura = doc.secciones.filter((s) => !SECCIONES_DEL_SISTEMA.includes(s.tipo)).map((s) => s.tipo).join(" → ");
    return `${i + 1}. «${doc.meta.nombre}» (${doc.meta.marco}, conciencia ${doc.meta.nivelConciencia}): titular «${titular}»; estructura ${estructura}.`;
  });
  return lineas.length
    ? `LANDINGS RECIENTES DEL SISTEMA (evita estos ángulos, titulares y estructuras; esta landing debe sentirse hecha por otra persona):\n${lineas.join("\n")}`
    : "";
}
