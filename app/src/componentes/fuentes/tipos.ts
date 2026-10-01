import type { CategoriaFuente } from "@/lib/fuentes/catalogo";

// El catálogo (`src/datos/fuentes.json`) y sus tipos son de la 10-A (`@/lib/fuentes/catalogo`); aquí solo lo que pone la interfaz.
export type { CategoriaFuente, EntradaFuente as FuenteCatalogo } from "@/lib/fuentes/catalogo";

export const NOMBRE_CATEGORIA: Record<CategoriaFuente, string> = {
  "sans-serif": "Sans serif",
  serif: "Serif",
  display: "Display",
  handwriting: "Manuscrita",
  monospace: "Monoespaciada",
};
