import type { Asset, Seccion, TipoSeccion } from "@/lib/contratos";
import { ejemplo as ej_heroe, assets as as_heroe } from "./heroe/ejemplo";
import { ejemplo as ej_cintaAnuncio } from "./cinta-anuncio/ejemplo";
import { ejemplo as ej_problemaSolucion, assets as as_problemaSolucion } from "./problema-solucion/ejemplo";
import { ejemplo as ej_beneficios } from "./beneficios/ejemplo";
import { ejemplo as ej_comoFunciona } from "./como-funciona/ejemplo";
import { ejemplo as ej_antesDespues, assets as as_antesDespues } from "./antes-despues/ejemplo";
import { ejemplo as ej_comparativa } from "./comparativa/ejemplo";
import { ejemplo as ej_galeria, assets as as_galeria } from "./galeria/ejemplo";
import { ejemplo as ej_video, assets as as_video } from "./video/ejemplo";
import { ejemplo as ej_testimonios } from "./testimonios/ejemplo";
import { ejemplo as ej_cifras } from "./cifras/ejemplo";
import { ejemplo as ej_oferta } from "./oferta/ejemplo";
import { ejemplo as ej_incluye, assets as as_incluye } from "./incluye/ejemplo";
import { ejemplo as ej_cuentaRegresiva } from "./cuenta-regresiva/ejemplo";
import { ejemplo as ej_faq } from "./faq/ejemplo";
import { ejemplo as ej_garantia } from "./garantia/ejemplo";
import { ejemplo as ej_formularioLead } from "./formulario-lead/ejemplo";
import { ejemplo as ej_htmlLibre } from "./html-libre/ejemplo";
import { ejemplo as ej_ParaQuien, assets as as_ParaQuien } from "./para-quien/ejemplo";
import { ejemplo as ej_Mecanismo, assets as as_Mecanismo } from "./mecanismo/ejemplo";
import { ejemplo as ej_Historia, assets as as_Historia } from "./historia/ejemplo";
import { ejemplo as ej_Resumen, assets as as_Resumen } from "./resumen/ejemplo";
import { ejemplo as ej_EscenaUso, assets as as_EscenaUso } from "./escena-uso/ejemplo";
import { ejemplo as ej_Agenda, assets as as_Agenda } from "./agenda/ejemplo";
import { ejemplo as ej_Ponentes, assets as as_Ponentes } from "./ponentes/ejemplo";
import { ejemplo as ej_LineaTiempo, assets as as_LineaTiempo } from "./linea-tiempo/ejemplo";
import { ejemplo as ej_Impacto, assets as as_Impacto } from "./impacto/ejemplo";
import { ejemplo as ej_creditos } from "./creditos/ejemplo";
import { ejemplo as ej_ctaFija } from "./cta-fija/ejemplo";
import { ejemplo as ej_datoCurioso, assets as as_datoCurioso } from "./dato-curioso/ejemplo";
import { ejemplo as ej_datoEnVivo } from "./dato-en-vivo/ejemplo";
import { ejemplo as ej_fichaTecnica } from "./ficha-tecnica/ejemplo";
import { ejemplo as ej_sellosConfianza } from "./sellos-confianza/ejemplo";

/** Sección de ejemplo de cada tipo: lo que inserta «Agregar sección» (con [COMPLETAR] donde falta un dato). */
export const EJEMPLO_POR_TIPO: Record<TipoSeccion, Seccion> = {
  heroe: ej_heroe,
  "cinta-anuncio": ej_cintaAnuncio,
  "problema-solucion": ej_problemaSolucion,
  beneficios: ej_beneficios,
  "como-funciona": ej_comoFunciona,
  "antes-despues": ej_antesDespues,
  comparativa: ej_comparativa,
  galeria: ej_galeria,
  video: ej_video,
  testimonios: ej_testimonios,
  cifras: ej_cifras,
  oferta: ej_oferta,
  incluye: ej_incluye,
  "cuenta-regresiva": ej_cuentaRegresiva,
  faq: ej_faq,
  garantia: ej_garantia,
  "formulario-lead": ej_formularioLead,
  "html-libre": ej_htmlLibre,
  "dato-en-vivo": ej_datoEnVivo,
  "dato-curioso": ej_datoCurioso,
  "ficha-tecnica": ej_fichaTecnica,
  "sellos-confianza": ej_sellosConfianza,
  "para-quien": ej_ParaQuien,
  "mecanismo": ej_Mecanismo,
  "historia": ej_Historia,
  "resumen": ej_Resumen,
  "escena-uso": ej_EscenaUso,
  "agenda": ej_Agenda,
  "ponentes": ej_Ponentes,
  "linea-tiempo": ej_LineaTiempo,
  "impacto": ej_Impacto,
  creditos: ej_creditos,
  "cta-fija": ej_ctaFija,
};

/** Slots (con su prompt de Grok) que usa el ejemplo de cada tipo. */
export const ASSETS_POR_TIPO: Partial<Record<TipoSeccion, Asset[]>> = {
  heroe: as_heroe,
  "problema-solucion": as_problemaSolucion,
  "antes-despues": as_antesDespues,
  galeria: as_galeria,
  video: as_video,
  incluye: as_incluye,
  "para-quien": as_ParaQuien,
  "mecanismo": as_Mecanismo,
  "historia": as_Historia,
  "resumen": as_Resumen,
  "escena-uso": as_EscenaUso,
  "agenda": as_Agenda,
  "ponentes": as_Ponentes,
  "linea-tiempo": as_LineaTiempo,
  "impacto": as_Impacto,
  "dato-curioso": as_datoCurioso,
};
