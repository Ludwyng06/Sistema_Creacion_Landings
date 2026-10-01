import type { Seccion } from "@/lib/contratos";
import { VARIANTES_NUEVAS } from "../variantes";

const OBJETIVO = "Darle vida a la página con un dato real del cielo, que se oculta solo si la fuente falla.";
const TITULOS: Record<(typeof VARIANTES_NUEVAS)["dato-en-vivo"][number], { titulo: string; contexto: string }> = {
  auroras: { titulo: "Las auroras, ahora mismo", contexto: "Tu techo puede tener las mismas luces, sin viajar al polo." },
  "fase-lunar": { titulo: "La Luna de hoy", contexto: "Una lámpara que muestra la misma Luna que ves por la ventana." },
  iss: { titulo: "La estación espacial, en vivo", contexto: "Mientras lees esto, sigue dando vueltas a la Tierra." },
  "cuenta-regresiva-lanzamiento": { titulo: "El próximo despegue", contexto: "Que tus hijos vean el conteo y armen su propio cohete." },
  asteroides: { titulo: "Hoy en el cielo", contexto: "Con un telescopio, el cielo de tu casa cambia cada noche." },
};

function armar(variante: (typeof VARIANTES_NUEVAS)["dato-en-vivo"][number]): Seccion {
  return {
    id: `ejemplo-dato-en-vivo-${variante}`,
    tipo: "dato-en-vivo",
    variante,
    visible: true,
    intencion: { objetivo: OBJETIVO, emocion: "asombro" },
    ajustes: TITULOS[variante],
    bloques: [],
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = {
  auroras: armar("auroras"),
  "fase-lunar": armar("fase-lunar"),
  iss: armar("iss"),
  "cuenta-regresiva-lanzamiento": armar("cuenta-regresiva-lanzamiento"),
  asteroides: armar("asteroides"),
} as const;

/** Valor por defecto al «Agregar sección». */
export const ejemplo: Seccion = ejemplos.auroras;
