import type { ModoIA, ProveedorId, TareaIA } from "@/lib/contratos";

// Textos de /ajustes. Los motivos de cada tarea salen de docs/07 §5.

export const PROVEEDORES_EDITABLES: readonly Exclude<ProveedorId, "manual">[] = ["openai", "gemini", "cerebras", "groq", "openrouter"];

export const NOMBRE_PROVEEDOR: Record<ProveedorId, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  cerebras: "Cerebras",
  groq: "Groq",
  openrouter: "OpenRouter",
  manual: "Manual",
};

export const ETIQUETA_ESTADO: Record<string, string> = {
  "sin-clave": "Sin clave",
  conectado: "Conectado",
  limite: "Límite alcanzado",
  error: "Con error",
  "sin-probar": "Sin probar",
};

/** Sin clave de Cerebras el texto pasa a Gemini, Groq y OpenRouter: es un proveedor principal pero no obligatorio. */
export const ETIQUETA_SIN_CLAVE: Record<string, string> = { cerebras: "No configurado (principal de texto; sin él se usa Gemini)" };

export const MODOS: { id: ModoIA; nombre: string; explicacion: string }[] = [
  {
    id: "cascada",
    nombre: "Cascada",
    explicacion: "Usa el primer proveedor de la lista y, si falla por límite, red, clave o tiempo, pasa al siguiente sin repetir.",
  },
  {
    id: "simultaneo",
    nombre: "Simultáneo",
    explicacion: "Cada tarea usa su proveedor preferido y las tareas independientes corren a la vez; la cascada sirve de respaldo.",
  },
  {
    id: "duelo",
    nombre: "Duelo",
    explicacion: "Dos proveedores generan la misma landing en paralelo y un tercero puntúa ambas para que elijas.",
  },
];

export const TAREAS: { id: TareaIA; nombre: string; motivo: string }[] = [
  { id: "objeciones", nombre: "Proponer objeciones", motivo: "Es una tarea corta y rápida que puede correr mientras llenas el brief." },
  { id: "landing", nombre: "Generar la landing", motivo: "Produce una salida larga con esquema; Gemini acepta el JSON Schema y tiene contexto largo." },
  { id: "prompts-grok", nombre: "Prompts de Grok", motivo: "Es texto corto y se genera en paralelo con la landing, a partir del brief y los tokens." },
  { id: "corregir-lista-negra", nombre: "Corregir lista negra", motivo: "Son correcciones cortas por campo, varias a la vez." },
  { id: "humanizar", nombre: "Pase humanizador", motivo: "Reescribe textos largos por secciones; Cerebras da mucho volumen por minuto." },
  { id: "critico", nombre: "Crítico", motivo: "Evalúa rápido y con un modelo distinto al creador, para que no se apruebe a sí mismo." },
  { id: "mejorar-prompt", nombre: "Mejorar prompt", motivo: "Pide calidad de redacción, donde Gemini rinde mejor." },
  { id: "juez-duelo", nombre: "Juez del duelo", motivo: "Puntúa dos landings con rapidez y debe ser un tercero distinto a los competidores." },
  { id: "investigar", nombre: "Investigar el producto", motivo: "Resume los resultados de Google sin inventar; una tarea corta y barata, apta para Groq." },
  { id: "describir-medio", nombre: "Describir un medio del banco", motivo: "Título, descripción y etiquetas en español para cada imagen: una tarea corta y barata, apta para Groq." },
  { id: "estrategia", nombre: "Estrategia", motivo: "Diagnóstico de conversión de una sola vez: pide criterio y contexto largo, donde Gemini rinde mejor." },
  { id: "plan-secciones", nombre: "Plan de secciones", motivo: "Ordena las secciones según las preguntas del visitante; una salida corta y estructurada." },
  { id: "redactar-seccion", nombre: "Redactar una sección", motivo: "Una llamada por sección, repartidas entre Gemini y Groq con un máximo de 3 a la vez." },
  { id: "prompts-imagen", nombre: "Prompts de imagen", motivo: "Ficha común y un prompt por slot para que todas las imágenes de una landing sean coherentes." },
  { id: "validar-imagen", nombre: "Validar una imagen", motivo: "Mira la imagen: necesita visión, así que solo Gemini la atiende." },
  { id: "intake", nombre: "Entender la idea", motivo: "Convierte la descripción libre en datos estructurados: una tarea corta y barata, apta para Groq." },
  { id: "dato-curioso", nombre: "Datos curiosos", motivo: "Reescribe un dato real como frase «¿Sabías que…?» con su fuente: corta y barata, apta para Groq." },
  { id: "identificar-producto", nombre: "Identificar el producto", motivo: "Mira la foto: necesita visión, así que solo Gemini la atiende." },
];

export const ENLACES_CLAVES: { proveedor: string; url: string; texto: string }[] = [
  { proveedor: "Gemini", url: "https://aistudio.google.com", texto: "aistudio.google.com → Get API key" },
  { proveedor: "Groq", url: "https://console.groq.com", texto: "console.groq.com → API Keys" },
  { proveedor: "Cerebras", url: "https://cloud.cerebras.ai", texto: "cloud.cerebras.ai → API Keys" },
  { proveedor: "OpenRouter", url: "https://openrouter.ai", texto: "openrouter.ai → Keys" },
];
