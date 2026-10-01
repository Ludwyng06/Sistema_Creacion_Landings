/* eslint-disable @typescript-eslint/no-explicit-any -- normaliza JSON de una API externa cuya forma no controlamos; se valida campo a campo */
import { pedirJson } from "./http";
import type { Fuente, OpcionesFuente } from "./tipos";

// Open Food Facts y Open Beauty Facts: misma API, distinto dominio. Sin clave. Datos ODbL; fotos CC BY-SA con crédito a los colaboradores.

export interface ConsultaOpenFacts {
  q: string;
  max?: number;
}

export interface ProductoOpenFacts {
  codigo: string;
  nombre: string;
  marca: string | null;
  /** Ingredientes tal como los declara el envase (INCI en cosméticos). Vacío si nadie los cargó. */
  ingredientes: string;
  /** Por 100 g, solo lo que la ficha trae. */
  nutricion: Partial<Record<"energiaKcal" | "proteinas" | "grasas" | "carbohidratos" | "azucares" | "sal", number>>;
  imagen: string | null;
  miniatura: string | null;
  urlOrigen: string;
  credito: string;
}

const CAMPOS = ["code", "product_name", "brands", "ingredients_text", "ingredients_text_es", "nutriments", "image_front_url", "image_front_small_url"].join(",");

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function normalizarOpenFacts(json: unknown, dominio: string, creditoBase: string): ProductoOpenFacts[] {
  const productos = ((json as { products?: Record<string, any>[] })?.products ?? []) as Record<string, any>[];
  const salida: ProductoOpenFacts[] = [];
  for (const p of productos) {
    const codigo = String(p.code ?? "").trim();
    const nombre = String(p.product_name ?? "").trim();
    if (!codigo || !nombre) continue;
    const n = (p.nutriments ?? {}) as Record<string, unknown>;
    const nutricion: ProductoOpenFacts["nutricion"] = {};
    const asigna = (k: keyof ProductoOpenFacts["nutricion"], v: unknown) => {
      const x = num(v);
      if (x !== undefined) nutricion[k] = x;
    };
    asigna("energiaKcal", n["energy-kcal_100g"]);
    asigna("proteinas", n.proteins_100g);
    asigna("grasas", n.fat_100g);
    asigna("carbohidratos", n.carbohydrates_100g);
    asigna("azucares", n.sugars_100g);
    asigna("sal", n.salt_100g);
    salida.push({
      codigo,
      nombre,
      marca: typeof p.brands === "string" && p.brands.trim() ? p.brands.trim() : null,
      ingredientes: String(p.ingredients_text_es ?? p.ingredients_text ?? "").trim(),
      nutricion,
      imagen: typeof p.image_front_url === "string" ? p.image_front_url : null,
      miniatura: typeof p.image_front_small_url === "string" ? p.image_front_small_url : null,
      urlOrigen: `https://${dominio}/product/${codigo}`,
      credito: creditoBase,
    });
  }
  return salida;
}

function crear(id: "open-food-facts" | "open-beauty-facts", dominio: string, credito: string, op: OpcionesFuente): Fuente<ConsultaOpenFacts, ProductoOpenFacts[]> {
  return {
    id,
    ttl: 7 * 24 * 3600,
    habilitada: () => true,
    async consultar(q, señal) {
      const url = `https://${dominio}/cgi/search.pl?${new URLSearchParams({ search_terms: q.q, search_simple: "1", action: "process", json: "1", page_size: String(q.max ?? 10), fields: CAMPOS })}`;
      return normalizarOpenFacts(await pedirJson({ fuente: id, url, señal }, op), dominio, credito).slice(0, q.max ?? 10);
    },
    credito: (item) => (item as ProductoOpenFacts).credito,
  };
}

export const crearOpenFoodFacts = (op: OpcionesFuente = {}) => crear("open-food-facts", "world.openfoodfacts.org", "Open Food Facts (colaboradores) · CC BY-SA", op);
export const crearOpenBeautyFacts = (op: OpcionesFuente = {}) => crear("open-beauty-facts", "world.openbeautyfacts.org", "Open Beauty Facts (colaboradores) · CC BY-SA", op);
