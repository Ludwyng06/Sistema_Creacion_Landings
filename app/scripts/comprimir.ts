import { rename, rm, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { ffmpeg, infoVideo } from "./ffmpeg";

// `npm run media -- --comprimir`: recodifica los MP4 a H.264 sin audio, con `+faststart` y un fotograma clave
// cada pocos fotogramas (así el scrubbing con scroll no salta), bajando calidad y luego resolución hasta el presupuesto de docs/06.

const MB = 1024 * 1024;

/** Presupuestos de docs/06: clip 16:9 ≤ 4 MB y móvil 9:16 ≤ 3 MB. Las alternativas solo sirven para comparar: 1,5 MB. */
export function presupuestoDe(archivo: string, ancho: number, alto: number): number {
  const base = basename(archivo, extname(archivo));
  if (/-alt-/.test(base)) return 1.5 * MB;
  if (alto > ancho || /9x16|movil/.test(base)) return 3 * MB;
  return 4 * MB;
}

/** Fotograma clave cada 5 fotogramas (`-g 5`): con `-g 1` todo sería intra y el peso se multiplicaría por 8 o más. */
export const GOP = 5;

/** Argumentos de ffmpeg de una pasada. `escala` (0 a 1) reduce la resolución, siempre a medidas pares. */
export function argsCompresion(entrada: string, salida: string, o: { crf: number; escala: number }): string[] {
  const filtro = o.escala < 1 ? ["-vf", `scale=trunc(iw*${o.escala}/2)*2:trunc(ih*${o.escala}/2)*2`] : [];
  return [
    "-y",
    "-i",
    entrada,
    ...filtro,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    String(o.crf),
    "-g",
    String(GOP),
    "-keyint_min",
    String(GOP),
    "-sc_threshold",
    "0",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    salida,
  ];
}

export interface ResultadoCompresion {
  archivo: string;
  antes: number;
  despues: number;
  presupuesto: number;
  crf: number;
  escala: number;
  /** `true` si el archivo ya cabía y no se tocó. */
  omitido: boolean;
  /** `false` si ni con la menor calidad y resolución probadas entró en el presupuesto. */
  cabe: boolean;
}

const CRFS = [26, 30, 34, 38];
const ESCALAS = [1, 0.85, 0.7, 0.55];

/** Recodifica `mp4` en su lugar hasta que cabe en su presupuesto; si ya cabe y no es `forzar`, no lo toca. */
export async function comprimirVideo(mp4: string, o: { forzar?: boolean; presupuesto?: number } = {}): Promise<ResultadoCompresion> {
  const antes = (await stat(mp4)).size;
  const info = await infoVideo(mp4);
  const presupuesto = o.presupuesto ?? presupuestoDe(mp4, info.ancho, info.alto);
  const base = { archivo: mp4, antes, presupuesto };
  if (antes <= presupuesto && !o.forzar) return { ...base, despues: antes, crf: 0, escala: 1, omitido: true, cabe: true };

  const temporal = join(dirname(mp4), `.${basename(mp4, ".mp4")}.tmp.mp4`);
  try {
    // Primero baja la calidad con la resolución original; solo si no basta, reduce la resolución.
    for (const escala of ESCALAS) {
      for (const crf of CRFS) {
        await ffmpeg(argsCompresion(mp4, temporal, { crf, escala }));
        const tamano = (await stat(temporal)).size;
        if (tamano <= presupuesto) {
          await rm(mp4, { force: true });
          await rename(temporal, mp4);
          return { ...base, despues: tamano, crf, escala, omitido: false, cabe: true };
        }
      }
    }
    // Ninguna combinación cupo: queda la última (la más pequeña) y se avisa.
    const ultimo = (await stat(temporal)).size;
    await rm(mp4, { force: true });
    await rename(temporal, mp4);
    return { ...base, despues: ultimo, crf: CRFS.at(-1)!, escala: ESCALAS.at(-1)!, omitido: false, cabe: false };
  } finally {
    await rm(temporal, { force: true }).catch(() => {});
  }
}
