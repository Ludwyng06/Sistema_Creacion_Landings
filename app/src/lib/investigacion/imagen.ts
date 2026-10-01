import { createHash } from "node:crypto";
import sharp from "sharp";

// La foto del producto: colores dominantes (sharp, sin IA), copia liviana para Gemini y WebP para guardarla.

export const MAX_BYTES_FOTO = 15 * 1024 * 1024;
export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const LADO_ANALISIS = 160;
const LADO_PARA_IA = 1024;

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

type RGB = { r: number; g: number; b: number };
type Lab = { L: number; a: number; b: number };

/** sRGB (0-255) → CIELAB (D65). */
export function aLab({ r, g, b }: RGB): Lab {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047);
  const y = f(0.2126729 * R + 0.7151522 * G + 0.072175 * B);
  const z = f((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883);
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

/** Diferencia de color ΔE (CIE76, distancia en Lab). */
export const deltaE = (p: Lab, q: Lab) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
const croma = (c: Lab) => Math.hypot(c.a, c.b);

/** ΔE bajo el cual un píxel cuenta como fondo (parecido a algún color del borde). */
const DELTA_E_FONDO = 12;
/** Franja del borde que modela el fondo: 8 % de cada lado. */
const FRANJA_BORDE = 0.08;
/** Un color del borde es fondo si tiene al menos esta parte de los píxeles del borde. */
const PARTE_MINIMA_FONDO = 0.01;
/** Si tras quitar el fondo queda menos que esto de la imagen, se vuelve al método simple. */
const RESTO_MINIMO = 0.03;
/** El acento debe ocupar al menos esta parte del producto. */
const PARTE_MINIMA_ACENTO = 0.01;
const GRUPOS_PRODUCTO = 5;

interface Grupo {
  centro: Lab;
  rgb: RGB;
  n: number;
}

interface Muestra {
  rgb: RGB;
  lab: Lab;
}

/** Agrupa muestras: celdas de Lab por frecuencia como semillas separadas por `separacion` ΔE, cada muestra al centro más cercano. */
function agrupar(muestras: Muestra[], maxGrupos: number, separacion: number): Grupo[] {
  const celdas = new Map<string, { n: number; lab: Lab }>();
  for (const m of muestras) {
    const k = `${Math.round(m.lab.L / 5)}|${Math.round(m.lab.a / 6)}|${Math.round(m.lab.b / 6)}`;
    const c = celdas.get(k) ?? { n: 0, lab: m.lab };
    c.n++;
    celdas.set(k, c);
  }
  const semillas: Lab[] = [];
  for (const c of [...celdas.values()].sort((x, y) => y.n - x.n)) {
    if (semillas.length >= maxGrupos) break;
    if (semillas.every((s) => deltaE(s, c.lab) >= separacion)) semillas.push(c.lab);
  }
  const suma = semillas.map(() => ({ n: 0, r: 0, g: 0, b: 0 }));
  for (const m of muestras) {
    let mejor = 0;
    let dm = Infinity;
    semillas.forEach((s, i) => {
      const d = deltaE(s, m.lab);
      if (d < dm) {
        dm = d;
        mejor = i;
      }
    });
    const s = suma[mejor];
    s.n++;
    s.r += m.rgb.r;
    s.g += m.rgb.g;
    s.b += m.rgb.b;
  }
  return suma
    .filter((s) => s.n > 0)
    .map((s) => {
      const rgb = { r: s.r / s.n, g: s.g / s.n, b: s.b / s.n };
      return { rgb, centro: aLab(rgb), n: s.n };
    });
}

export interface ColoresFoto {
  colores: string[];
  /** Avisos legibles (p. ej. que el fondo se llevó casi toda la imagen y se usó el método simple). */
  avisos: string[];
}

/**
 * Los `n` colores de marca de la foto. (1) El fondo se modela con la franja del borde (8 % por lado): se agrupan sus
 * colores y se descartan de TODA la imagen los píxeles a menos de ΔE 12 de cualquier grupo del borde. (2) Con el
 * producto que queda se hacen 5 grupos y se devuelven 3: el color principal, el segundo y el acento más saturado si
 * ocupa al menos el 1 % del producto. (3) Si tras quitar el fondo queda menos del 3 % de los píxeles, se agrupa la
 * imagen entera y se avisa.
 */
export async function coloresDeFoto(buffer: Buffer, n = 3): Promise<ColoresFoto> {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize(LADO_ANALISIS, LADO_ANALISIS, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const margenX = Math.max(1, Math.round(width * FRANJA_BORDE));
  const margenY = Math.max(1, Math.round(height * FRANJA_BORDE));

  const todas: Muestra[] = [];
  const borde: Muestra[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (data[i + 3] < 128) continue;
      const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
      const m = { rgb, lab: aLab(rgb) };
      todas.push(m);
      if (x < margenX || x >= width - margenX || y < margenY || y >= height - margenY) borde.push(m);
    }
  }
  if (todas.length === 0) return { colores: [], avisos: ["La imagen no tiene píxeles visibles."] };

  const avisos: string[] = [];
  const fondo = agrupar(borde, 12, 8).filter((g) => g.n >= borde.length * PARTE_MINIMA_FONDO);
  const producto = todas.filter((m) => fondo.every((g) => deltaE(g.centro, m.lab) >= DELTA_E_FONDO));

  let grupos: Grupo[];
  if (producto.length < todas.length * RESTO_MINIMO) {
    avisos.push("Al quitar el fondo casi no quedó imagen (el producto parece del mismo color que el fondo): los colores salen de la foto entera.");
    grupos = agrupar(todas, GRUPOS_PRODUCTO, 15);
  } else {
    grupos = agrupar(producto, GRUPOS_PRODUCTO, 15);
  }

  const total = grupos.reduce((s, g) => s + g.n, 0);
  const porTamano = [...grupos].sort((a, b) => b.n - a.n);
  const elegidos: Grupo[] = porTamano.slice(0, Math.max(0, n - 1));
  const acento = porTamano.filter((g) => !elegidos.includes(g) && g.n >= total * PARTE_MINIMA_ACENTO).sort((a, b) => croma(b.centro) - croma(a.centro))[0];
  if (acento) elegidos.push(acento);
  for (const g of porTamano) if (elegidos.length < n && !elegidos.includes(g)) elegidos.push(g);
  return { colores: elegidos.map((g) => hex(g.rgb.r, g.rgb.g, g.rgb.b)), avisos };
}

/** Los `n` colores de marca de la foto como hex (ver `coloresDeFoto`). */
export async function coloresDominantes(buffer: Buffer, n = 3): Promise<string[]> {
  return (await coloresDeFoto(buffer, n)).colores;
}

export interface FotoPreparada {
  /** Identificador estable (12 primeros hex del SHA-256 de la foto original). */
  id: string;
  colores: string[];
  /** JPEG de hasta 1024 px por lado, en base64, para la IA. */
  jpegBase64: string;
  /** WebP de hasta 1600 px para guardarla como foto del brief. */
  webp: Buffer;
}

/** Valida y prepara la foto; lanza un `Error` con un mensaje legible si no es una imagen. */
export async function prepararFoto(buffer: Buffer): Promise<FotoPreparada> {
  if (buffer.length === 0) throw new Error("La foto está vacía.");
  if (buffer.length > MAX_BYTES_FOTO) throw new Error("La foto supera el máximo de 15 MB.");
  try {
    const id = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
    const base = () => sharp(buffer).rotate();
    const [colores, jpeg, webp] = await Promise.all([
      coloresDominantes(buffer),
      base().resize(LADO_PARA_IA, LADO_PARA_IA, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer(),
      base().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    ]);
    return { id, colores, jpegBase64: jpeg.toString("base64"), webp };
  } catch {
    throw new Error("No se pudo leer la foto: el archivo está dañado o no es una imagen.");
  }
}
