import type { Asset, Seccion } from "@/lib/contratos";

const bloques: Seccion["bloques"] = [
  { id: "esc-1", tipo: "foto", ajustes: { slot: "escena-1", pie: "En la oficina" } },
  { id: "esc-2", tipo: "foto", ajustes: { slot: "escena-2", pie: "En casa" } },
  { id: "esc-3", tipo: "foto", ajustes: { slot: "escena-3", pie: "De viaje" } },
];

function armar(variante: "mosaico-3" | "banda-a-sangre"): Seccion {
  return {
    id: `ejemplo-escena-uso-${variante}`,
    tipo: "escena-uso",
    variante,
    visible: true,
    intencion: { objetivo: "Mostrar el producto en la vida real con fotos de ambiente.", emocion: "deseo" },
    ajustes: { titulo: "En tu vida real", texto: "Así se ve en el día a día." },
    bloques: variante === "banda-a-sangre" ? bloques.slice(0, 1) : bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = { "mosaico-3": armar("mosaico-3"), "banda-a-sangre": armar("banda-a-sangre") } as const;
export const ejemplo: Seccion = ejemplos["mosaico-3"];

export const assets: Asset[] = [1, 2, 3].map((n) => ({ slot: `escena-${n}`, tipo: "imagen" as const, relacion: "4:5" as const, promptGrok: "", alt: `Escena de uso ${n}` }));
