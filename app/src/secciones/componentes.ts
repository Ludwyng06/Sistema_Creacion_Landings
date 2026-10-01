import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { Seccion, Tokens, TipoSeccion } from "@/lib/contratos";

// Componentes de las secciones con carga por tipo: una landing descarga solo el código de las secciones que usa
// (y no el de las otras 17). `componentes-sync.ts` es la misma tabla con importación directa; los tests la usan
// (alias en `vitest.config.mts`) para renderizar sin esperar.

type ComponenteSeccion = ComponentType<{ seccion: Seccion; tokens: Tokens }>;

export const componentesSeccion: Partial<Record<TipoSeccion, ComponenteSeccion>> = {
  heroe: dynamic(() => import("./heroe/Componente").then((m) => m.Componente)),
  "cinta-anuncio": dynamic(() => import("./cinta-anuncio/Componente").then((m) => m.Componente)),
  "problema-solucion": dynamic(() => import("./problema-solucion/Componente").then((m) => m.Componente)),
  beneficios: dynamic(() => import("./beneficios/Componente").then((m) => m.Componente)),
  "como-funciona": dynamic(() => import("./como-funciona/Componente").then((m) => m.Componente)),
  "antes-despues": dynamic(() => import("./antes-despues/Componente").then((m) => m.Componente)),
  comparativa: dynamic(() => import("./comparativa/Componente").then((m) => m.Componente)),
  galeria: dynamic(() => import("./galeria/Componente").then((m) => m.Componente)),
  video: dynamic(() => import("./video/Componente").then((m) => m.Componente)),
  testimonios: dynamic(() => import("./testimonios/Componente").then((m) => m.Componente)),
  cifras: dynamic(() => import("./cifras/Componente").then((m) => m.Componente)),
  oferta: dynamic(() => import("./oferta/Componente").then((m) => m.Componente)),
  incluye: dynamic(() => import("./incluye/Componente").then((m) => m.Componente)),
  "cuenta-regresiva": dynamic(() => import("./cuenta-regresiva/Componente").then((m) => m.Componente)),
  faq: dynamic(() => import("./faq/Componente").then((m) => m.Componente)),
  garantia: dynamic(() => import("./garantia/Componente").then((m) => m.Componente)),
  "formulario-lead": dynamic(() => import("./formulario-lead/Componente").then((m) => m.Componente)),
  "html-libre": dynamic(() => import("./html-libre/Componente").then((m) => m.Componente)),
  "dato-en-vivo": dynamic(() => import("./dato-en-vivo/Componente").then((m) => m.Componente)),
  "dato-curioso": dynamic(() => import("./dato-curioso/Componente").then((m) => m.Componente)),
  "ficha-tecnica": dynamic(() => import("./ficha-tecnica/Componente").then((m) => m.Componente)),
  "sellos-confianza": dynamic(() => import("./sellos-confianza/Componente").then((m) => m.Componente)),
  "para-quien": dynamic(() => import("./para-quien/Componente").then((m) => m.Componente)),
  "mecanismo": dynamic(() => import("./mecanismo/Componente").then((m) => m.Componente)),
  "historia": dynamic(() => import("./historia/Componente").then((m) => m.Componente)),
  "resumen": dynamic(() => import("./resumen/Componente").then((m) => m.Componente)),
  "escena-uso": dynamic(() => import("./escena-uso/Componente").then((m) => m.Componente)),
  "agenda": dynamic(() => import("./agenda/Componente").then((m) => m.Componente)),
  "ponentes": dynamic(() => import("./ponentes/Componente").then((m) => m.Componente)),
  "linea-tiempo": dynamic(() => import("./linea-tiempo/Componente").then((m) => m.Componente)),
  "impacto": dynamic(() => import("./impacto/Componente").then((m) => m.Componente)),
  creditos: dynamic(() => import("./creditos/Componente").then((m) => m.Componente)),
  "cta-fija": dynamic(() => import("./cta-fija/Componente").then((m) => m.Componente)),
};
