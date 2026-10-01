import "./esquemas";
import type { RegistroSecciones } from "@/lib/contratos";
import { componentesSeccion } from "@/secciones/componentes";
import { schema as schemaHeroe } from "./heroe/schema";
import { schema as schemaCintaAnuncio } from "./cinta-anuncio/schema";
import { schema as schemaProblemaSolucion } from "./problema-solucion/schema";
import { schema as schemaBeneficios } from "./beneficios/schema";
import { schema as schemaComoFunciona } from "./como-funciona/schema";
import { schema as schemaAntesDespues } from "./antes-despues/schema";
import { schema as schemaComparativa } from "./comparativa/schema";
import { schema as schemaGaleria } from "./galeria/schema";
import { schema as schemaVideo } from "./video/schema";
import { schema as schemaTestimonios } from "./testimonios/schema";
import { schema as schemaCifras } from "./cifras/schema";
import { schema as schemaOferta } from "./oferta/schema";
import { schema as schemaIncluye } from "./incluye/schema";
import { schema as schemaCuentaRegresiva } from "./cuenta-regresiva/schema";
import { schema as schemaFaq } from "./faq/schema";
import { schema as schemaGarantia } from "./garantia/schema";
import { schema as schemaFormulario } from "./formulario-lead/schema";
import { schema as schemaHtmlLibre } from "./html-libre/schema";
import { schema as schemaParaQuien } from "./para-quien/schema";
import { schema as schemaMecanismo } from "./mecanismo/schema";
import { schema as schemaHistoria } from "./historia/schema";
import { schema as schemaResumen } from "./resumen/schema";
import { schema as schemaEscenaUso } from "./escena-uso/schema";
import { schema as schemaAgenda } from "./agenda/schema";
import { schema as schemaPonentes } from "./ponentes/schema";
import { schema as schemaLineaTiempo } from "./linea-tiempo/schema";
import { schema as schemaImpacto } from "./impacto/schema";
import { schema as schemaCreditos } from "./creditos/schema";
import { schema as schemaCtaFija } from "./cta-fija/schema";
import { schema as schemaDatoCurioso } from "./dato-curioso/schema";
import { schema as schemaDatoEnVivo } from "./dato-en-vivo/schema";
import { schema as schemaFichaTecnica } from "./ficha-tecnica/schema";
import { schema as schemaSellosConfianza } from "./sellos-confianza/schema";

// Los `Componente` son los de `componentes.ts` (carga por tipo): importar el registro no trae el código de las 18 secciones.
export const registro: RegistroSecciones = {
  heroe: {
    schema: schemaHeroe,
    Componente: componentesSeccion["heroe"]!,
    etiqueta: "Héroe",
    icono: "estrella",
    maxPorLanding: 1,
  },
  "cinta-anuncio": {
    schema: schemaCintaAnuncio,
    Componente: componentesSeccion["cinta-anuncio"]!,
    etiqueta: "Cinta de anuncio",
    icono: "rayo",
    maxPorLanding: 2,
  },
  "problema-solucion": {
    schema: schemaProblemaSolucion,
    Componente: componentesSeccion["problema-solucion"]!,
    etiqueta: "Problema y solución",
    icono: "corazon",
    maxPorLanding: 1,
  },
  beneficios: {
    schema: schemaBeneficios,
    Componente: componentesSeccion["beneficios"]!,
    etiqueta: "Beneficios",
    icono: "check",
    maxPorLanding: 1,
  },
  "como-funciona": {
    schema: schemaComoFunciona,
    Componente: componentesSeccion["como-funciona"]!,
    etiqueta: "Cómo funciona",
    icono: "reloj",
    maxPorLanding: 1,
  },
  "antes-despues": {
    schema: schemaAntesDespues,
    Componente: componentesSeccion["antes-despues"]!,
    etiqueta: "Antes y después",
    icono: "espalda",
    maxPorLanding: 1,
  },
  comparativa: {
    schema: schemaComparativa,
    Componente: componentesSeccion["comparativa"]!,
    etiqueta: "Comparativa",
    icono: "cerrar",
    maxPorLanding: 1,
  },
  galeria: {
    schema: schemaGaleria,
    Componente: componentesSeccion["galeria"]!,
    etiqueta: "Galería",
    icono: "estrella",
    maxPorLanding: 2,
  },
  video: {
    schema: schemaVideo,
    Componente: componentesSeccion["video"]!,
    etiqueta: "Video",
    icono: "play",
    maxPorLanding: 2,
  },
  testimonios: {
    schema: schemaTestimonios,
    Componente: componentesSeccion["testimonios"]!,
    etiqueta: "Testimonios",
    icono: "corazon",
    maxPorLanding: 1,
  },
  cifras: {
    schema: schemaCifras,
    Componente: componentesSeccion["cifras"]!,
    etiqueta: "Cifras",
    icono: "rayo",
    maxPorLanding: 1,
  },
  oferta: {
    schema: schemaOferta,
    Componente: componentesSeccion["oferta"]!,
    etiqueta: "Oferta",
    icono: "envio",
    maxPorLanding: 1,
  },
  incluye: {
    schema: schemaIncluye,
    Componente: componentesSeccion["incluye"]!,
    etiqueta: "Qué incluye",
    icono: "check",
    maxPorLanding: 1,
  },
  "cuenta-regresiva": {
    schema: schemaCuentaRegresiva,
    Componente: componentesSeccion["cuenta-regresiva"]!,
    etiqueta: "Cuenta regresiva",
    icono: "reloj",
    maxPorLanding: 1,
  },
  faq: {
    schema: schemaFaq,
    Componente: componentesSeccion["faq"]!,
    etiqueta: "Preguntas frecuentes",
    icono: "mas",
    maxPorLanding: 1,
  },
  garantia: {
    schema: schemaGarantia,
    Componente: componentesSeccion["garantia"]!,
    etiqueta: "Garantía",
    icono: "escudo",
    maxPorLanding: 1,
  },
  "formulario-lead": {
    schema: schemaFormulario,
    Componente: componentesSeccion["formulario-lead"]!,
    etiqueta: "Formulario de contacto",
    icono: "envio",
    maxPorLanding: 1,
  },
  "html-libre": {
    schema: schemaHtmlLibre,
    Componente: componentesSeccion["html-libre"]!,
    etiqueta: "HTML libre",
    icono: "candado",
    maxPorLanding: 3,
  },
  "dato-en-vivo": {
    schema: schemaDatoEnVivo,
    Componente: componentesSeccion["dato-en-vivo"]!,
    etiqueta: "Dato en vivo",
    icono: "rayo",
    maxPorLanding: 2,
  },
  "dato-curioso": {
    schema: schemaDatoCurioso,
    Componente: componentesSeccion["dato-curioso"]!,
    etiqueta: "Dato curioso",
    icono: "estrella",
    maxPorLanding: 2,
  },
  "ficha-tecnica": {
    schema: schemaFichaTecnica,
    Componente: componentesSeccion["ficha-tecnica"]!,
    etiqueta: "Ficha técnica",
    icono: "check",
    maxPorLanding: 1,
  },
  "sellos-confianza": {
    schema: schemaSellosConfianza,
    Componente: componentesSeccion["sellos-confianza"]!,
    etiqueta: "Sellos de confianza",
    icono: "escudo",
    maxPorLanding: 1,
  },
  "para-quien": {
    schema: schemaParaQuien,
    Componente: componentesSeccion["para-quien"]!,
    etiqueta: "Para quién es",
    icono: "check",
    maxPorLanding: 1,
  },
  "mecanismo": {
    schema: schemaMecanismo,
    Componente: componentesSeccion["mecanismo"]!,
    etiqueta: "Mecanismo",
    icono: "rayo",
    maxPorLanding: 1,
  },
  "historia": {
    schema: schemaHistoria,
    Componente: componentesSeccion["historia"]!,
    etiqueta: "Historia",
    icono: "corazon",
    maxPorLanding: 1,
  },
  "resumen": {
    schema: schemaResumen,
    Componente: componentesSeccion["resumen"]!,
    etiqueta: "Resumen",
    icono: "check",
    maxPorLanding: 1,
  },
  "escena-uso": {
    schema: schemaEscenaUso,
    Componente: componentesSeccion["escena-uso"]!,
    etiqueta: "Escena de uso",
    icono: "estrella",
    maxPorLanding: 2,
  },
  "agenda": {
    schema: schemaAgenda,
    Componente: componentesSeccion["agenda"]!,
    etiqueta: "Agenda",
    icono: "reloj",
    maxPorLanding: 1,
  },
  "ponentes": {
    schema: schemaPonentes,
    Componente: componentesSeccion["ponentes"]!,
    etiqueta: "Ponentes",
    icono: "estrella",
    maxPorLanding: 1,
  },
  "linea-tiempo": {
    schema: schemaLineaTiempo,
    Componente: componentesSeccion["linea-tiempo"]!,
    etiqueta: "Línea de tiempo",
    icono: "reloj",
    maxPorLanding: 1,
  },
  "impacto": {
    schema: schemaImpacto,
    Componente: componentesSeccion["impacto"]!,
    etiqueta: "Impacto",
    icono: "corazon",
    maxPorLanding: 1,
  },
  creditos: {
    schema: schemaCreditos,
    Componente: componentesSeccion["creditos"]!,
    etiqueta: "Créditos",
    icono: "copiar",
    maxPorLanding: 1,
  },
  "cta-fija": {
    schema: schemaCtaFija,
    Componente: componentesSeccion["cta-fija"]!,
    etiqueta: "Botón fijo",
    icono: "flecha",
    maxPorLanding: 1,
  },
};
