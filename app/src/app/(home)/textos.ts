// Todo el texto del home en un solo lugar: se revisa contra la lista negra en `tests/home/`.

export const TEXTOS = {
  marca: "Creador de Landings",
  marcaCorta: "Landings",
  enlaces: [
    { href: "/crear", etiqueta: "Crear" },
    { href: "/banco", etiqueta: "Banco" },
    { href: "/tecnicas", etiqueta: "Técnicas" },
    { href: "/ajustes", etiqueta: "Ajustes" },
  ],
  portada: {
    titular: "Landings que no parecen hechas por IA.",
    apoyo: "Cuéntanos qué quieres: un producto, un evento, un servicio o un tema. Te armamos una página con criterio de diseño, y la puedes editar como quieras.",
    boton: "Crear la mía",
    avisoScroll: "Baja para ver cómo se arma",
  },
  problema: {
    titular: "Así se ven las demás.",
    apoyo: "Título a la izquierda, foto a la derecha, degradado morado. La misma página repetida con doce nombres distintos.",
  },
  brief: {
    titular: "Empiezas con una frase.",
    apoyo: "Escribes lo que quieres, sea un producto, un evento o un tema. El sistema detecta de qué se trata y activa las fuentes que hacen falta. Lo que no sepa queda como [COMPLETAR]: no inventamos cifras.",
    campo: "¿Qué landing quieres?",
    ejemplo: "Landing para una noche de observación de la lluvia de meteoros en Villa de Leyva",
    detectado: "Detectado",
    fuentes: "Fuentes que se activan",
    tipo: "Evento",
    tematica: "Espacio",
    listaFuentes: ["NASA", "NOAA", "Openverse"],
  },
  tecnicas: {
    titular: "Ocho técnicas, un solo prompt.",
    apoyo: "Cada técnica pone su pieza en una de las cuatro capas del prompt.",
    capas: { rol: "Rol", tarea: "Tarea", contexto: "Contexto", formato: "Formato" },
  },
  ensamblaje: {
    titular: "Se arma sección por sección.",
    apoyo: "La IA entrega un documento con colores, tipografías y secciones. La página la dibujan componentes ya probados, con datos reales de la temática: el cielo de hoy, la ISS o el clima.",
    marco: "Las secciones de una landing real se juntan dentro de un móvil",
    rotulo: "Cada sección, por separado",
    rotuloQuieto: "La landing completa, en un móvil",
  },
  semilla: {
    titular: "Una semilla decide cómo se ve.",
    apoyo: "Un estilo histórico y una industria vecina fijan colores, tipografías y bordes. Cambias la semilla y toda la página cambia con ella.",
    contador: "Semilla",
    region: "La misma landing con tres semillas distintas",
    sitio: "Landing real de la vitrina",
  },
  critico: {
    titular: "Un crítico revisa antes de que la veas.",
    apoyo: "Otra IA, distinta de la que escribió, puntúa la landing con ocho criterios y devuelve correcciones concretas.",
    ilustrativo: "Ejemplo ilustrativo de cómo sube el puntaje cuando se corrigen los problemas.",
    antes: "Antes",
    despues: "Después",
    puntaje: "Puntaje del crítico",
    grafico: "Radar de ocho criterios: el puntaje sube de 6,2 a 9,1 después de las correcciones",
    anotaciones: ["El titular dice qué es en 3 segundos", "Un paso menos hasta el formulario", "Textos más grandes a 390 px"],
  },
  banco: {
    titular: "Cada landing guarda el prompt que la creó.",
    apoyo: "El banco reúne las landings terminadas de cualquier tipo, con sus técnicas y su puntaje, para copiar lo que funcionó. Empieza con ocho de muestra.",
    region: "Landings del banco. Desliza para ver más.",
    enlace: "Abrir el banco",
    sinPuntaje: "Sin puntaje",
    ejemplo: "Ejemplo",
    voltear: "Ver el prompt",
    volver: "Volver a la tarjeta",
    verLanding: "Ver la landing",
    promptDe: "Prompt de",
  },
  cierre: {
    titular: "Tu idea ya tiene algo que contar.",
    apoyo: "Solo falta escribirlo.",
    boton: "Construir mi landing",
  },
} as const;

/** Todas las cadenas, para revisarlas con el linter de lista negra. */
export function todosLosTextos(): string[] {
  const salida: string[] = [];
  const recorrer = (valor: unknown) => {
    if (typeof valor === "string") salida.push(valor);
    else if (Array.isArray(valor)) valor.forEach(recorrer);
    else if (valor && typeof valor === "object") Object.values(valor).forEach(recorrer);
  };
  recorrer(TEXTOS);
  return salida;
}
