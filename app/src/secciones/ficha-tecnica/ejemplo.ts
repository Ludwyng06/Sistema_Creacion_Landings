import type { Seccion } from "@/lib/contratos";
import { COMPLETAR } from "@/componentes/dinero";

// Las medidas salen del brief: en el ejemplo van como [COMPLETAR].
const bloques: Seccion["bloques"] = [
  { id: "esp-1", tipo: "especificacion", ajustes: { nombre: "Alto", valor: COMPLETAR, unidad: "cm" } },
  { id: "esp-2", tipo: "especificacion", ajustes: { nombre: "Peso", valor: COMPLETAR, unidad: "g" } },
  { id: "esp-3", tipo: "especificacion", ajustes: { nombre: "Alimentación", valor: COMPLETAR } },
  { id: "esp-4", tipo: "especificacion", ajustes: { nombre: "Material", valor: COMPLETAR } },
  { id: "esp-5", tipo: "especificacion", ajustes: { nombre: "Voltaje", valor: COMPLETAR, unidad: "V" } },
  { id: "esp-6", tipo: "especificacion", ajustes: { nombre: "Garantía", valor: COMPLETAR, unidad: "meses" } },
];

function armar(variante: "tabla" | "fichas"): Seccion {
  return {
    id: `ejemplo-ficha-tecnica-${variante}`,
    tipo: "ficha-tecnica",
    variante,
    visible: true,
    intencion: { objetivo: "Dar los datos concretos que la persona busca antes de pedir.", emocion: "confianza", objecionQueResponde: "¿Qué tan grande es y cómo funciona?" },
    ajustes: { titulo: "Ficha técnica" },
    bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = { tabla: armar("tabla"), fichas: armar("fichas") } as const;

/** Valor por defecto al «Agregar sección». */
export const ejemplo: Seccion = ejemplos.tabla;
