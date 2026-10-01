import type { Asset, Seccion, TipoSeccion } from "@/lib/contratos";
import { ejemplo as antesDespues, assets as assetsAntesDespues } from "@/secciones/antes-despues/ejemplo";
import { ejemplos as beneficios } from "@/secciones/beneficios/ejemplo";
import { ejemplo as cifras } from "@/secciones/cifras/ejemplo";
import { ejemplo as cintaAnuncio } from "@/secciones/cinta-anuncio/ejemplo";
import { ejemplos as comoFunciona } from "@/secciones/como-funciona/ejemplo";
import { ejemplos as comparativa } from "@/secciones/comparativa/ejemplo";
import { ejemplo as cuentaRegresiva } from "@/secciones/cuenta-regresiva/ejemplo";
import { ejemplo as faq } from "@/secciones/faq/ejemplo";
import { ejemplo as formulario } from "@/secciones/formulario-lead/ejemplo";
import { ejemplos as galeria, assets as assetsGaleria } from "@/secciones/galeria/ejemplo";
import { ejemplo as garantia } from "@/secciones/garantia/ejemplo";
import { ejemplos as heroe, assets as assetsHeroe } from "@/secciones/heroe/ejemplo";
import { ejemplo as htmlLibre } from "@/secciones/html-libre/ejemplo";
import { ejemplo as incluye, assets as assetsIncluye } from "@/secciones/incluye/ejemplo";
import { ejemplo as oferta } from "@/secciones/oferta/ejemplo";
import { ejemplo as problemaSolucion, assets as assetsProblema } from "@/secciones/problema-solucion/ejemplo";
import { ejemplos as testimonios } from "@/secciones/testimonios/ejemplo";
import { ejemplo as video, assets as assetsVideo } from "@/secciones/video/ejemplo";
import { ejemplos as paraQuien, assets as assetsParaQuien } from "@/secciones/para-quien/ejemplo";
import { ejemplos as mecanismo, assets as assetsMecanismo } from "@/secciones/mecanismo/ejemplo";
import { ejemplos as historia, assets as assetsHistoria } from "@/secciones/historia/ejemplo";
import { ejemplos as resumen, assets as assetsResumen } from "@/secciones/resumen/ejemplo";
import { ejemplos as escenaUso, assets as assetsEscenaUso } from "@/secciones/escena-uso/ejemplo";
import { ASSETS_DE_VARIANTES_CON_IMAGEN, VARIANTES_CON_IMAGEN } from "@/secciones/ejemplos-imagen";
import { ejemplos as agenda, assets as assetsAgenda } from "@/secciones/agenda/ejemplo";
import { ejemplos as ponentes, assets as assetsPonentes } from "@/secciones/ponentes/ejemplo";
import { ejemplos as lineaTiempo, assets as assetsLineaTiempo } from "@/secciones/linea-tiempo/ejemplo";
import { ejemplos as impacto, assets as assetsImpacto } from "@/secciones/impacto/ejemplo";
import { ejemplos as creditos } from "@/secciones/creditos/ejemplo";
import { ejemplos as ctaFija } from "@/secciones/cta-fija/ejemplo";
import { ejemplos as datoCurioso, assets as assetsDatoCurioso } from "@/secciones/dato-curioso/ejemplo";
import { ejemplos as datoEnVivo } from "@/secciones/dato-en-vivo/ejemplo";
import { ejemplos as fichaTecnica } from "@/secciones/ficha-tecnica/ejemplo";
import { ejemplos as sellosConfianza } from "@/secciones/sellos-confianza/ejemplo";

export type EjemploCatalogo = { tipo: TipoSeccion; nombre: string; seccion: Seccion };

function variantes(tipo: TipoSeccion, mapa: Record<string, Seccion>): EjemploCatalogo[] {
  return Object.entries(mapa).map(([nombre, seccion]) => ({ tipo, nombre, seccion }));
}

/** Todos los ejemplo.ts de las 24 secciones, con cada variante y disposición. */
export const EJEMPLOS: EjemploCatalogo[] = [
  ...variantes("heroe", heroe),
  { tipo: "cinta-anuncio", nombre: "cinta-anuncio", seccion: cintaAnuncio },
  { tipo: "problema-solucion", nombre: "problema-solucion", seccion: problemaSolucion },
  ...variantes("beneficios", beneficios),
  ...variantes("como-funciona", comoFunciona),
  { tipo: "antes-despues", nombre: "antes-despues", seccion: antesDespues },
  ...variantes("comparativa", comparativa),
  ...variantes("galeria", galeria),
  { tipo: "video", nombre: "video", seccion: video },
  ...variantes("testimonios", testimonios),
  { tipo: "cifras", nombre: "cifras", seccion: cifras },
  { tipo: "oferta", nombre: "oferta", seccion: oferta },
  { tipo: "incluye", nombre: "incluye", seccion: incluye },
  { tipo: "cuenta-regresiva", nombre: "cuenta-regresiva", seccion: cuentaRegresiva },
  { tipo: "faq", nombre: "faq", seccion: faq },
  { tipo: "garantia", nombre: "garantia", seccion: garantia },
  { tipo: "formulario-lead", nombre: "formulario-lead", seccion: formulario },
  { tipo: "html-libre", nombre: "html-libre", seccion: htmlLibre },
  ...variantes("dato-en-vivo", datoEnVivo),
  ...variantes("dato-curioso", datoCurioso),
  ...variantes("ficha-tecnica", fichaTecnica),
  ...variantes("sellos-confianza", sellosConfianza),
  ...variantes("para-quien", paraQuien),
  ...variantes("mecanismo", mecanismo),
  ...variantes("historia", historia),
  ...variantes("resumen", resumen),
  ...variantes("escena-uso", escenaUso),
  ...variantes("agenda", agenda),
  ...variantes("ponentes", ponentes),
  ...variantes("linea-tiempo", lineaTiempo),
  ...variantes("impacto", impacto),
  ...variantes("creditos", creditos),
  ...Object.entries(VARIANTES_CON_IMAGEN).flatMap(([tipo, mapa]) => variantes(tipo as TipoSeccion, mapa as Record<string, Seccion>)),
  ...variantes("cta-fija", ctaFija),
];

export const ASSETS_DE_EJEMPLOS: Asset[] = [
  ...assetsHeroe,
  ...assetsProblema,
  ...assetsAntesDespues,
  ...assetsGaleria,
  ...assetsVideo,
  ...assetsIncluye,
  ...assetsDatoCurioso,
  ...ASSETS_DE_VARIANTES_CON_IMAGEN,
  ...assetsParaQuien,
  ...assetsMecanismo,
  ...assetsHistoria,
  ...assetsResumen,
  ...assetsEscenaUso,
];

/** Recorre un valor y devuelve cada string con su ruta (`a.b[0].c`). */
export function textos(valor: unknown, ruta = ""): { ruta: string; texto: string }[] {
  if (typeof valor === "string") return [{ ruta, texto: valor }];
  if (Array.isArray(valor)) return valor.flatMap((v, i) => textos(v, `${ruta}[${i}]`));
  if (valor && typeof valor === "object") {
    return Object.entries(valor).flatMap(([k, v]) => textos(v, ruta ? `${ruta}.${k}` : k));
  }
  return [];
}

/** Recorre un valor y devuelve cada número con su ruta. */
export function numeros(valor: unknown, ruta = ""): { ruta: string; numero: number }[] {
  if (typeof valor === "number") return [{ ruta, numero: valor }];
  if (Array.isArray(valor)) return valor.flatMap((v, i) => numeros(v, `${ruta}[${i}]`));
  if (valor && typeof valor === "object") {
    return Object.entries(valor).flatMap(([k, v]) => numeros(v, ruta ? `${ruta}.${k}` : k));
  }
  return [];
}
