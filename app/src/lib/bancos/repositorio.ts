import { MedioBanco, type OrientacionMedio } from "@/lib/contratos";

// Acceso a la tabla `MedioBanco`. El filtro de licencias vive aquí: un medio con `usoComercial` falso nunca se ofrece.

type Fila = {
  id: string;
  bancoId: string;
  tipo: string;
  fuente: string;
  idFuente: string;
  ruta: string;
  ancho: number;
  alto: number;
  orientacion: string;
  coloresDominantes: string;
  titulo: string;
  descripcion: string;
  etiquetas: string;
  credito: string;
  licencia: string;
  usoComercial: boolean;
  urlOrigen: string | null;
};

const lista = (json: string): string[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export function filaAMedio(f: Fila): MedioBanco {
  return MedioBanco.parse({
    id: f.id,
    bancoId: f.bancoId,
    tipo: f.tipo,
    fuente: f.fuente,
    idFuente: f.idFuente,
    ruta: f.ruta,
    ancho: f.ancho,
    alto: f.alto,
    orientacion: f.orientacion,
    coloresDominantes: lista(f.coloresDominantes),
    titulo: f.titulo,
    descripcion: f.descripcion,
    etiquetas: lista(f.etiquetas),
    credito: f.credito,
    licencia: f.licencia,
    usoComercial: f.usoComercial,
    urlOrigen: f.urlOrigen ?? undefined,
  });
}

export type NuevoMedio = Omit<MedioBanco, "id"> & {
  /** Texto original de la fuente (en inglés): sirve para los datos curiosos y para volver a enriquecer. */
  descripcionOrigen?: string;
};

export async function guardarMedio(m: NuevoMedio): Promise<MedioBanco> {
  const { db } = await import("@/lib/db");
  const datos = {
    tipo: m.tipo,
    ruta: m.ruta,
    ancho: m.ancho,
    alto: m.alto,
    orientacion: m.orientacion,
    coloresDominantes: JSON.stringify(m.coloresDominantes),
    titulo: m.titulo,
    descripcion: m.descripcion,
    etiquetas: JSON.stringify(m.etiquetas),
    credito: m.credito,
    licencia: m.licencia,
    usoComercial: m.usoComercial,
    urlOrigen: m.urlOrigen ?? null,
    descripcionOrigen: m.descripcionOrigen ?? null,
  };
  const fila = await db.medioBanco.upsert({
    where: { bancoId_fuente_idFuente: { bancoId: m.bancoId, fuente: m.fuente, idFuente: m.idFuente } },
    update: datos,
    create: { bancoId: m.bancoId, fuente: m.fuente, idFuente: m.idFuente, ...datos },
  });
  return filaAMedio(fila);
}

export async function existeMedio(bancoId: string, fuente: string, idFuente: string): Promise<boolean> {
  const { db } = await import("@/lib/db");
  return (await db.medioBanco.count({ where: { bancoId, fuente, idFuente } })) > 0;
}

export async function contarBanco(bancoId: string): Promise<number> {
  const { db } = await import("@/lib/db");
  return db.medioBanco.count({ where: { bancoId } });
}

export interface FiltroMedios {
  banco?: string;
  q?: string;
  orientacion?: OrientacionMedio;
  limite?: number;
}

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Medios que se ofrecen: solo los de uso comercial. `q` busca en título, descripción y etiquetas. */
export async function buscarMedios(f: FiltroMedios = {}): Promise<MedioBanco[]> {
  const { db } = await import("@/lib/db");
  const filas = await db.medioBanco.findMany({
    where: { usoComercial: true, ...(f.banco ? { bancoId: f.banco } : {}), ...(f.orientacion ? { orientacion: f.orientacion } : {}) },
    orderBy: [{ bancoId: "asc" }, { creadoEn: "asc" }],
  });
  const palabras = f.q ? sinAcentos(f.q).split(/\s+/).filter((p) => p.length > 1) : [];
  const medios = filas.map(filaAMedio).filter((m) => {
    if (palabras.length === 0) return true;
    const texto = sinAcentos(`${m.titulo} ${m.descripcion} ${m.etiquetas.join(" ")}`);
    return palabras.every((p) => texto.includes(p));
  });
  return medios.slice(0, f.limite ?? 60);
}

export async function medioPorId(id: string): Promise<MedioBanco | null> {
  const { db } = await import("@/lib/db");
  const fila = await db.medioBanco.findUnique({ where: { id } });
  return fila ? filaAMedio(fila) : null;
}

/** Medios que aún no tienen descripción en español (la IA no respondió al bajarlos). */
export async function medioSinDescribir(bancoId?: string): Promise<(MedioBanco & { descripcionOrigen: string })[]> {
  const { db } = await import("@/lib/db");
  const filas = await db.medioBanco.findMany({ where: { etiquetas: "[]", ...(bancoId ? { bancoId } : {}) } });
  return filas.map((f) => ({ ...filaAMedio(f), descripcionOrigen: f.descripcionOrigen ?? "" }));
}

export async function actualizarDescripcion(id: string, d: { titulo: string; descripcion: string; etiquetas: string[] }): Promise<void> {
  const { db } = await import("@/lib/db");
  await db.medioBanco.update({ where: { id }, data: { titulo: d.titulo, descripcion: d.descripcion, etiquetas: JSON.stringify(d.etiquetas) } });
}

/** Descripciones originales de los medios de un banco, para los datos curiosos. */
export async function textosOrigen(bancoIds: string[]): Promise<{ bancoId: string; idFuente: string; titulo: string; texto: string; credito: string; urlOrigen: string | null }[]> {
  const { db } = await import("@/lib/db");
  const filas = await db.medioBanco.findMany({ where: { bancoId: { in: bancoIds }, usoComercial: true } });
  return filas
    .filter((f) => (f.descripcionOrigen ?? "").length > 0)
    .map((f) => ({ bancoId: f.bancoId, idFuente: f.idFuente, titulo: f.titulo, texto: f.descripcionOrigen ?? "", credito: f.credito, urlOrigen: f.urlOrigen }));
}
