// Escenas por sección y tipo de landing (24-A entrega 2). Cada slot pide una escena DISTINTA: un servicio de tours no muestra seis veces el mismo
// lago. `en` va al prompt del generador; `es` es el texto alternativo (8 a 16 palabras) de lo que de verdad se ve.

export interface Escena {
  en: string;
  es: string;
}

export type ClaveSeccion = "heroe" | "problema" | "galeria" | "incluye" | "otro";
type Banco = Partial<Record<ClaveSeccion, Escena[]>>;

const e = (en: string, es: string): Escena => ({ en, es });

const GENERICO: Required<Banco> = {
  heroe: [e("a wide establishing shot with generous empty space on one side for a headline", "Vista amplia y despejada del lugar principal, con espacio libre para el titular")],
  problema: [e("an everyday scene that shows the need before the solution, flat neutral light", "Escena cotidiana que muestra la necesidad antes de contar con la solución")],
  galeria: [
    e("a detail shot with natural texture and soft depth of field", "Detalle cercano con textura natural y fondo suavemente desenfocado, luz de ambiente"),
    e("the subject in its real setting, seen from a slightly different angle", "El tema fotografiado en su entorno real desde un ángulo ligeramente distinto"),
    e("a close, intimate composition that shows quality and atmosphere", "Composición cercana e íntima que transmite calidad y ambiente, sin personas identificables"),
    e("a top-down flat lay of the related objects on a plain surface", "Objetos relacionados vistos desde arriba sobre una superficie lisa y ordenada"),
  ],
  incluye: [e("everything that comes together laid out neatly on a plain surface, top-down view", "Todo lo que incluye la propuesta, ordenado desde arriba sobre una superficie lisa")],
  otro: [e("a clean editorial photograph with a clear single subject", "Fotografía limpia y editorial con un solo protagonista claro en el encuadre")],
};

const BANCOS: Record<string, Banco> = {
  // Servicios, eventos y divulgación sobre el espacio (tours de auroras, noches de observación, charlas de astronomía).
  "tour-espacio": {
    heroe: [e("wide shot of a small group of travelers seen from behind on a frozen lake, tripods set up, watching a green aurora ribbon across a dark sky, empty sky above for a headline", "Viajeros de espaldas con trípodes sobre un lago helado miran una aurora verde en el cielo")],
    problema: [e("a person seen from behind through a cold window at night, a cloudy flat sky outside, longing mood, no stars visible", "Persona de espaldas junto a una ventana fría mira un cielo nocturno nublado y sin estrellas")],
    galeria: [
      e("a wooden cabin with warm lit windows under a green aurora, snow around, calm night", "Cabaña de madera con ventanas encendidas bajo una aurora verde, rodeada de nieve"),
      e("a tour guide in a winter jacket seen from behind pointing up at the night sky, silhouettes of the group beside", "Guía de espaldas con abrigo señala el cielo nocturno mientras el grupo observa a su lado"),
      e("two hands holding a steaming hot drink wrapped in a wool blanket, blurred starry night behind", "Manos sostienen una bebida caliente envueltas en una manta de lana, con noche estrellada detrás"),
      e("a camera on a tripod close up, long exposure setup, starry sky softly out of focus behind", "Cámara sobre un trípode en primer plano, lista para fotografiar el cielo estrellado de noche"),
      e("group silhouettes around a small campfire at night with stars above, no faces", "Siluetas de un grupo alrededor de una pequeña fogata nocturna bajo un cielo lleno de estrellas"),
      e("snowy pine forest road at blue hour with a faint aurora glow on the horizon", "Camino nevado entre pinos a la hora azul, con un leve resplandor de aurora en el horizonte"),
    ],
    incluye: [e("warm gear laid out on a wooden table: thermos, wool blanket, gloves and a headlamp, top-down", "Termo, manta de lana, guantes y linterna frontal dispuestos sobre una mesa de madera, vistos desde arriba")],
    otro: [
      e("close-up of a gloved hand adjusting a telescope eyepiece under a starry sky", "Mano con guante ajusta el ocular de un telescopio bajo un cielo estrellado"),
      e("a lone traveler silhouette on a hill under the milky way, no face", "Silueta de un viajero sobre una colina bajo la Vía Láctea, sin rostro visible"),
      e("a minivan parked on a snowy road at night with headlights and green aurora overhead", "Camioneta estacionada en un camino nevado de noche con faros encendidos y aurora verde arriba"),
      e("a map and a compass on a wooden table lit by a small lantern", "Mapa y brújula sobre una mesa de madera iluminada por un pequeño farol"),
    ],
  },
  producto: {
    heroe: [e("the product alone, centered, as the protagonist of the frame on a clean uncluttered backdrop with generous space for a headline", "El producto solo y centrado como protagonista, sobre un fondo limpio con espacio para el titular")],
    problema: [e("an everyday room before the product, flat cool light, slightly dull and empty mood, no product visible", "Habitación cotidiana sin el producto, con luz plana y fría que transmite vacío y rutina")],
    galeria: [
      e("macro detail of the product material, buttons and finish, shallow depth of field", "Detalle macro del material, los acabados y los botones del producto con fondo desenfocado"),
      e("the product in use in a lived-in home interior, warm light, no people", "El producto en uso dentro de un hogar real con luz cálida y sin personas"),
      e("the product on a bedside table at night glowing softly next to a book and a glass of water", "El producto sobre una mesa de noche, encendido, junto a un libro y un vaso de agua"),
      e("hands holding the product from the side to show real size, faces out of frame", "Manos sostienen el producto de lado para mostrar su tamaño real, sin rostros en el encuadre"),
      e("the product next to an everyday object such as a mug to give the scale", "El producto junto a una taza cotidiana que permite comparar su escala real"),
    ],
    incluye: [e("everything the box contains laid out neatly on a table, top-down view, nothing extra that is not sold", "Todo el contenido de la caja ordenado sobre una mesa, visto desde arriba")],
    otro: [e("the product packaging half open on a doorstep, a delivery moment, no people", "Paquete del producto entreabierto en la puerta de una casa, momento de entrega sin personas"), e("the product as a gift on a wooden table with wrapping paper beside it", "El producto como regalo sobre una mesa de madera junto al papel de envolver")],
  },
  servicio: {
    heroe: [e("a calm wide view of the place where the service happens, a professional seen from behind at work, space for a headline", "Vista amplia del lugar donde ocurre el servicio, con un profesional de espaldas trabajando")],
    problema: [e("a person from behind facing a messy, stressful situation the service solves, flat light", "Persona de espaldas frente a una situación desordenada que el servicio viene a resolver")],
    galeria: [
      e("hands at work with the main tools of the service, close-up, natural light", "Manos trabajando con las herramientas principales del servicio, plano cercano y luz natural"),
      e("a tidy workspace seen from above with notebook, tablet and a coffee", "Espacio de trabajo ordenado visto desde arriba con libreta, tableta y una taza de café"),
      e("the result of the service shown as a satisfying finished outcome, no people", "El resultado terminado del servicio, mostrado de forma limpia y satisfactoria, sin personas"),
      e("the entrance of the place with a warm welcoming atmosphere at golden hour", "Entrada del lugar con un ambiente cálido y acogedor durante la hora dorada"),
    ],
    incluye: GENERICO.incluye,
    otro: [e("two people seen from behind talking over a table with documents, collaborative mood", "Dos personas de espaldas conversan sobre una mesa con documentos, ambiente de colaboración"), e("a calendar and a pen on a desk with soft morning light", "Calendario y bolígrafo sobre un escritorio con suave luz de la mañana")],
  },
  evento: {
    heroe: [e("a wide view of the venue before the event, rows of seats and warm stage lights, no readable text", "Vista amplia del lugar del evento con filas de sillas y luces cálidas de escenario")],
    problema: [e("an empty quiet room that lacks the shared experience, flat light", "Sala vacía y silenciosa que carece de la experiencia compartida, con luz plana")],
    galeria: [
      e("audience silhouettes facing a lit stage, no faces", "Siluetas del público frente a un escenario iluminado, sin rostros identificables"),
      e("a table with name badges blank and coffee cups, registration area, top-down", "Mesa de registro con credenciales en blanco y tazas de café, vista desde arriba"),
      e("close-up of hands applauding with warm blurred lights behind", "Primer plano de manos aplaudiendo con luces cálidas desenfocadas al fondo"),
      e("the venue at golden hour from outside with people as tiny silhouettes", "El lugar del evento visto desde fuera al atardecer, con personas como pequeñas siluetas"),
    ],
    incluye: GENERICO.incluye,
    otro: GENERICO.otro,
  },
  curso: {
    heroe: [e("a bright learning space with a laptop, notebook and plant on a desk, space for a headline", "Espacio de estudio luminoso con portátil, cuaderno y una planta sobre el escritorio")],
    problema: [e("a person from behind overwhelmed by scattered notes and tabs on a screen", "Persona de espaldas abrumada por apuntes dispersos y pestañas abiertas en una pantalla")],
    galeria: [
      e("a notebook with sketches and a pencil, top-down, soft light", "Cuaderno con bocetos y un lápiz visto desde arriba con luz suave"),
      e("a laptop showing an abstract lesson screen without readable text on a clean desk", "Portátil con una pantalla de clase abstracta sobre un escritorio limpio y ordenado"),
      e("hands writing a checklist next to a cup of tea", "Manos escribiendo una lista de tareas junto a una taza de té"),
      e("a window seat study corner with books and morning light", "Rincón de estudio junto a la ventana con libros y luz de la mañana"),
    ],
    incluye: GENERICO.incluye,
    otro: GENERICO.otro,
  },
  local: {
    heroe: [e("the storefront or interior of the place at golden hour, inviting, empty of people, space for a headline", "Fachada o interior del local al atardecer, acogedor y sin personas, con espacio para el titular")],
    problema: GENERICO.problema,
    galeria: [
      e("detail of the counter with the main products arranged neatly", "Detalle del mostrador con los productos principales ordenados con cuidado"),
      e("a table by the window with natural light and a drink", "Mesa junto a la ventana con luz natural y una bebida servida"),
      e("hands preparing the signature product, close-up, no face", "Manos preparando el producto estrella en primer plano, sin rostro visible"),
      e("the street sign area at dusk with warm lights, no readable text", "Zona de entrada del local al anochecer con luces cálidas, sin letreros legibles"),
    ],
    incluye: GENERICO.incluye,
    otro: GENERICO.otro,
  },
  causa: {
    heroe: [e("a hopeful wide landscape related to the cause at sunrise, empty space for a headline, no identifiable people", "Paisaje amplio y esperanzador relacionado con la causa al amanecer, con espacio para el titular")],
    problema: [e("a quiet scene that shows the problem the cause addresses, muted light, no identifiable people", "Escena silenciosa que muestra el problema que atiende la causa, con luz apagada")],
    galeria: [
      e("hands planting or building together, close-up, no faces", "Manos plantando o construyendo en conjunto, en primer plano y sin rostros visibles"),
      e("volunteers seen from behind working in a field, golden light", "Voluntarios de espaldas trabajando en un campo bajo la luz dorada de la tarde"),
      e("a before-and-after style detail of a restored place, no people", "Detalle de un lugar recuperado que muestra el cambio logrado, sin personas en la escena"),
      e("a handwritten blank card and a small plant on a table", "Tarjeta en blanco escrita a mano y una pequeña planta sobre una mesa"),
    ],
    incluye: GENERICO.incluye,
    otro: GENERICO.otro,
  },
  app: {
    heroe: [e("a phone floating at a slight angle with an abstract glowing interface, clean gradient backdrop, space for a headline", "Teléfono inclinado con una interfaz abstracta luminosa sobre un fondo degradado y limpio")],
    problema: [e("a person from behind with a cluttered desk and a worried posture, cool light", "Persona de espaldas ante un escritorio desordenado, con postura preocupada y luz fría")],
    galeria: [
      e("a hand holding a phone in a cafe, screen not readable", "Mano sostiene un teléfono en una cafetería, con la pantalla sin texto legible"),
      e("a laptop and phone side by side on a clean desk, abstract screens", "Portátil y teléfono juntos sobre un escritorio limpio, con pantallas abstractas"),
      e("a notification-like glowing icon cluster in abstract shapes on a soft background", "Conjunto de iconos luminosos en formas abstractas sobre un fondo suave y limpio"),
      e("a tidy morning routine scene with a phone on a kitchen counter", "Escena de rutina matutina con un teléfono sobre la encimera de una cocina"),
    ],
    incluye: GENERICO.incluye,
    otro: GENERICO.otro,
  },
  divulgacion: {
    heroe: [e("a wide striking view of the subject of the talk with generous dark space for a headline", "Vista amplia e impactante del tema de la charla, con espacio libre para el titular")],
    problema: GENERICO.problema,
    galeria: GENERICO.galeria,
    incluye: GENERICO.incluye,
    otro: GENERICO.otro,
  },
};

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Banco de escenas según el tipo de landing y la temática; los servicios y eventos de espacio usan el de tours y observación. */
export function bancoDeEscenas(tipo?: string, tematica?: string): string {
  if (tematica === "espacio" && tipo && tipo !== "producto" && tipo !== "app" && tipo !== "causa") return "tour-espacio";
  return tipo && BANCOS[tipo] ? tipo : "";
}

export function claveDeSlot(slot: string, rol: string): ClaveSeccion {
  const s = sinAcentos(slot);
  if (rol === "heroe" || s.startsWith("heroe")) return "heroe";
  if (rol === "problema" || s.startsWith("problema")) return "problema";
  if (rol === "galeria" || s.startsWith("galeria")) return "galeria";
  if (rol === "incluye" || s.startsWith("incluye")) return "incluye";
  return "otro";
}

/**
 * La escena de un slot: sale del banco del tipo de landing, según la sección. `usadas` guarda las escenas ya asignadas en la landing para que
 * dos slots no pidan lo mismo; cuando se acaban, repite la menos usada con un ángulo distinto.
 */
export function escenaDeSlot(p: { slot: string; rol: string }, c: { tipo?: string; tematica?: string }, usadas: Map<string, number>): Escena {
  const banco = bancoDeEscenas(c.tipo, c.tematica);
  const clave = claveDeSlot(p.slot, p.rol);
  const lista = (banco ? BANCOS[banco][clave] : undefined) ?? GENERICO[clave];
  const complemento = clave === "otro" || clave === "galeria" ? [...lista, ...(banco ? (BANCOS[banco].otro ?? []) : []), ...GENERICO.galeria] : lista;
  const candidatas = [...new Map(complemento.map((x) => [x.en, x])).values()];
  const ordenadas = candidatas.map((x, i) => ({ x, i, n: usadas.get(x.en) ?? 0 })).sort((a, b) => a.n - b.n || a.i - b.i);
  const elegida = ordenadas[0].x;
  usadas.set(elegida.en, (usadas.get(elegida.en) ?? 0) + 1);
  return elegida;
}
