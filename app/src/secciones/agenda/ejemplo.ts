import type { Asset, Seccion } from "@/lib/contratos";
import { COMPLETAR } from "@/componentes/dinero";

// Las horas salen del brief: en el ejemplo van como [COMPLETAR].
const bloques: Seccion["bloques"] = [
  { id: "age-1", tipo: "momento", ajustes: { cuando: COMPLETAR, titulo: "Llegada y bienvenida", texto: "Nos presentamos y repartimos el material." } },
  { id: "age-2", tipo: "momento", ajustes: { cuando: COMPLETAR, titulo: "Charla inicial", texto: "Qué vamos a mirar y cómo hacerlo." } },
  { id: "age-3", tipo: "momento", ajustes: { cuando: COMPLETAR, titulo: "Observación guiada" } },
  { id: "age-4", tipo: "momento", ajustes: { cuando: COMPLETAR, titulo: "Preguntas y cierre" } },
];

function armar(variante: "lista-horas" | "por-dias"): Seccion {
  return {
    id: `ejemplo-agenda-${variante}`,
    tipo: "agenda",
    variante,
    visible: true,
    intencion: { objetivo: "Que la persona vea qué va a pasar y cuándo antes de inscribirse.", emocion: "claridad", objecionQueResponde: "¿Qué voy a hacer ahí?" },
    ajustes: { titulo: "Qué vamos a hacer", imagen: "agenda-imagen" },
    bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = { "lista-horas": armar("lista-horas"), "por-dias": armar("por-dias") } as const;
export const ejemplo: Seccion = ejemplos["lista-horas"];

export const assets: Asset[] = [{ slot: "agenda-imagen", tipo: "imagen", relacion: "4:5", promptGrok: "", alt: "El lugar o la actividad del evento" }];
