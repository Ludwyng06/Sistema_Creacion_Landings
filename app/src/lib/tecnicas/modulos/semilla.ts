import { ColorHex, type ModuloTecnica } from "@/lib/contratos";
import { armarPrompt } from "../armado";
import { TIPOGRAFIAS } from "../semillas";
import { error, resultado, type Problema } from "./util";

export const tecnicaSemilla: ModuloTecnica = {
  id: "semilla",
  numero: 1,
  nombre: "Semilla",
  fase: "descubrir",
  descripcionCorta: "Un estilo histórico y una industria vecina fijan una sola fuente de verdad visual.",
  prioridad: 2,
  aporta: {
    rol: "Eres director de arte y aplicas la semilla «{estilo} × {industria}» como sistema visual.",
    tarea: [
      "Traduce la semilla en decisiones concretas: jerarquía tipográfica, uso del espacio negativo, ritmo de secciones y tratamiento de imágenes.",
      "Usa exclusivamente los colores, tipografías, radio, espaciado, borde e imagen de los tokens entregados.",
    ],
    contexto: [
      "Semilla: estilo «{estilo}», industria vecina «{industria}», paleta {paletaId}, tipografía {tipografiaId}, número {numero}. Estos tokens mandan sobre cualquier color o tipografía que sugieran otras técnicas; solo los colores de marca del brief los reemplazan.",
    ],
    formato: ["Incluye `tokens` y `meta.semilla` completos y usa solo esos valores en todo el documento."],
  },
  generarPromptIndividual(brief, semilla) {
    return armarPrompt({ brief, modulos: [tecnicaSemilla], semilla, modo: "individual" });
  },
  verificador(doc) {
    const problemas: Problema[] = [];
    for (const [nombre, valor] of Object.entries(doc.tokens.colores)) {
      if (!ColorHex.safeParse(valor).success) {
        problemas.push(error(`tokens.colores.${nombre}`, `El color «${valor}» no es un hex válido.`));
      }
    }
    const titulos = TIPOGRAFIAS.map((t) => t.titulos);
    const cuerpos = TIPOGRAFIAS.map((t) => t.cuerpo);
    const { titulos: tt, cuerpo } = doc.tokens.tipografia;
    if (!titulos.includes(tt)) problemas.push(error("tokens.tipografia.titulos", `«${tt}» no está en la biblioteca de parejas.`));
    if (!cuerpos.includes(cuerpo)) problemas.push(error("tokens.tipografia.cuerpo", `«${cuerpo}» no está en la biblioteca de parejas.`));
    return resultado(problemas);
  },
};
