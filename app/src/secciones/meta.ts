// Metadatos del editor: el equivalente al `{% schema %}` de Shopify.
// Cada `schema.ts` los exporta junto a su esquema Zod para que el editor genere los controles.

export type ControlEditor = "texto" | "textoLargo" | "select" | "numero" | "booleano" | "slot";

export type OpcionSelect = { valor: string; etiqueta: string };

export type MetaCampo = {
  etiqueta: string;
  control: ControlEditor;
  porDefecto: unknown;
  opcional?: boolean;
  ayuda?: string;
  /** Solo para `select`. */
  opciones?: readonly OpcionSelect[];
  /** Solo para `select`: el valor es una lista. */
  multiple?: boolean;
  /** Solo para `texto`: el valor es una lista de textos (el editor la muestra una por línea). */
  lista?: boolean;
  /** El campo solo existe en el editor: la guía que se le da a la IA no lo menciona. */
  soloEditor?: boolean;
  /** Solo para `select`: valores que solo ofrece el editor (variantes con imagen); la IA no los ve. */
  opcionesSoloEditor?: readonly string[];
};

export type MetaBloque = {
  etiqueta: string;
  min: number;
  max: number;
  campos: Record<string, MetaCampo>;
};

export type MetaSeccion<A extends string = string, B extends string = string> = {
  /** Si es `true`, el editor solo ofrece la sección a personas, nunca a la IA. */
  soloHumano?: boolean;
  ajustes: Record<A, MetaCampo>;
  bloques: Record<B, MetaBloque>;
};
