import type { EfectoId, LandingDoc, Seccion, Tokens } from "@/lib/contratos";
import { ejemplos as ejemplosBeneficios } from "@/secciones/beneficios/ejemplo";
import { ejemplo as ejemploCintaAnuncio } from "@/secciones/cinta-anuncio/ejemplo";
import { ejemplo as ejemploFaq } from "@/secciones/faq/ejemplo";
import { ejemplo as ejemploFormulario } from "@/secciones/formulario-lead/ejemplo";
import { ejemplos as ejemplosGaleria } from "@/secciones/galeria/ejemplo";
import { ejemplos as ejemplosHeroe } from "@/secciones/heroe/ejemplo";
import { ejemplo as ejemploIncluye } from "@/secciones/incluye/ejemplo";
import { ejemplo as ejemploOferta } from "@/secciones/oferta/ejemplo";
import { ASSETS_EJEMPLO, TOKENS_BAUHAUS, armarDoc } from "../secciones/documentos";

// Un demo por efecto de nivel 1 y 2, cada uno en su sección de ejemplo (docs/08 §3).

export type Demo = {
  efecto: EfectoId;
  titulo: string;
  nivel: 1 | 2 | 3;
  que: string;
  reducido: string;
  doc: LandingDoc;
  /** Nota que explica un valor de demostración o una condición. */
  nota?: string;
};

const TOKENS: Tokens = { ...TOKENS_BAUHAUS, intensidad: 2 };

function con(seccion: Seccion, ...efectos: EfectoId[]): Seccion {
  return { ...seccion, efectos };
}

function doc(slug: string, secciones: Seccion[], tokens: Tokens = TOKENS): LandingDoc {
  return armarDoc(`efecto-${slug}`, `Demo ${slug}`, tokens, secciones, ASSETS_EJEMPLO);
}

// Valores de demostración solo para ver caer el precio; no van en ninguna landing.
const OFERTA_DEMO: Seccion = {
  ...ejemploOferta,
  ajustes: { ...ejemploOferta.ajustes, precio: 100, precioAnterior: 200, moneda: "USD" },
  bloques: [],
};
const OFERTA_DEMO_CON_OPCION: Seccion = {
  ...OFERTA_DEMO,
  bloques: [{ id: "opc-demo", tipo: "opcion-cantidad", ajustes: { unidades: 1, precio: 100, etiqueta: "Más elegido" } }],
};

const ORIGINAL_PROBLEMA = ejemplosHeroe["problema-primero"];

export const DEMOS: Demo[] = [
  {
    efecto: "revelar-suave",
    titulo: "revelar-suave",
    nivel: 1,
    que: "Cada sección sube y aparece al entrar en pantalla.",
    reducido: "Las secciones se ven completas desde el principio.",
    doc: doc("revelar-suave", [
      con(ejemplosBeneficios["lista-grande"], "revelar-suave"),
      con(ejemplosBeneficios.numerada, "revelar-suave"),
      con(ejemploFaq, "revelar-suave"),
    ]),
  },
  {
    efecto: "grano",
    titulo: "grano",
    nivel: 1,
    que: "Grano de película al 5 % de opacidad sobre toda la landing (global).",
    reducido: "El grano queda quieto.",
    doc: doc("grano", [con(ejemplosHeroe["producto-monumental"], "grano"), ejemploFaq]),
  },
  {
    efecto: "precio-cae",
    titulo: "precio-cae",
    nivel: 1,
    que: "El precio cae desde el precio anterior hasta el actual al entrar en pantalla.",
    reducido: "Muestra el precio final, sin animación.",
    nota: "Los precios 100 y 200 USD son valores de demostración de la animación; no van en landings.",
    doc: doc("precio-cae", [con(OFERTA_DEMO_CON_OPCION, "precio-cae")]),
  },
  {
    efecto: "titular-cinetico",
    titulo: "titular-cinetico",
    nivel: 2,
    que: "El titular se arma letra a letra.",
    reducido: "El titular es texto plano, completo y legible.",
    doc: doc("titular-cinetico", [con(ORIGINAL_PROBLEMA, "titular-cinetico")]),
  },
  {
    efecto: "mascara-circular",
    titulo: "mascara-circular",
    nivel: 2,
    que: "Las imágenes aparecen dentro de un círculo que crece (clip-path).",
    reducido: "Las imágenes se ven completas.",
    doc: doc("mascara-circular", [con(ejemplosGaleria.mosaico, "mascara-circular")]),
  },
  {
    efecto: "mascara-persiana",
    titulo: "mascara-persiana",
    nivel: 2,
    que: "La imagen se descubre como una persiana, franja por franja (transform).",
    reducido: "La imagen se ve completa.",
    doc: doc("mascara-persiana", [con(ejemploIncluye, "mascara-persiana")]),
  },
  {
    efecto: "marquee-reactivo",
    titulo: "marquee-reactivo",
    nivel: 2,
    que: "La cinta acelera y cambia de dirección con el scroll (baja y sube la página).",
    reducido: "Los textos quedan quietos y legibles, en varias líneas.",
    doc: doc("marquee-reactivo", [con(ejemploCintaAnuncio, "marquee-reactivo"), ejemploFaq]),
  },
  {
    efecto: "boton-magnetico",
    titulo: "boton-magnetico",
    nivel: 2,
    que: "El botón se acerca al puntero (solo con puntero fino).",
    reducido: "El botón no se mueve.",
    doc: doc("boton-magnetico", [con(ejemplosHeroe["problema-primero"], "boton-magnetico"), con(ejemploFormulario, "boton-magnetico")]),
  },
  {
    efecto: "cursor-vivo",
    titulo: "cursor-vivo",
    nivel: 2,
    que: "Un anillo sigue al puntero y dice «Ver», «Ir» o «Enviar» según lo que toca (solo con puntero fino, global).",
    reducido: "No se pinta: queda el cursor normal.",
    doc: doc("cursor-vivo", [con(ejemplosGaleria.mosaico, "cursor-vivo"), ejemploFormulario]),
  },
  {
    efecto: "titular-cinetico",
    titulo: "Filtro por intensidad: titular-cinetico con intensidad 1",
    nivel: 2,
    que: "Un efecto de nivel 2 en una landing sobria (intensidad 1) se ignora en silencio.",
    reducido: "Igual: el titular es texto plano.",
    nota: "Compara con el demo de titular-cinetico: aquí no hay ningún efecto aplicado.",
    doc: doc("filtro-intensidad", [con(ORIGINAL_PROBLEMA, "titular-cinetico")], { ...TOKENS, intensidad: 1 }),
  },
  {
    efecto: "precio-cae",
    titulo: "Filtro por sección: precio-cae en un héroe",
    nivel: 1,
    que: "precio-cae solo aplica a oferta; en un héroe se ignora en silencio.",
    reducido: "Igual: sin efecto.",
    doc: doc("filtro-seccion", [con(ejemplosHeroe["producto-monumental"], "precio-cae")]),
  },
];
