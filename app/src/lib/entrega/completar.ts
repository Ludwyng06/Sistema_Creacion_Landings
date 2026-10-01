import type { LandingDoc } from "@/lib/contratos";
import { COMPLETAR } from "@/componentes/dinero";
import { registro } from "@/secciones/registro";

// Datos que la persona todavía tiene que poner (marcadores [COMPLETAR]) y dónde están, para llevarla a su sección en el editor.

export interface DatoPendiente {
  seccionId: string;
  tipo: string;
  /** Nombre de la sección tal como lo ve la persona. */
  etiqueta: string;
  /** Ruta del campo dentro de la sección (`ajustes.precio`, `bloques.b1.texto`…). */
  ruta: string;
  /** Último tramo de la ruta (`precio`, `texto`…). */
  campo: string;
  /** El texto con el marcador. */
  texto: string;
  /** Bloquea guardar en el banco: el héroe (lo primero que se ve) y el precio. */
  critico: boolean;
}

/** El campo es un precio (el «precio anterior» es opcional y no cuenta). */
const esPrecio = (campo: string) => /precio|price/i.test(campo) && !/anterior/i.test(campo);

/** Enlace al editor con la sección ya seleccionada. */
export const enlaceASeccion = (landingId: string, seccionId: string): string => `/editor/${landingId}?seccion=${encodeURIComponent(seccionId)}`;

/** Recorre las secciones visibles y lista cada campo que aún dice [COMPLETAR], en el orden de la página. */
export function datosPorCompletar(doc: LandingDoc): DatoPendiente[] {
  const salida: DatoPendiente[] = [];
  for (const s of doc.secciones) {
    if (!s.visible) continue;
    const etiqueta = registro[s.tipo]?.etiqueta ?? s.tipo;
    const recorrer = (valor: unknown, ruta: string) => {
      if (typeof valor === "string") {
        if (valor.includes(COMPLETAR)) {
          const campo = ruta.split(".").at(-1) ?? ruta;
          salida.push({ seccionId: s.id, tipo: s.tipo, etiqueta, ruta, campo, texto: valor, critico: s.tipo === "heroe" || esPrecio(campo) });
        }
      } else if (Array.isArray(valor)) valor.forEach((x, i) => recorrer(x, `${ruta}.${i}`));
      else if (valor && typeof valor === "object") for (const [k, x] of Object.entries(valor)) recorrer(x, `${ruta}.${k}`);
    };
    recorrer(s.ajustes, "ajustes");
    for (const b of s.bloques) recorrer(b.ajustes, `bloques.${b.id}`);
  }
  return salida;
}
