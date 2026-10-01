import type { Asset, Seccion } from "@/lib/contratos";

const bloques: Seccion["bloques"] = [
  { id: "pq-1", tipo: "punto", ajustes: { texto: "Pasas horas sentado frente a una pantalla", aplica: true } },
  { id: "pq-2", tipo: "punto", ajustes: { texto: "Quieres una solución que no se note", aplica: true } },
  { id: "pq-3", tipo: "punto", ajustes: { texto: "Prefieres probar y pagar al recibir", aplica: true } },
  { id: "pq-4", tipo: "punto", ajustes: { texto: "Buscas un tratamiento médico", aplica: false } },
  { id: "pq-5", tipo: "punto", ajustes: { texto: "Esperas resultados sin usarlo", aplica: false } },
];

function armar(variante: "lista-check" | "dos-perfiles"): Seccion {
  return {
    id: `ejemplo-para-quien-${variante}`,
    tipo: "para-quien",
    variante,
    visible: true,
    intencion: { objetivo: "Que la persona se reconozca y se filtre sola antes de leer el precio.", emocion: "pertenencia", objecionQueResponde: "¿Esto es para mí?" },
    ajustes: { titulo: "Esto es para ti si…", imagen: "para-quien-imagen" },
    bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = { "lista-check": armar("lista-check"), "dos-perfiles": armar("dos-perfiles") } as const;
export const ejemplo: Seccion = ejemplos["lista-check"];

export const assets: Asset[] = [{ slot: "para-quien-imagen", tipo: "imagen", relacion: "4:5", promptGrok: "", alt: "Persona usando el producto en su día a día" }];
