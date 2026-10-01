// Gasto de OpenAI por día: tokens de entrada y salida y costo estimado en USD. Al llegar al presupuesto diario
// (`OPENAI_PRESUPUESTO_USD_DIA`, por defecto 2) el adaptador salta a otro proveedor con un `ErrorNoCabe` legible.
// El acumulado vive en la tabla `Ajuste` (clave `gasto:<proveedor>:<AAAA-MM-DD>`), así sobrevive a reinicios.

/** USD por millón de tokens (entrada / salida). Configurable con `OPENAI_PRECIOS` (JSON `{ "modelo": [entrada, salida] }`). */
export const PRECIOS_POR_DEFECTO: Record<string, [number, number]> = {
  "gpt-5.4-mini": [0.75, 4.5],
  "gpt-5-mini": [0.25, 2],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4.1": [2, 8],
  "gpt-4o-mini": [0.15, 0.6],
};
/** Si el modelo no está en la tabla se estima con el precio más alto de la lista (mejor pasarse que quedarse corto). */
const PRECIO_DESCONOCIDO: [number, number] = [0.75, 4.5];

export const PRESUPUESTO_POR_DEFECTO_USD = 2;

export interface GastoDia {
  dia: string;
  entrada: number;
  salida: number;
  usd: number;
  peticiones: number;
  porModelo: Record<string, { entrada: number; salida: number; usd: number; peticiones: number }>;
}

export interface AlmacenGasto {
  leer(clave: string): Promise<string | null>;
  escribir(clave: string, valor: string): Promise<void>;
}

export interface ContadorGasto {
  registrar(modelo: string, tokens: { entrada: number; salida: number }): Promise<void>;
  /** Suma un costo ya estimado en USD (imágenes generadas: el precio es por imagen, no por token). */
  registrarUsd(modelo: string, usd: number): Promise<void>;
  /** `null` si todavía hay presupuesto; si no, el motivo para saltar a otro proveedor. */
  bloqueo(): Promise<string | null>;
  hoy(): Promise<GastoDia & { presupuestoUsd: number }>;
}

type Env = Record<string, string | undefined>;

export function preciosDe(env: Env = process.env): Record<string, [number, number]> {
  try {
    const extra = env.OPENAI_PRECIOS ? (JSON.parse(env.OPENAI_PRECIOS) as Record<string, [number, number]>) : {};
    return { ...PRECIOS_POR_DEFECTO, ...extra };
  } catch {
    return PRECIOS_POR_DEFECTO;
  }
}

export function costoUsd(modelo: string, t: { entrada: number; salida: number }, precios = PRECIOS_POR_DEFECTO): number {
  const [pe, ps] = precios[modelo] ?? precios[Object.keys(precios).find((k) => modelo.startsWith(k)) ?? ""] ?? PRECIO_DESCONOCIDO;
  return (t.entrada * pe + t.salida * ps) / 1_000_000;
}

export function presupuestoDe(env: Env = process.env): number {
  const n = Number(env.OPENAI_PRESUPUESTO_USD_DIA);
  return Number.isFinite(n) && n > 0 ? n : PRESUPUESTO_POR_DEFECTO_USD;
}

/** USD por imagen generada con calidad baja (1024×1024). Estimación; `OPENAI_PRECIO_IMAGEN` (JSON `{ "modelo": usd }`) la sobrescribe. */
export const PRECIO_IMAGEN_POR_DEFECTO: Record<string, number> = { "gpt-image-2": 0.012, "gpt-image-1-mini": 0.006, "gpt-image-1": 0.011 };

export function precioImagen(modelo: string, env: Env = process.env): number {
  let tabla = PRECIO_IMAGEN_POR_DEFECTO;
  try {
    if (env.OPENAI_PRECIO_IMAGEN) tabla = { ...tabla, ...(JSON.parse(env.OPENAI_PRECIO_IMAGEN) as Record<string, number>) };
  } catch {
    // JSON dañado: valen los precios por defecto
  }
  return tabla[modelo] ?? 0.012;
}

const vacio = (dia: string): GastoDia => ({ dia, entrada: 0, salida: 0, usd: 0, peticiones: 0, porModelo: {} });

export function crearContadorGasto(op: { proveedor: string; almacen?: AlmacenGasto; ahora?: () => Date; env?: Env }): ContadorGasto {
  const env = op.env ?? process.env;
  const ahora = op.ahora ?? (() => new Date());
  const almacen = op.almacen ?? almacenGastoAjuste;
  let cache: GastoDia | null = null;
  let cadena: Promise<unknown> = Promise.resolve();
  const dia = () => ahora().toISOString().slice(0, 10);
  const clave = (d: string) => `gasto:${op.proveedor}:${d}`;

  const cargar = async (): Promise<GastoDia> => {
    const d = dia();
    if (cache?.dia === d) return cache;
    let g = vacio(d);
    try {
      const crudo = await almacen.leer(clave(d));
      if (crudo) g = { ...vacio(d), ...(JSON.parse(crudo) as GastoDia), dia: d };
    } catch {
      // sin base o valor dañado: se empieza de cero
    }
    return (cache = g);
  };
  const serializar = <T>(f: () => Promise<T>): Promise<T> => {
    const t = cadena.then(f, f);
    cadena = t.catch(() => undefined);
    return t;
  };

  return {
    registrarUsd: (modelo, usd) => acumular(modelo, { entrada: 0, salida: 0 }, usd),
    registrar: (modelo, tokens) => acumular(modelo, tokens, costoUsd(modelo, tokens, preciosDe(env))),
    bloqueo: async () => {
      const g = await serializar(cargar);
      const tope = presupuestoDe(env);
      return g.usd >= tope ? `gasto de hoy US$ ${g.usd.toFixed(2)} de US$ ${tope.toFixed(2)}` : null;
    },
    hoy: async () => ({ ...(await serializar(cargar)), presupuestoUsd: presupuestoDe(env) }),
  };
  function acumular(modelo: string, tokens: { entrada: number; salida: number }, usd: number): Promise<void> {
    return serializar(async () => {
        const g = await cargar();
        const m = g.porModelo[modelo] ?? { entrada: 0, salida: 0, usd: 0, peticiones: 0 };
        g.entrada += tokens.entrada;
        g.salida += tokens.salida;
        g.usd += usd;
        g.peticiones += 1;
        g.porModelo[modelo] = { entrada: m.entrada + tokens.entrada, salida: m.salida + tokens.salida, usd: m.usd + usd, peticiones: m.peticiones + 1 };
        try {
          await almacen.escribir(clave(g.dia), JSON.stringify(g));
        } catch (e) {
          console.warn("No se pudo guardar el gasto de IA:", e instanceof Error ? e.message : e);
        }
    });
  }
}

export const almacenGastoAjuste: AlmacenGasto = {
  async leer(clave) {
    const { db } = await import("@/lib/db");
    return (await db.ajuste.findUnique({ where: { clave } }))?.valor ?? null;
  },
  async escribir(clave, valor) {
    const { db } = await import("@/lib/db");
    await db.ajuste.upsert({ where: { clave }, update: { valor }, create: { clave, valor } });
  },
};

const COMPARTIDOS = new Map<string, ContadorGasto>();

/** Un contador por proveedor para todo el proceso (los adaptadores se crean en cada petición). */
export function contadorCompartido(proveedor: string): ContadorGasto {
  let c = COMPARTIDOS.get(proveedor);
  if (!c) COMPARTIDOS.set(proveedor, (c = crearContadorGasto({ proveedor })));
  return c;
}
