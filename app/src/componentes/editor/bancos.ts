import type { Asset } from "@/lib/contratos";

// Búsqueda en los bancos de medios desde el inspector (`GET /api/medios/buscar` de la 12-A). Si la API todavía no existe en
// esta rama (404), se usa una simulación con imágenes locales y se avisa: la interfaz queda lista para cuando llegue.

export interface MedioBusqueda {
  id: string;
  bancoId: string;
  titulo: string;
  descripcion: string;
  ruta: string;
  ancho: number;
  alto: number;
  orientacion: "horizontal" | "vertical" | "cuadrada";
  credito: string;
  licencia: NonNullable<Asset["licencia"]>;
  fuente: NonNullable<Asset["fuente"]>;
  urlOrigen?: string;
}

export const BANCOS = [
  { id: "b1", nombre: "Espacio profundo" },
  { id: "b3", nombre: "Luna" },
  { id: "b4", nombre: "Marte y planetas" },
  { id: "b5", nombre: "Auroras y cielo nocturno" },
  { id: "b7", nombre: "Cohetes e ISS" },
  { id: "p-belleza", nombre: "Producto: belleza" },
  { id: "p-bienestar", nombre: "Producto: bienestar" },
  { id: "p-tecnologia", nombre: "Producto: tecnología" },
  { id: "p-hogar", nombre: "Producto: hogar" },
] as const;

export interface ConsultaMedios {
  banco?: string;
  q?: string;
  orientacion?: MedioBusqueda["orientacion"];
}

export interface ResultadoMedios {
  medios: MedioBusqueda[];
  /** `true` si la API de medios no existe todavía y los resultados son de muestra. */
  simulado: boolean;
}

const MUESTRA: MedioBusqueda[] = [
  { id: "muestra-1", bancoId: "b5", titulo: "Fábrica de neón", descripcion: "Imagen de muestra para probar el selector.", ruta: "/media/home/home-16-9.jpg", ancho: 1280, alto: 720, orientacion: "horizontal", credito: "Imagen de muestra", licencia: "usuario", fuente: "usuario" },
  { id: "muestra-2", bancoId: "b1", titulo: "Vertical de neón", descripcion: "Imagen vertical de muestra.", ruta: "/media/home/home-loop-9x16.jpg", ancho: 720, alto: 1280, orientacion: "vertical", credito: "Imagen de muestra", licencia: "usuario", fuente: "usuario" },
  { id: "muestra-3", bancoId: "b3", titulo: "Textura brutalista", descripcion: "Imagen de muestra con relieve.", ruta: "/media/home/home-loop-alt-brutalista.jpg", ancho: 1280, alto: 720, orientacion: "horizontal", credito: "Imagen de muestra", licencia: "usuario", fuente: "usuario" },
  { id: "muestra-4", bancoId: "p-hogar", titulo: "Líquido de colores", descripcion: "Imagen de muestra abstracta.", ruta: "/media/home/home-loop-alt-liquido.jpg", ancho: 1280, alto: 720, orientacion: "horizontal", credito: "Imagen de muestra", licencia: "usuario", fuente: "usuario" },
];

function simular({ banco, q, orientacion }: ConsultaMedios): MedioBusqueda[] {
  const normal = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return MUESTRA.filter((m) => (!banco || m.bancoId === banco) && (!orientacion || m.orientacion === orientacion) && (!q || normal(`${m.titulo} ${m.descripcion}`).includes(normal(q))));
}

/** Busca en los bancos; con 404 (API ausente) devuelve la muestra marcada como simulada. */
export async function buscarMedios(consulta: ConsultaMedios, buscar: typeof fetch = fetch): Promise<ResultadoMedios> {
  const params = new URLSearchParams();
  if (consulta.banco) params.set("banco", consulta.banco);
  if (consulta.q?.trim()) params.set("q", consulta.q.trim());
  if (consulta.orientacion) params.set("orientacion", consulta.orientacion);
  const respuesta = await buscar(`/api/medios/buscar?${params}`);
  if (respuesta.status === 404) return { medios: simular(consulta), simulado: true };
  if (!respuesta.ok) throw new Error("No pudimos consultar los bancos. Inténtalo otra vez.");
  const cuerpo = (await respuesta.json()) as { medios?: MedioBusqueda[] };
  return { medios: cuerpo.medios ?? [], simulado: false };
}

/** El `Asset` de un slot a partir de un medio del banco (con su crédito, licencia y procedencia). */
export function assetDeMedio(slot: string, medio: MedioBusqueda, previo?: Asset): Asset {
  const relacion = medio.orientacion === "vertical" ? "4:5" : medio.orientacion === "cuadrada" ? "1:1" : "16:9";
  return {
    slot,
    tipo: "imagen",
    relacion: previo?.relacion ?? relacion,
    promptGrok: previo?.promptGrok ?? "",
    alt: medio.titulo || previo?.alt || slot,
    ruta: medio.ruta,
    fuente: medio.fuente,
    credito: medio.credito,
    licencia: medio.licencia,
    urlOrigen: medio.urlOrigen,
    bancoId: medio.bancoId,
  };
}

/** `object-position` a partir de dos porcentajes. */
export const focoDe = (x: number, y: number) => `${Math.round(x)}% ${Math.round(y)}%`;

export function leerFoco(foco: string | undefined): { x: number; y: number } {
  const m = foco?.match(/^(\d{1,3})% (\d{1,3})%$/);
  return m ? { x: Math.min(100, Number(m[1])), y: Math.min(100, Number(m[2])) } : { x: 50, y: 50 };
}
