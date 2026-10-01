import type { ModuloTecnica } from "@/lib/contratos";
import { armarPrompt } from "../armado";
import { PALABRAS_VETADAS, lintearDoc } from "../lista-negra";
import { error, resultado } from "./util";

/** Aporte que cita las expresiones vetadas; `lintearPrompt` lo excluye del linter. */
const CONTEXTO_LISTA_NEGRA = [
  `Vocabulario reservado (el linter en código lo comprueba, así que el texto final no contiene estas expresiones): ${PALABRAS_VETADAS.join(", ")}, más «lleva tu … al siguiente nivel» y «calidad premium» sin dato del brief.`,
  "Patrones reservados: más de un emoji por texto, signos de exclamación dobles, la estructura «no es solo X, es Y», más de un guion largo por párrafo y las promesas médicas o absolutas como «cura», «elimina para siempre», «100 % garantizado», «sin efectos secundarios» o «resultados inmediatos».",
  "Estilos visuales reservados: héroe con el título a la izquierda y la imagen a la derecha, degradados morado-azul, bento grids, glassmorphism decorativo, sombras neón, íconos 3D genéricos, personas con sonrisa perfecta mirando a cámara, piel plástica, colores sobresaturados y fondos de oficina genéricos.",
].join("\n");

export const tecnicaNegativas: ModuloTecnica = {
  id: "negativas",
  numero: 7,
  nombre: "Restricciones negativas",
  fase: "entregar",
  descripcionCorta: "Lista negra y linter en código que eliminan los tics que delatan texto de IA.",
  prioridad: 6,
  aporta: {
    rol: "Eres editor de estilo y mantienes el texto libre de tics de IA.",
    tarea: [
      "Escribe con verbos concretos y datos del brief, una idea por frase y como máximo un emoji por texto.",
      "Usa signos de exclamación simples y un guion largo por párrafo como máximo.",
      "Afirma cada beneficio de forma directa, con frases de estructura distinta y sin repetir tríadas retóricas; respalda cada promesa con un dato del brief.",
      "Usa para el héroe una de las 8 variantes aprobadas, con el contenido centrado, superpuesto o apilado.",
      "En los prompts de imagen pide fotografía documental, luz natural, personas diversas con expresiones espontáneas y colores fieles.",
    ],
    contexto: [CONTEXTO_LISTA_NEGRA],
    formato: ["Todos los textos del documento pasan el linter de lista negra con cero infracciones."],
  },
  generarPromptIndividual(brief, semilla) {
    return armarPrompt({ brief, modulos: [tecnicaNegativas], semilla, modo: "individual" });
  },
  verificador(doc) {
    return resultado(
      lintearDoc(doc).map((i) => error(i.ruta, `${i.regla}: «${i.fragmento}»`)),
    );
  },
};
