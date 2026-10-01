import type { Asset, Seccion } from "@/lib/contratos";

export const ejemplo: Seccion = {
  id: "ejemplo-antes-despues",
  tipo: "antes-despues",
  visible: true,
  intencion: {
    objetivo: "Hacer visible el resultado: la misma postura sin corrector y con corrector.",
    emocion: "prueba",
  },
  ajustes: {
    titulo: "Mira la diferencia en tu postura",
    imagenAntes: "postura-antes",
    imagenDespues: "postura-despues",
    etiquetaAntes: "Sin corrector",
    etiquetaDespues: "Con corrector",
  },
  bloques: [],
  animacion: { entrada: "subir", retraso: 0 },
};

export const assets: Asset[] = [
  {
    slot: "postura-antes",
    tipo: "imagen",
    relacion: "4:5",
    promptGrok:
      "Persona de espaldas sentada frente al computador con los hombros caídos hacia adelante, luz suave de oficina, sin rostro visible, formato 4:5.",
    alt: "Persona con los hombros hacia adelante",
  },
  {
    slot: "postura-despues",
    tipo: "imagen",
    relacion: "4:5",
    promptGrok:
      "La misma persona y el mismo escritorio, de espaldas, con la espalda recta y los hombros abiertos, misma luz y encuadre que la imagen anterior, formato 4:5.",
    alt: "Persona con la espalda recta",
  },
];
