import { Brief, type TecnicaId, type VarianteHeroe } from "@/lib/contratos";

// Los 5 productos de ejemplo del banco (docs/06 §4). Sin calificaciones, opiniones ni testimonios inventados:
// esos campos se omiten y la landing mostrará [COMPLETAR]. Precios de referencia en COP.
//
// `numeroSemilla` reproduce con `tirarSemilla` el estilo × industria de cada ejemplo. La biblioteca de
// semillas (docs/04 §1) no incluye «ficha médica», «etiquetado de farmacia» ni «catálogo técnico de patentes»
// como industrias, ni «señalética de metro» / «cartografía» como estilos, así que se usó la combinación más
// cercana de la biblioteca (ver `combinacion`).

export interface EjemploBanco {
  id: string;
  brief: Brief;
  tecnicas: TecnicaId[];
  numeroSemilla: number;
  varianteHeroe: VarianteHeroe;
  /** Carpeta de `public/media/` donde Jenser deja los archivos de Grok. */
  carpetaMedia: string;
  /** Estilo × industria que produce `tirarSemilla(numeroSemilla)`. */
  combinacion: { estilo: string; industria: string };
}

const brief = (b: unknown): Brief => Brief.parse(b);

export const EJEMPLOS: readonly EjemploBanco[] = [
  {
    id: "corrector-postura",
    numeroSemilla: 30,
    varianteHeroe: "problema-primero",
    carpetaMedia: "public/media/ejemplos/corrector-postura/",
    combinacion: { estilo: "manual de instrucciones industrial", industria: "fichas de museo" },
    tecnicas: ["ambicioso", "sustractivo", "negativas", "humana"],
    brief: brief({
      nombre: "Corrector de postura",
      categoria: "salud-y-bienestar",
      problema: "Pasas ocho horas sentado frente al computador y la espalda te lo cobra al final de la tarde.",
      publico: "Personas de 25 a 45 años que trabajan en oficina o desde casa y notan los hombros caídos.",
      beneficios: [
        "Te recuerda enderezar la espalda sin pensarlo",
        "Se usa bajo la camiseta y no se nota",
        "Ajuste regulable para hombres y mujeres",
        "Tela transpirable para llevarlo toda la jornada",
      ],
      precio: { valor: 89900, anterior: 119900, moneda: "COP" },
      objeciones: [
        "¿Se nota debajo de la ropa?",
        "¿Es incómodo llevarlo varias horas?",
        "¿Sirve si ya tengo dolor de espalda?",
        "¿Cómo sé cuál es mi talla?",
        "¿Qué pasa si no me funciona?",
      ],
      nivelConciencia: "problema",
      incluye: ["Corrector ajustable", "Guía de uso en la caja"],
      intensidad: 3,
    }),
  },
  {
    id: "colageno",
    numeroSemilla: 145,
    varianteHeroe: "producto-monumental",
    carpetaMedia: "public/media/ejemplos/colageno/",
    combinacion: { estilo: "japonés ma (espacio negativo)", industria: "empaques de farmacia" },
    tecnicas: ["semilla", "ambicioso", "negativas", "humana"],
    brief: brief({
      nombre: "Colágeno hidrolizado",
      categoria: "belleza",
      problema: "Quieres cuidar la piel y las articulaciones, pero no encuentras un suplemento fácil de tomar todos los días.",
      publico: "Mujeres y hombres de 30 a 55 años que ya conocen el colágeno y buscan una opción sin sabor.",
      beneficios: [
        "Polvo sin sabor que se disuelve en agua fría o caliente",
        "Una medida al día, sin preparar nada más",
        "Frasco de 30 porciones para un mes completo",
      ],
      precio: { valor: 99900, anterior: 129900, moneda: "COP" },
      objeciones: [
        "¿Cuánto tiempo tarda en notarse?",
        "¿Sabe a algo?",
        "¿Se puede mezclar con café?",
        "¿Tiene registro sanitario?",
      ],
      nivelConciencia: "solucion",
      incluye: ["Frasco de 30 porciones", "Medida dosificadora"],
      intensidad: 2,
    }),
  },
  {
    id: "cepillo-9en1",
    numeroSemilla: 161,
    varianteHeroe: "titular-tipografico",
    carpetaMedia: "public/media/ejemplos/cepillo-9en1/",
    combinacion: { estilo: "brutalismo tipográfico", industria: "laboratorio" },
    tecnicas: ["semilla", "critico", "sustractivo", "negativas"],
    brief: brief({
      nombre: "Cepillo eléctrico 9 en 1",
      categoria: "hogar",
      problema: "Limpiar baño, cocina y juntas exige comprar un cepillo distinto para cada superficie.",
      publico: "Personas de 25 a 60 años que hacen el aseo del hogar y quieren ahorrar tiempo y esfuerzo.",
      beneficios: [
        "Nueve cabezales intercambiables para cada superficie",
        "Motor recargable por USB",
        "Mango largo que evita agacharte",
        "Cabezales lavables y reemplazables",
      ],
      precio: { valor: 129900, anterior: 169900, moneda: "COP" },
      objeciones: [
        "¿Cuánto dura la batería?",
        "¿Aguanta el agua?",
        "¿Dónde compro cabezales de repuesto?",
        "¿Sirve para sacar el moho de las juntas?",
      ],
      nivelConciencia: "producto",
      incluye: ["Cepillo con motor", "9 cabezales", "Cable de carga USB"],
      intensidad: 3,
    }),
  },
  {
    id: "timbre-camara",
    numeroSemilla: 74,
    varianteHeroe: "video-inmersivo",
    carpetaMedia: "public/media/ejemplos/timbre-camara/",
    combinacion: { estilo: "Swiss International", industria: "señalética de metro" },
    tecnicas: ["semilla", "imagenes", "video", "negativas"],
    brief: brief({
      nombre: "Timbre con cámara",
      categoria: "tecnologia",
      problema: "Llegan paquetes y visitas cuando no estás y no sabes quién tocó a tu puerta.",
      publico: "Familias y dueños de apartamento de 28 a 55 años que quieren ver quién llama desde el celular.",
      beneficios: [
        "Video en el celular cuando alguien toca",
        "Visión nocturna para ver de noche",
        "Audio en dos vías para hablar con quien llega",
        "Instalación sin obra con conexión wifi",
      ],
      precio: { valor: 159900, anterior: 199900, moneda: "COP" },
      objeciones: [
        "¿Necesito wifi en la puerta?",
        "¿Funciona con una app en español?",
        "¿Se instala sin técnico?",
        "¿Guarda los videos?",
      ],
      nivelConciencia: "solucion",
      incluye: ["Timbre con cámara", "Campana interior", "Tornillos y guía de instalación"],
      intensidad: 3,
    }),
  },
  {
    id: "llavero-3en1",
    numeroSemilla: 3,
    varianteHeroe: "producto-monumental",
    carpetaMedia: "public/media/ejemplos/llavero-3en1/",
    combinacion: { estilo: "constructivismo ruso", industria: "relojería" },
    tecnicas: ["semilla", "ambicioso", "critico", "imagenes", "video", "sustractivo", "negativas", "humana"],
    brief: brief({
      nombre: "Llavero encendedor 3 en 1",
      categoria: "moda-y-accesorios",
      problema: "Cargas llaves, linterna y encendedor por separado y siempre falta uno cuando lo necesitas.",
      publico: "Personas de 20 a 50 años que salen de camping, viajan o quieren un accesorio útil para el día a día.",
      beneficios: [
        "Encendedor recargable por USB, sin gas ni fluido",
        "Linterna LED integrada",
        "Llavero de acero que resiste el uso diario",
      ],
      precio: { valor: 49900, anterior: 69900, moneda: "COP" },
      objeciones: [
        "¿Cuántos encendidos da por carga?",
        "¿Funciona con viento?",
        "¿Se puede llevar en el avión?",
      ],
      nivelConciencia: "producto",
      incluye: ["Llavero 3 en 1", "Cable de carga USB"],
      intensidad: 3,
    }),
  },
];
