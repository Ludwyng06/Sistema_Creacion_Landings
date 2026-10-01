import type { Asset, Seccion } from "@/lib/contratos";

const beneficiosCortos = [
  { id: "hero-bc-1", tipo: "beneficio-corto", ajustes: { texto: "Aviso suave al encorvarte" } },
  { id: "hero-bc-2", tipo: "beneficio-corto", ajustes: { texto: "Se lleva bajo la ropa" } },
  { id: "hero-bc-3", tipo: "beneficio-corto", ajustes: { texto: "Carga por USB" } },
];

// Las cifras y la prueba social salen del brief: los ejemplos nunca traen `sello`.
function armar(
  variante: string,
  id: string,
  objetivo: string,
  emocion: string,
  ajustes: Seccion["ajustes"],
  bloques: Seccion["bloques"] = [],
  entrada: "aparecer" | "subir" | "escala" = "aparecer",
): Seccion {
  return {
    id,
    tipo: "heroe",
    variante,
    visible: true,
    intencion: { objetivo, emocion },
    ajustes,
    bloques,
    animacion: { entrada, retraso: 0 },
  };
}

export const ejemploProductoMonumental = armar(
  "producto-monumental",
  "ejemplo-heroe-monumental",
  "Mostrar el corrector grande y centrado porque la persona ya conoce el producto y quiere verlo (nivel producto).",
  "deseo",
  {
    titular: "Endereza la espalda sin pensarlo",
    subtitular: "Un corrector discreto que vibra cuando te encorvas frente al computador.",
    textoBoton: "Quiero mejorar mi postura",
    slot: "heroe-producto",
  },
  beneficiosCortos,
);

export const ejemploPosterASangre = armar(
  "poster-a-sangre",
  "ejemplo-heroe-poster",
  "Dejar que una imagen de revista ocupe toda la pantalla y hable primero, con el texto en el tercio inferior (semilla editorial).",
  "aspiración",
  {
    titular: "Tu postura también se nota en la foto",
    subtitular: "Un corrector fino que trabaja por debajo de la ropa.",
    textoBoton: "Quiero el mío",
    slot: "heroe-poster",
  },
  [],
  "escala",
);

export const ejemploProblemaPrimero = armar(
  "problema-primero",
  "ejemplo-heroe-problema",
  "Abrir con la pregunta de dolor porque la persona aún no busca una solución (PAS).",
  "reconocimiento",
  {
    titular: "¿Terminas el día con la espalda cargada?",
    subtitular: "Pasas horas sentado y los hombros se van hacia adelante sin que lo notes.",
    textoBoton: "Quiero dejar de encorvarme",
  },
  [],
  "subir",
);

export const ejemploTitularTipografico = armar(
  "titular-tipografico",
  "ejemplo-heroe-tipografico",
  "Dejar que el titular gigante lleve la página, con el producto asomando debajo (semilla suiza).",
  "confianza",
  {
    titular: "Siéntate derecho",
    subtitular: "El aviso llega en el momento justo, no cuando ya te duele.",
    textoBoton: "Pedir mi corrector",
    slot: "heroe-producto",
  },
  [],
  "escala",
);

export const ejemploAntesDespuesHeroe = armar(
  "antes-despues-heroe",
  "ejemplo-heroe-antes-despues",
  "Mostrar el resultado desde el primer segundo, porque el cambio de postura se ve en una foto.",
  "prueba",
  {
    titular: "Así cambia tu postura",
    subtitular: "Desliza para ver la misma escena sin corrector y con corrector.",
    textoBoton: "Quiero ese cambio",
    slots: ["heroe-antes", "heroe-despues"],
  },
);

export const ejemploVideoInmersivo = armar(
  "video-inmersivo",
  "ejemplo-heroe-video",
  "Enseñar el corrector en uso y en movimiento, con un clip continuo a sangre.",
  "curiosidad",
  {
    titular: "Míralo trabajar contigo",
    subtitular: "Un aviso suave mientras haces lo de siempre.",
    textoBoton: "Quiero verlo de cerca",
    slot: "heroe-video",
  },
);

export const ejemploOrbitaBeneficios = armar(
  "orbita-beneficios",
  "ejemplo-heroe-orbita",
  "Poner el producto al centro y mostrar sus funciones a su alrededor, porque hace varias cosas a la vez.",
  "claridad",
  {
    titular: "Un solo corrector, tres cosas resueltas",
    subtitular: "Avisa, se esconde y se carga fácil.",
    textoBoton: "Quiero conocerlo",
    slot: "heroe-producto",
  },
  beneficiosCortos,
);

export const ejemploMosaicoEditorial = armar(
  "mosaico-editorial",
  "ejemplo-heroe-mosaico",
  "Mostrar el producto en varios momentos del día con un collage y una franja de titular que lo cruza.",
  "estilo",
  {
    titular: "Postura para cada momento del día",
    subtitular: "De la oficina a la casa, el corrector se adapta a lo que haces.",
    textoBoton: "Quiero el mío",
    slots: ["heroe-mosaico-1", "heroe-mosaico-2", "heroe-mosaico-3", "heroe-mosaico-4"],
  },
);

export const ejemplos = {
  "producto-monumental": ejemploProductoMonumental,
  "poster-a-sangre": ejemploPosterASangre,
  "titular-tipografico": ejemploTitularTipografico,
  "problema-primero": ejemploProblemaPrimero,
  "antes-despues-heroe": ejemploAntesDespuesHeroe,
  "video-inmersivo": ejemploVideoInmersivo,
  "orbita-beneficios": ejemploOrbitaBeneficios,
  "mosaico-editorial": ejemploMosaicoEditorial,
} as const;

/** Valor por defecto al «Agregar sección». */
export const ejemplo: Seccion = ejemploProductoMonumental;

function asset(slot: string, relacion: Asset["relacion"], promptGrok: string, alt: string, tipo: Asset["tipo"] = "imagen"): Asset {
  return { slot, tipo, relacion, promptGrok, alt };
}

export const assets: Asset[] = [
  asset(
    "heroe-producto",
    "4:5",
    "Corrector de postura negro mate sobre fondo liso, vista frontal centrada, luz de estudio suave, sin personas ni texto, formato 4:5.",
    "Corrector de postura negro mate",
  ),
  asset(
    "heroe-poster",
    "4:5",
    "Fotografía editorial de una persona de espaldas erguida junto a una ventana, camisa clara, luz de la tarde, aire de revista, sin mirar a cámara, formato 4:5.",
    "Persona erguida junto a una ventana",
  ),
  asset(
    "heroe-antes",
    "16:9",
    "Escritorio de oficina visto de lado, persona con los hombros hacia adelante frente al computador, luz natural, sin rostro, formato 16:9.",
    "Persona encorvada frente al computador",
  ),
  asset(
    "heroe-despues",
    "16:9",
    "Mismo escritorio y encuadre que la imagen anterior, la persona con la espalda recta y los hombros abiertos, formato 16:9.",
    "Persona con la espalda recta",
  ),
  asset(
    "heroe-video",
    "16:9",
    "Plano lento y continuo de una persona trabajando en su escritorio, la cámara se acerca despacio, luz natural, sin cortes, 6 segundos, formato 16:9.",
    "Persona trabajando en su escritorio",
    "video",
  ),
  asset("heroe-mosaico-1", "4:5", "Corrector de postura sobre un escritorio de madera, luz de la mañana, formato 4:5.", "Corrector sobre un escritorio"),
  asset("heroe-mosaico-2", "4:5", "Espalda de una persona con camisa clara caminando por una calle, luz cálida, formato 4:5.", "Persona caminando con buena postura"),
  asset("heroe-mosaico-3", "4:5", "Manos sobre un teclado con el corrector visible en la muñeca de la silla, formato 4:5.", "Manos sobre un teclado"),
  asset("heroe-mosaico-4", "4:5", "Persona estirándose en una sala luminosa, sin mirar a cámara, formato 4:5.", "Persona estirándose en casa"),
];
