// Personalidad visual de la landing según el estilo de la semilla (`meta.semilla.estilo`). El render la marca en
// `data-estilo` y `globals.css` la pinta con variables de los tokens (sin hex). Los estilos sin personalidad propia
// conservan el aspecto base: lo que cambia entonces son los tokens y los fondos.

export type Personalidad = "brutal" | "ma" | "memphis" | "patente" | "base";

const POR_ESTILO: Record<string, Personalidad> = {
  "brutalismo tipográfico": "brutal",
  "constructivismo ruso": "brutal",
  "japonés ma (espacio negativo)": "ma",
  "minimalismo de museo": "ma",
  "Memphis contenido": "memphis",
  "cartel suizo de farmacia": "memphis",
  "catálogo técnico de patentes de los 50": "patente",
  "manual de instrucciones industrial": "patente",
};

export const personalidadDe = (estilo: string | undefined): Personalidad => (estilo && POR_ESTILO[estilo]) || "base";

/** Variables que la personalidad pisa sobre las de los tokens (grosor de borde, radio y aire vertical). */
export function variablesDePersonalidad(p: Personalidad, espacio: string): Record<string, string> {
  switch (p) {
    case "brutal":
      return { "--borde-ancho": "3px", "--radio": "0px" };
    case "ma":
      return { "--borde-ancho": "0px", "--espacio": `calc(${espacio} * 1.6)` };
    case "memphis":
      return { "--borde-ancho": "2px", "--radio": "999px" };
    case "patente":
      return { "--borde-ancho": "1px" };
    default:
      return {};
  }
}
