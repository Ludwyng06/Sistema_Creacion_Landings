import "./esquemas";
import type { ComponentType } from "react";
import type { Seccion, Tokens, TipoSeccion } from "@/lib/contratos";
import { Componente as ComponenteHeroe } from "./heroe/Componente";
import { Componente as ComponenteCintaAnuncio } from "./cinta-anuncio/Componente";
import { Componente as ComponenteProblemaSolucion } from "./problema-solucion/Componente";
import { Componente as ComponenteBeneficios } from "./beneficios/Componente";
import { Componente as ComponenteComoFunciona } from "./como-funciona/Componente";
import { Componente as ComponenteAntesDespues } from "./antes-despues/Componente";
import { Componente as ComponenteComparativa } from "./comparativa/Componente";
import { Componente as ComponenteGaleria } from "./galeria/Componente";
import { Componente as ComponenteVideo } from "./video/Componente";
import { Componente as ComponenteTestimonios } from "./testimonios/Componente";
import { Componente as ComponenteCifras } from "./cifras/Componente";
import { Componente as ComponenteOferta } from "./oferta/Componente";
import { Componente as ComponenteIncluye } from "./incluye/Componente";
import { Componente as ComponenteCuentaRegresiva } from "./cuenta-regresiva/Componente";
import { Componente as ComponenteFaq } from "./faq/Componente";
import { Componente as ComponenteGarantia } from "./garantia/Componente";
import { Componente as ComponenteFormulario } from "./formulario-lead/Componente";
import { Componente as ComponenteHtmlLibre } from "./html-libre/Componente";
import { Componente as ComponenteParaQuien } from "./para-quien/Componente";
import { Componente as ComponenteMecanismo } from "./mecanismo/Componente";
import { Componente as ComponenteHistoria } from "./historia/Componente";
import { Componente as ComponenteResumen } from "./resumen/Componente";
import { Componente as ComponenteEscenaUso } from "./escena-uso/Componente";
import { Componente as ComponenteAgenda } from "./agenda/Componente";
import { Componente as ComponentePonentes } from "./ponentes/Componente";
import { Componente as ComponenteLineaTiempo } from "./linea-tiempo/Componente";
import { Componente as ComponenteImpacto } from "./impacto/Componente";
import { Componente as ComponenteCreditos } from "./creditos/Componente";
import { Componente as ComponenteCtaFija } from "./cta-fija/Componente";
import { Componente as ComponenteDatoCurioso } from "./dato-curioso/Componente";
import { Componente as ComponenteDatoEnVivo } from "./dato-en-vivo/Componente";
import { Componente as ComponenteFichaTecnica } from "./ficha-tecnica/Componente";
import { Componente as ComponenteSellosConfianza } from "./sellos-confianza/Componente";

type ComponenteSeccion = ComponentType<{ seccion: Seccion; tokens: Tokens }>;

/** Igual que `componentes.ts`, sin carga diferida (para los tests). */
export const componentesSeccion: Partial<Record<TipoSeccion, ComponenteSeccion>> = {
  heroe: ComponenteHeroe,
  "cinta-anuncio": ComponenteCintaAnuncio,
  "problema-solucion": ComponenteProblemaSolucion,
  beneficios: ComponenteBeneficios,
  "como-funciona": ComponenteComoFunciona,
  "antes-despues": ComponenteAntesDespues,
  comparativa: ComponenteComparativa,
  galeria: ComponenteGaleria,
  video: ComponenteVideo,
  testimonios: ComponenteTestimonios,
  cifras: ComponenteCifras,
  oferta: ComponenteOferta,
  incluye: ComponenteIncluye,
  "cuenta-regresiva": ComponenteCuentaRegresiva,
  faq: ComponenteFaq,
  garantia: ComponenteGarantia,
  "formulario-lead": ComponenteFormulario,
  "html-libre": ComponenteHtmlLibre,
  "dato-en-vivo": ComponenteDatoEnVivo,
  "dato-curioso": ComponenteDatoCurioso,
  "ficha-tecnica": ComponenteFichaTecnica,
  "sellos-confianza": ComponenteSellosConfianza,
  "para-quien": ComponenteParaQuien,
  "mecanismo": ComponenteMecanismo,
  "historia": ComponenteHistoria,
  "resumen": ComponenteResumen,
  "escena-uso": ComponenteEscenaUso,
  "agenda": ComponenteAgenda,
  "ponentes": ComponentePonentes,
  "linea-tiempo": ComponenteLineaTiempo,
  "impacto": ComponenteImpacto,
  creditos: ComponenteCreditos,
  "cta-fija": ComponenteCtaFija,
};
