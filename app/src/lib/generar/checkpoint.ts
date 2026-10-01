// Checkpoint por landing: guarda hasta qué etapa llegó el pipeline y el contexto que hace falta para retomar el crítico
// (el brief en texto) sin repetir intake, estrategia ni redacción. Vive en la tabla `Ajuste` (clave `checkpoint:<id>`).

export type EtapaCheckpoint = "redaccion" | "imagenes" | "critico";

export interface Checkpoint {
  /** Última etapa terminada. */
  etapa: EtapaCheckpoint;
  /** `true` mientras la landing no tenga nota del crítico (falló por cuota o por esquema y se puede reintentar). */
  criticoPendiente: boolean;
  briefTxt: string;
  umbral: number;
  avisos: string[];
  /** Tipos de sección que quedaron con su ejemplo y la marca [COMPLETAR] porque ningún proveedor las redactó. */
  seccionesPorCompletar: string[];
  actualizadoEn: string;
  /** Milisegundos por etapa del grafo (intake, fuentes, imagenes, estrategia, plan, redaccion…). */
  tiempos?: Record<string, number>;
  /** Imágenes: por slot, quién ganó y por qué; y las demás candidatas, para «Cambiar imagen». */
  imagenes?: { notas: Record<string, import("./imagenes-competencia").NotaSlot>; alternativas: Record<string, unknown[]>; fuentes?: Record<string, number> };
}

export interface AlmacenCheckpoint {
  leer(landingId: string): Promise<Checkpoint | null>;
  escribir(landingId: string, c: Checkpoint): Promise<void>;
}

const clave = (id: string) => `checkpoint:${id}`;

export const almacenCheckpointAjuste: AlmacenCheckpoint = {
  async leer(id) {
    const { db } = await import("@/lib/db");
    const f = await db.ajuste.findUnique({ where: { clave: clave(id) } });
    if (!f) return null;
    try {
      return JSON.parse(f.valor) as Checkpoint;
    } catch {
      return null;
    }
  },
  async escribir(id, c) {
    const { db } = await import("@/lib/db");
    const valor = JSON.stringify(c);
    await db.ajuste.upsert({ where: { clave: clave(id) }, update: { valor }, create: { clave: clave(id), valor } });
  },
};

export function almacenCheckpointMemoria(): AlmacenCheckpoint & { datos: Map<string, Checkpoint> } {
  const datos = new Map<string, Checkpoint>();
  return { datos, leer: async (id) => datos.get(id) ?? null, escribir: async (id, c) => void datos.set(id, c) };
}
