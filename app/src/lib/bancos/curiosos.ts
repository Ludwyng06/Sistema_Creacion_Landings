import { z } from "zod";
import type { DatoCurioso } from "@/lib/contratos";
import type { DepsEnrutador } from "@/lib/ia/enrutador";
import { ejecutar } from "@/lib/ia/enrutador";
import { lintearTexto } from "@/lib/tecnicas/lista-negra";
import type { AsteroidesDelDia } from "@/lib/fuentes/neows";
import type { Lanzamiento } from "@/lib/fuentes/lanzamientos";

// Banco b8 «datos curiosos»: frases «¿Sabías que…?» en español, reescritas por la IA a partir de datos reales
// (descripciones de NASA Images, NeoWs y Launch Library 2), cada una con su fuente. Nada sin fuente: la IA no aporta datos,
// solo reescribe; el código descarta toda frase con una cifra que el dato original no traiga.

export interface Hecho {
  id: string;
  /** Texto original (en inglés) del que sale la frase. */
  texto: string;
  tema: string;
  fuente: { nombre: string; url?: string };
}

export const META_MINIMA = 20;
export const META_MAXIMA = 30;

/** Oraciones de una ficha de NASA que explican algo (una cifra con unidad, un superlativo, una causa) y no son un pie de foto. */
export function oracionesConDatos(texto: string): string[] {
  const limpio = texto
    .replace(/<[^>]*>/g, " ")
    .replace(/^[A-Za-z0-9_-]+ *[(][^)]*[)] *-{2,} */, "") // «ISS023-E-058455 (29 May 2010) --- »
    .replace(/\s+/g, " ")
    .trim();
  const oraciones = limpio.split(/(?<=[.!?])\s+(?=[A-Z])/).map((o) => o.trim());
  const escala = /\b\d[0-9.,]* *(million|billion|thousand|light[- ]years?|miles|kilometers|km|meters|feet|degrees|percent|years?|days|hours|tons|mph|kph|celsius|fahrenheit)\b|\b(million|billion)\b|\blight[- ]years?\b/i;
  const explica = /\b(are|is) (created|caused|made|formed|known|called)\b|\b(largest|smallest|hottest|coldest|brightest|farthest|only|first time)\b|\b(called|known as|consists of|travels?|orbits?|rain down|interact with)\b/i;
  // Pies de foto: fecha con día de la semana, quién aparece, dónde estaba.
  const pieDeFoto = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(is|are) seen\b|\b(participates|watch|watches|poses|prepares|stands|gathers)\b/i;
  const ruido = /\b(credit|photo by|image (?:above|below)|click|see more|caption|press release|download|http|www\.)\b/i;
  return oraciones.filter((o) => o.length >= 60 && o.length <= 420 && (escala.test(o) || explica.test(o)) && !pieDeFoto.test(o) && !ruido.test(o));
}

const MILES_KM = /[^\d]/g;

export function hechosDeNeoWs(dia: AsteroidesDelDia, fecha: Date): Hecho[] {
  const fechaTexto = fecha.toISOString().slice(0, 10);
  return dia.asteroides.slice(0, 3).map((a, i) => ({
    id: `neows-${i + 1}`,
    texto: `On ${fechaTexto}, the near-Earth asteroid ${a.nombre} passes ${Math.round(a.distanciaKm).toLocaleString("en-US")} km from Earth at ${Math.round(a.velocidadKmh).toLocaleString("en-US")} km/h. Its estimated diameter is up to ${Math.round(a.diametroMaxM)} meters.`,
    tema: "neows",
    fuente: { nombre: "NASA/JPL · NeoWs (Near Earth Object Web Service)", url: "https://api.nasa.gov" },
  }));
}

export function hechosDeLanzamientos(lista: Lanzamiento[]): Hecho[] {
  return lista.slice(0, 4).map((l, i) => ({
    id: `lanzamientos-${i + 1}`,
    texto: `The mission ${l.mision} is scheduled to launch on ${l.fecha.slice(0, 10)} aboard the ${l.cohete}${l.lugar ? ` from ${l.lugar}` : ""}.${l.descripcion ? ` ${l.descripcion.slice(0, 260)}` : ""}`,
    tema: "lanzamientos",
    fuente: { nombre: "The Space Devs · Launch Library 2", url: "https://thespacedevs.com/llapi" },
  }));
}

export const RespuestaCuriosos = z.object({ frases: z.array(z.object({ hecho: z.string().min(1), frase: z.string().min(1) })) });

export const SISTEMA_CURIOSOS =
  "Reescribes datos reales sobre el espacio como frases «¿Sabías que…?» en español neutro de Colombia, para una landing. " +
  "Recibes hechos numerados (en inglés, con su fuente). Para cada hecho útil escribe UNA frase: empieza con «¿Sabías que» y termina con «?», " +
  "de 12 a 38 palabras, con verbos concretos. Usa SOLO lo que dice el hecho: no agregues datos, comparaciones, causas ni cifras que no estén; " +
  "conserva cada número y cada fecha tal cual (puedes escribir la fecha en español, no la cambies). No uses adjetivos de relleno (increíble, asombroso, espectacular). " +
  "No sugieras que la NASA respalda ningún producto. Si un hecho no sirve, sáltalo. Responde con un JSON { frases: [ { hecho: \"id del hecho\", frase } ] }.";

export function armarUsuarioCuriosos(hechos: Hecho[]): string {
  return hechos.map((h) => `[${h.id}] (${h.fuente.nombre}) ${h.texto}`).join("\n");
}

const numeros = (t: string): string[] => (t.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(MILES_KM, "")).filter(Boolean);

/** Toda cifra de la frase debe estar en el hecho (comparada sin separadores); si no, la IA inventó o convirtió un número. */
export function cifrasFieles(frase: string, hecho: string): boolean {
  const permitidas = new Set(numeros(hecho));
  const aparte = numeros(hecho).join("|");
  return numeros(frase).every((n) => permitidas.has(n) || aparte.includes(n));
}

export function frasesValidas(respuesta: z.infer<typeof RespuestaCuriosos>, hechos: Hecho[]): { hecho: Hecho; frase: string }[] {
  const porId = new Map(hechos.map((h) => [h.id, h]));
  const salida: { hecho: Hecho; frase: string }[] = [];
  const vistas = new Set<string>();
  for (const r of respuesta.frases) {
    const hecho = porId.get(r.hecho);
    const frase = r.frase.trim();
    if (!hecho || vistas.has(hecho.id)) continue;
    const palabras = frase.split(/\s+/).length;
    if (!/^¿Sabías que/.test(frase) || !frase.endsWith("?") || palabras < 8 || palabras > 50) continue;
    if (!cifrasFieles(frase, hecho.texto)) continue;
    if (lintearTexto(frase).length > 0) continue; // lista negra en cero
    vistas.add(hecho.id);
    salida.push({ hecho, frase });
  }
  return salida;
}

const LOTE = 12;

/** Reescribe los hechos en lotes y arma los datos curiosos, con su fuente. */
export async function reescribirCuriosos(hechos: Hecho[], deps?: DepsEnrutador, log: (l: string) => void = () => undefined): Promise<DatoCurioso[]> {
  const datos: DatoCurioso[] = [];
  for (let i = 0; i < hechos.length && datos.length < META_MAXIMA; i += LOTE) {
    const lote = hechos.slice(i, i + LOTE);
    try {
      const r = await ejecutar(
        { tarea: "dato-curioso", sistema: SISTEMA_CURIOSOS, usuario: armarUsuarioCuriosos(lote), esquema: RespuestaCuriosos, maxTokens: 2000, temperatura: 0.3, rapido: true },
        deps,
      );
      for (const { hecho, frase } of frasesValidas(r.datos, lote)) {
        if (datos.length >= META_MAXIMA) break;
        datos.push({ id: `b8-${String(datos.length + 1).padStart(2, "0")}`, frase, tema: hecho.tema, fuente: hecho.fuente });
      }
    } catch (e) {
      log(`la IA no respondió al lote ${i / LOTE + 1} (${e instanceof Error ? e.message.split("\n")[0] : String(e)})`);
      break;
    }
  }
  return datos;
}
