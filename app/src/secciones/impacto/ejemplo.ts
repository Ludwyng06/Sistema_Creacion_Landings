import type { Asset, Seccion } from "@/lib/contratos";
import { COMPLETAR } from "@/componentes/dinero";

// Las cifras salen del brief: en el ejemplo van como [COMPLETAR].
const bloques: Seccion["bloques"] = [
  { id: "imp-1", tipo: "dato", ajustes: { valor: COMPLETAR, etiqueta: "Personas ayudadas" } },
  { id: "imp-2", tipo: "dato", ajustes: { valor: COMPLETAR, etiqueta: "Años de trabajo" } },
  { id: "imp-3", tipo: "dato", ajustes: { valor: COMPLETAR, etiqueta: "Voluntarios" } },
];

function armar(variante: "cifras-con-foto" | "meta"): Seccion {
  return {
    id: `ejemplo-impacto-${variante}`,
    tipo: "impacto",
    variante,
    visible: true,
    intencion: { objetivo: "Mostrar con cifras reales qué se ha logrado y por qué sumarse importa.", emocion: "esperanza", objecionQueResponde: "¿Mi apoyo sirve de algo?" },
    ajustes: { titulo: "Lo que logramos juntos", texto: "Cada aporte se convierte en algo concreto.", imagen: "impacto-imagen", logrado: COMPLETAR, meta: COMPLETAR, unidadMeta: "personas" },
    bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = { "cifras-con-foto": armar("cifras-con-foto"), meta: armar("meta") } as const;
export const ejemplo: Seccion = ejemplos["cifras-con-foto"];

export const assets: Asset[] = [{ slot: "impacto-imagen", tipo: "imagen", relacion: "16:9", promptGrok: "", alt: "Personas beneficiadas por la causa" }];
