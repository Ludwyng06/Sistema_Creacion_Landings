import { CATALOGO_EFECTOS, EfectoId, MAX_EFECTOS_NIVEL_3, type ModuloTecnica } from "@/lib/contratos";
import { armarPrompt } from "../armado";
import { error, resultado, type Problema } from "./util";

export const PLANTILLA_VIDEO =
  "{duración corta} seamless loop, {movimiento de cámara lento}, {producto en uso real}, {luz de la semilla}, {paleta}, calm pacing, no text, no people looking at camera, no fast cuts, subtle motion suitable as website background.";

export const tecnicaVideo: ModuloTecnica = {
  id: "video",
  numero: 5,
  nombre: "Generación de video",
  fase: "entregar",
  descripcionCorta: "Movimiento en código, un clip corto de Grok y efectos elegidos de un catálogo cerrado.",
  prioridad: 5,
  aporta: {
    rol: "Eres director de movimiento web y eliges efectos de un catálogo cerrado.",
    tarea: [
      "Mantén siempre la capa de movimiento en código: entradas de sección, parallax suave, contador del precio y microinteracción del botón, con respaldo para `prefers-reduced-motion`.",
      "Si el héroe es «video-inmersivo» o la landing tiene una sección de video, escribe el prompt de un clip corto en loop con la plantilla de clip y regístralo en `assets` con `tipo: 'video'`.",
      "Elige `efectos[]` por sección solo del catálogo permitido para la intensidad del brief, compatibles con el tipo de sección y con un máximo de 3 efectos de nivel 3 en toda la landing.",
    ],
    contexto: [`Plantilla del prompt de clip (en inglés):\n${PLANTILLA_VIDEO}`],
    formato: [
      "Cada sección lleva `animacion` y `efectos[]` con ids del catálogo; los clips van en `assets[]` con `tipo: 'video'`.",
    ],
  },
  generarPromptIndividual(brief, semilla) {
    return armarPrompt({ brief, modulos: [tecnicaVideo], semilla, modo: "individual" });
  },
  verificador(doc) {
    const problemas: Problema[] = [];
    let nivel3 = 0;
    doc.secciones.forEach((s, i) => {
      (s.efectos ?? []).forEach((efecto, j) => {
        const ruta = `secciones[${i}].efectos[${j}]`;
        if (!EfectoId.safeParse(efecto).success) {
          problemas.push(error(ruta, `El efecto «${efecto}» no pertenece al catálogo.`));
          return;
        }
        const def = CATALOGO_EFECTOS[efecto];
        if (!def.secciones.includes("global") && !def.secciones.includes(s.tipo)) {
          problemas.push(error(ruta, `El efecto «${efecto}» no es compatible con la sección «${s.tipo}».`));
        } else if (s.tipo === "heroe" && def.variantesHeroe && !def.variantesHeroe.some((v) => v === s.variante)) {
          problemas.push(error(ruta, `El efecto «${efecto}» exige el héroe ${def.variantesHeroe.join(" o ")}.`));
        }
        if (def.nivel > doc.tokens.intensidad) {
          problemas.push(error(ruta, `El efecto «${efecto}» es de nivel ${def.nivel} y la intensidad es ${doc.tokens.intensidad}.`));
        }
        if (def.nivel === 3) nivel3++;
      });
    });
    if (nivel3 > MAX_EFECTOS_NIVEL_3) {
      problemas.push(error("secciones", `Hay ${nivel3} efectos de nivel 3 y el máximo es ${MAX_EFECTOS_NIVEL_3}.`));
    }
    return resultado(problemas);
  },
};
