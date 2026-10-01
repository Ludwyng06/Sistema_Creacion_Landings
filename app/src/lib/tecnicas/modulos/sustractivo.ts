import type { ModuloTecnica } from "@/lib/contratos";
import { armarPrompt } from "../armado";
import { error, normalizarTexto, resultado, type Problema } from "./util";

const CAMPOS_OPCIONALES = ["ciudad", "mensaje"];
const MAX_CAMPOS_OBLIGATORIOS = 3;

export const tecnicaSustractivo: ModuloTecnica = {
  id: "sustractivo",
  numero: 6,
  nombre: "Diseño sustractivo",
  fase: "definir",
  descripcionCorta: "De 5 a 16 secciones, poda del 30 % y un formulario de hasta 3 campos.",
  prioridad: 3,
  aporta: {
    rol: "Eres editor de diseño sustractivo: cada elemento se justifica o se elimina.",
    tarea: [
      "Limita el documento a un presupuesto de 5 a 16 secciones (objetivo habitual: 7), formulario incluido, con un CTA principal repetido tres veces como máximo y una fuente de títulos más una de cuerpo.",
      "Audita la estructura propuesta por el prompt ambicioso, identifica el 30 % más decorativo, elimínalo y regístralo en `meta.eliminadas` con su tipo y su motivo.",
      "Fusiona las secciones que cumplan el mismo objetivo y deja el formulario con tres campos como máximo: nombre, correo y teléfono.",
    ],
    contexto: ["Presupuesto: de 5 a 16 secciones; formulario de lead con un máximo de 3 campos obligatorios."],
    formato: ["Registra en `meta.eliminadas: [{ tipo, motivo }]` cada elemento retirado; la interfaz lo muestra como «Poda»."],
  },
  generarPromptIndividual(brief, semilla) {
    return armarPrompt({ brief, modulos: [tecnicaSustractivo], semilla, modo: "individual" });
  },
  verificador(doc) {
    const problemas: Problema[] = [];
    const n = doc.secciones.length;
    if (n < 5 || n > 16) problemas.push(error("secciones", `Hay ${n} secciones y el presupuesto es de 5 a 16.`));

    const vistos = new Map<string, number>();
    doc.secciones.forEach((s, i) => {
      const clave = normalizarTexto(s.intencion.objetivo);
      if (!clave) return;
      const previo = vistos.get(clave);
      if (previo !== undefined) {
        problemas.push(error(`secciones[${i}].intencion.objetivo`, `Repite el objetivo de secciones[${previo}]: fusiónalas.`));
      } else vistos.set(clave, i);

      if (s.tipo === "formulario-lead") {
        const campos = Array.isArray(s.ajustes.campos) ? (s.ajustes.campos as unknown[]).filter((c): c is string => typeof c === "string") : [];
        const opcionales = Array.isArray(s.ajustes.opcionales) ? (s.ajustes.opcionales as unknown[]) : [];
        const obligatorios = campos.filter((c) => !CAMPOS_OPCIONALES.includes(c) && !opcionales.includes(c));
        if (obligatorios.length > MAX_CAMPOS_OBLIGATORIOS) {
          problemas.push(error(`secciones[${i}].ajustes.campos`, `El formulario pide ${obligatorios.length} campos obligatorios y el máximo es ${MAX_CAMPOS_OBLIGATORIOS}.`));
        }
      }
    });
    return resultado(problemas);
  },
};
