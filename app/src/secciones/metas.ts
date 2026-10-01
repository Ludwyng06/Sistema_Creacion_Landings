import type { TipoSeccion } from "@/lib/contratos";
import type { MetaSeccion } from "./meta";
import { meta as meta_heroe } from "./heroe/schema";
import { meta as meta_cintaAnuncio } from "./cinta-anuncio/schema";
import { meta as meta_problemaSolucion } from "./problema-solucion/schema";
import { meta as meta_beneficios } from "./beneficios/schema";
import { meta as meta_comoFunciona } from "./como-funciona/schema";
import { meta as meta_antesDespues } from "./antes-despues/schema";
import { meta as meta_comparativa } from "./comparativa/schema";
import { meta as meta_galeria } from "./galeria/schema";
import { meta as meta_video } from "./video/schema";
import { meta as meta_testimonios } from "./testimonios/schema";
import { meta as meta_cifras } from "./cifras/schema";
import { meta as meta_oferta } from "./oferta/schema";
import { meta as meta_incluye } from "./incluye/schema";
import { meta as meta_cuentaRegresiva } from "./cuenta-regresiva/schema";
import { meta as meta_faq } from "./faq/schema";
import { meta as meta_garantia } from "./garantia/schema";
import { meta as meta_formularioLead } from "./formulario-lead/schema";
import { meta as meta_htmlLibre } from "./html-libre/schema";
import { meta as metaParaQuien } from "./para-quien/schema";
import { meta as metaMecanismo } from "./mecanismo/schema";
import { meta as metaHistoria } from "./historia/schema";
import { meta as metaResumen } from "./resumen/schema";
import { meta as metaEscenaUso } from "./escena-uso/schema";
import { meta as metaAgenda } from "./agenda/schema";
import { meta as metaPonentes } from "./ponentes/schema";
import { meta as metaLineaTiempo } from "./linea-tiempo/schema";
import { meta as metaImpacto } from "./impacto/schema";
import { meta as meta_creditos } from "./creditos/schema";
import { meta as meta_ctaFija } from "./cta-fija/schema";
import { meta as meta_datoCurioso } from "./dato-curioso/schema";
import { meta as meta_datoEnVivo } from "./dato-en-vivo/schema";
import { meta as meta_fichaTecnica } from "./ficha-tecnica/schema";
import { meta as meta_sellosConfianza } from "./sellos-confianza/schema";

/** Metadatos del editor (etiqueta, control, valores por defecto) de cada tipo de sección. */
export const METAS: Record<TipoSeccion, MetaSeccion> = {
  heroe: meta_heroe as MetaSeccion,
  "cinta-anuncio": meta_cintaAnuncio as MetaSeccion,
  "problema-solucion": meta_problemaSolucion as MetaSeccion,
  beneficios: meta_beneficios as MetaSeccion,
  "como-funciona": meta_comoFunciona as MetaSeccion,
  "antes-despues": meta_antesDespues as MetaSeccion,
  comparativa: meta_comparativa as MetaSeccion,
  galeria: meta_galeria as MetaSeccion,
  video: meta_video as MetaSeccion,
  testimonios: meta_testimonios as MetaSeccion,
  cifras: meta_cifras as MetaSeccion,
  oferta: meta_oferta as MetaSeccion,
  incluye: meta_incluye as MetaSeccion,
  "cuenta-regresiva": meta_cuentaRegresiva as MetaSeccion,
  faq: meta_faq as MetaSeccion,
  garantia: meta_garantia as MetaSeccion,
  "formulario-lead": meta_formularioLead as MetaSeccion,
  "html-libre": meta_htmlLibre as MetaSeccion,
  "dato-en-vivo": meta_datoEnVivo as MetaSeccion,
  "dato-curioso": meta_datoCurioso as MetaSeccion,
  "ficha-tecnica": meta_fichaTecnica as MetaSeccion,
  "sellos-confianza": meta_sellosConfianza as MetaSeccion,
  "para-quien": metaParaQuien as MetaSeccion,
  "mecanismo": metaMecanismo as MetaSeccion,
  "historia": metaHistoria as MetaSeccion,
  "resumen": metaResumen as MetaSeccion,
  "escena-uso": metaEscenaUso as MetaSeccion,
  "agenda": metaAgenda as MetaSeccion,
  "ponentes": metaPonentes as MetaSeccion,
  "linea-tiempo": metaLineaTiempo as MetaSeccion,
  "impacto": metaImpacto as MetaSeccion,
  creditos: meta_creditos as MetaSeccion,
  "cta-fija": meta_ctaFija as MetaSeccion,
};
