import type { Asset, Seccion } from "@/lib/contratos";
import { COMPLETAR } from "@/componentes/dinero";

// Las fechas salen de una fuente: en el ejemplo van como [COMPLETAR].
const bloques: Seccion["bloques"] = [
  { id: "lin-1", tipo: "hito", ajustes: { cuando: COMPLETAR, titulo: "El primer paso", texto: "Cómo empezó todo y por qué importó.", imagen: "hito-1" } },
  { id: "lin-2", tipo: "hito", ajustes: { cuando: COMPLETAR, titulo: "El gran avance", texto: "Lo que cambió después.", imagen: "hito-2" } },
  { id: "lin-3", tipo: "hito", ajustes: { cuando: COMPLETAR, titulo: "Lo que vemos hoy", imagen: "hito-3" } },
];

function armar(variante: "vertical" | "horizontal"): Seccion {
  return {
    id: `ejemplo-linea-tiempo-${variante}`,
    tipo: "linea-tiempo",
    variante,
    visible: true,
    intencion: { objetivo: "Contar una historia en orden para que se entienda de dónde viene el tema.", emocion: "curiosidad" },
    ajustes: { titulo: "Cómo llegamos hasta aquí", intro: "Tres momentos para entender el tema." },
    bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = { vertical: armar("vertical"), horizontal: armar("horizontal") } as const;
export const ejemplo: Seccion = ejemplos.vertical;

export const assets: Asset[] = [1, 2, 3].map((n) => ({ slot: `hito-${n}`, tipo: "imagen" as const, relacion: "4:5" as const, promptGrok: "", alt: `Imagen del hito ${n}` }));
