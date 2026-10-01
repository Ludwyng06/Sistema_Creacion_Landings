import type { Asset, Seccion } from "@/lib/contratos";

export const ejemplo: Seccion = {
  id: "ejemplo-problema-solucion",
  tipo: "problema-solucion",
  visible: true,
  intencion: {
    objetivo: "Nombrar el problema con una escena cotidiana y girar hacia la solución en una frase.",
    emocion: "empatía",
  },
  ajustes: {
    titulo: "Terminas la jornada con los hombros hacia adelante",
    historia:
      "Empiezas el día sentado derecho. A media mañana el cuello ya se inclinó hacia la pantalla y los hombros lo siguieron. Nadie te avisa, y cuando lo notas ya llevas horas así.",
    giro: "Un aviso suave, justo cuando te encorvas, cambia el hábito sin que tengas que vigilarte.",
    imagen: "problema-escena",
  },
  bloques: [],
  animacion: { entrada: "subir", retraso: 0 },
};

export const assets: Asset[] = [
  {
    slot: "problema-escena",
    tipo: "imagen",
    relacion: "16:9",
    promptGrok:
      "Escritorio de oficina visto de lado, persona sentada con los hombros hacia adelante frente al computador, luz natural de la mañana, sin mirar a cámara, formato 16:9.",
    alt: "Persona encorvada frente al computador",
  },
];
