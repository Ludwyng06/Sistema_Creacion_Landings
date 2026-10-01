import type { Asset, Seccion } from "@/lib/contratos";
import { COMPLETAR } from "@/componentes/dinero";

// Los nombres salen del brief: en el ejemplo van como [COMPLETAR].
const bloques: Seccion["bloques"] = [
  { id: "pon-1", tipo: "persona", ajustes: { nombre: COMPLETAR, rol: "Guía de la observación", texto: "Cuenta en pocas palabras por qué es quien te acompaña.", imagen: "ponente-1" } },
  { id: "pon-2", tipo: "persona", ajustes: { nombre: COMPLETAR, rol: "Anfitrión del evento", imagen: "ponente-2" } },
  { id: "pon-3", tipo: "persona", ajustes: { nombre: COMPLETAR, rol: "Invitado", imagen: "ponente-3" } },
];

function armar(variante: "tarjetas" | "destacado"): Seccion {
  return {
    id: `ejemplo-ponentes-${variante}`,
    tipo: "ponentes",
    variante,
    visible: true,
    intencion: { objetivo: "Poner cara y nombre a quienes llevan el evento o el curso.", emocion: "confianza", objecionQueResponde: "¿Quién está detrás?" },
    ajustes: { titulo: "Quién te acompaña" },
    bloques: variante === "destacado" ? bloques.slice(0, 1) : bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = { tarjetas: armar("tarjetas"), destacado: armar("destacado") } as const;
export const ejemplo: Seccion = ejemplos.tarjetas;

export const assets: Asset[] = [1, 2, 3].map((n) => ({ slot: `ponente-${n}`, tipo: "imagen" as const, relacion: "1:1" as const, promptGrok: "", alt: `Foto de la persona ${n}` }));
