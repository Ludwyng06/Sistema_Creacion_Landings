// Caché de las APIs (tabla `CacheApi`) y contador de uso mensual por fuente (tabla `UsoFuente`).
// El acceso a la base es perezoso (import dinámico): los tests que usan memoria no tocan Prisma.

export interface AlmacenFuentes {
  leer(clave: string, ahora: Date): Promise<string | null>;
  escribir(clave: string, fuente: string, valor: string, expiraEn: Date): Promise<void>;
  /** Suma 1 al uso del mes y devuelve el total. */
  contar(fuente: string, mes: string): Promise<number>;
  usoMes(fuente: string, mes: string): Promise<number>;
}

export const mesDe = (fecha: Date): string => fecha.toISOString().slice(0, 7);

/** Clave estable: la fuente y la consulta con textos en minúsculas, sin espacios repetidos y con las llaves ordenadas. */
export function claveCache(fuente: string, consulta: unknown): string {
  const normal = (v: unknown): unknown => {
    if (typeof v === "string") return v.trim().toLowerCase().replace(/\s+/g, " ");
    if (Array.isArray(v)) return v.map(normal);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([, x]) => x !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, normal(x)]),
      );
    }
    return v;
  };
  return `${fuente}:${JSON.stringify(normal(consulta))}`;
}

export const almacenDb: AlmacenFuentes = {
  async leer(clave, ahora) {
    const { db } = await import("@/lib/db");
    const fila = await db.cacheApi.findUnique({ where: { clave } });
    return fila && fila.expiraEn > ahora ? fila.valor : null;
  },
  async escribir(clave, fuente, valor, expiraEn) {
    const { db } = await import("@/lib/db");
    await db.cacheApi.upsert({ where: { clave }, update: { valor, expiraEn, fuente }, create: { clave, fuente, valor, expiraEn } });
  },
  async contar(fuente, mes) {
    const { db } = await import("@/lib/db");
    const fila = await db.usoFuente.upsert({
      where: { fuente_mes: { fuente, mes } },
      update: { total: { increment: 1 } },
      create: { fuente, mes, total: 1 },
    });
    return fila.total;
  },
  async usoMes(fuente, mes) {
    const { db } = await import("@/lib/db");
    return (await db.usoFuente.findUnique({ where: { fuente_mes: { fuente, mes } } }))?.total ?? 0;
  },
};

/** Almacén en memoria, para los tests. */
export function almacenMemoria(): AlmacenFuentes & { cache: Map<string, { valor: string; expiraEn: Date }>; usos: Map<string, number> } {
  const cache = new Map<string, { valor: string; expiraEn: Date }>();
  const usos = new Map<string, number>();
  return {
    cache,
    usos,
    async leer(clave, ahora) {
      const f = cache.get(clave);
      return f && f.expiraEn > ahora ? f.valor : null;
    },
    async escribir(clave, _fuente, valor, expiraEn) {
      cache.set(clave, { valor, expiraEn });
    },
    async contar(fuente, mes) {
      const k = `${fuente}|${mes}`;
      usos.set(k, (usos.get(k) ?? 0) + 1);
      return usos.get(k)!;
    },
    async usoMes(fuente, mes) {
      return usos.get(`${fuente}|${mes}`) ?? 0;
    },
  };
}
