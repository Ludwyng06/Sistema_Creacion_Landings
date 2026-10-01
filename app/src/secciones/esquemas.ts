import { registrarEsquemas } from "./leer";
import { schema as schemaAntesDespues } from "./antes-despues/schema";
import { schema as schemaBeneficios } from "./beneficios/schema";
import { schema as schemaCifras } from "./cifras/schema";
import { schema as schemaCintaAnuncio } from "./cinta-anuncio/schema";
import { schema as schemaComoFunciona } from "./como-funciona/schema";
import { schema as schemaComparativa } from "./comparativa/schema";
import { schema as schemaCuentaRegresiva } from "./cuenta-regresiva/schema";
import { schema as schemaFaq } from "./faq/schema";
import { schema as schemaFormularioLead } from "./formulario-lead/schema";
import { schema as schemaGaleria } from "./galeria/schema";
import { schema as schemaGarantia } from "./garantia/schema";
import { schema as schemaHeroe } from "./heroe/schema";
import { schema as schemaHtmlLibre } from "./html-libre/schema";
import { schema as schemaIncluye } from "./incluye/schema";
import { schema as schemaOferta } from "./oferta/schema";
import { schema as schemaProblemaSolucion } from "./problema-solucion/schema";
import { schema as schemaTestimonios } from "./testimonios/schema";
import { schema as schemaVideo } from "./video/schema";
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

/** Esquema de cada tipo de sección: quien lo importe activa la validación de `leerSeccion`. */
export const ESQUEMAS_SECCION = {
  "antes-despues": schemaAntesDespues,
  "beneficios": schemaBeneficios,
  "cifras": schemaCifras,
  "cinta-anuncio": schemaCintaAnuncio,
  "como-funciona": schemaComoFunciona,
  "comparativa": schemaComparativa,
  "cuenta-regresiva": schemaCuentaRegresiva,
  "faq": schemaFaq,
  "formulario-lead": schemaFormularioLead,
  "galeria": schemaGaleria,
  "garantia": schemaGarantia,
  "heroe": schemaHeroe,
  "html-libre": schemaHtmlLibre,
  "incluye": schemaIncluye,
  "oferta": schemaOferta,
  "problema-solucion": schemaProblemaSolucion,
  "testimonios": schemaTestimonios,
  "video": schemaVideo,
  "para-quien": schemaParaQuien,
  "mecanismo": schemaMecanismo,
  "historia": schemaHistoria,
  "resumen": schemaResumen,
  "escena-uso": schemaEscenaUso,
  "agenda": schemaAgenda,
  "ponentes": schemaPonentes,
  "linea-tiempo": schemaLineaTiempo,
  "impacto": schemaImpacto,
  "creditos": schemaCreditos,
  "cta-fija": schemaCtaFija,
  "dato-curioso": schemaDatoCurioso,
  "dato-en-vivo": schemaDatoEnVivo,
  "ficha-tecnica": schemaFichaTecnica,
  "sellos-confianza": schemaSellosConfianza,
};

registrarEsquemas(ESQUEMAS_SECCION);
