import { CATALOGO_EFECTOS, EfectoId, MAX_EFECTOS_NIVEL_3, type LandingDoc } from "@/lib/contratos";
import { resultadoDe, type Problema, type Validador } from "./comun";

/**
 * Catálogo, compatibilidad con la sección y la variante de héroe, nivel ≤ intensidad
 * y máximo 3 de nivel 3. Elimina los sobrantes (devuelve `doc`) y queda amarillo.
 */
export const validarEfectos: Validador = (doc) => {
  const problemas: Problema[] = [];
  let nivel3 = 0;
  let cambio = false;

  const secciones = doc.secciones.map((s, i) => {
    if (!s.efectos || s.efectos.length === 0) return s;
    const conservados = s.efectos.filter((efecto, j) => {
      const ruta = `secciones[${i}].efectos[${j}]`;
      const quitar = (motivo: string) => {
        problemas.push({ ruta, mensaje: `Se eliminó «${efecto}»: ${motivo}.` });
        return false;
      };
      if (!EfectoId.safeParse(efecto).success) return quitar("no pertenece al catálogo");
      const def = CATALOGO_EFECTOS[efecto];
      if (!def.secciones.includes("global") && !def.secciones.includes(s.tipo)) {
        return quitar(`no es compatible con la sección «${s.tipo}»`);
      }
      if (s.tipo === "heroe" && def.variantesHeroe && !def.variantesHeroe.some((v) => v === s.variante)) {
        return quitar(`exige el héroe ${def.variantesHeroe.join(" o ")}`);
      }
      if (def.nivel > doc.tokens.intensidad) {
        return quitar(`es de nivel ${def.nivel} y la intensidad es ${doc.tokens.intensidad}`);
      }
      if (def.nivel === 3) {
        if (nivel3 >= MAX_EFECTOS_NIVEL_3) return quitar(`superó el máximo de ${MAX_EFECTOS_NIVEL_3} efectos de nivel 3`);
        nivel3++;
      }
      return true;
    });
    if (conservados.length === s.efectos.length) return s;
    cambio = true;
    return { ...s, efectos: conservados };
  });

  const corregido: LandingDoc | undefined = cambio ? { ...doc, secciones } : undefined;
  return { resultado: resultadoDe("efectos", problemas), doc: corregido };
};
