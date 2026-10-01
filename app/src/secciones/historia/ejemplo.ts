import type { Asset, Seccion } from "@/lib/contratos";

const bloques: Seccion["bloques"] = [
  { id: "his-1", tipo: "intento", ajustes: { texto: "Estiramientos que se olvidan a los dos días" } },
  { id: "his-2", tipo: "intento", ajustes: { texto: "Una silla nueva que no cambió el hábito" } },
];

function armar(variante: "escena" | "carta"): Seccion {
  return {
    id: `ejemplo-historia-${variante}`,
    tipo: "historia",
    variante,
    visible: true,
    intencion: { objetivo: "Mostrar el punto de inflexión y por qué lo anterior no funcionó, sin culpar.", emocion: "empatía", objecionQueResponde: "Ya probé de todo." },
    ajustes: {
      titulo: "Lo que ya probaste",
      historia: "Terminas la jornada con la espalda cargada y prometes que mañana te sentarás mejor. Mañana llega y vuelves a encorvarte sin darte cuenta.",
      giro: "No es falta de voluntad: el cuerpo no avisa a tiempo. Por eso hace falta un aviso en el momento justo.",
      imagen: "historia-imagen",
    },
    bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = { escena: armar("escena"), carta: armar("carta") } as const;
export const ejemplo: Seccion = ejemplos.escena;

export const assets: Asset[] = [{ slot: "historia-imagen", tipo: "imagen", relacion: "16:9", promptGrok: "", alt: "Escena cotidiana de la persona" }];
