import type { LandingDoc } from "@/lib/contratos";
import { normalizarTexto } from "@/lib/tecnicas/modulos/util";
import { registro } from "@/secciones/registro";
import type { Problema, Validador } from "./comun";

/**
 * Héroe primero (si no, se reordena), formulario exactamente una vez, de 5 a 16 secciones,
 * `maxPorLanding` por tipo y sin objetivos duplicados.
 * Rojo: falta el héroe, formulario ausente o repetido, cantidad fuera de rango.
 * Amarillo: héroe reordenado, exceso por tipo, objetivos repetidos.
 */
export const validarEstructura: Validador = (doc) => {
  const rojos: Problema[] = [];
  const amarillos: Problema[] = [];
  let corregido: LandingDoc | undefined;
  let secciones = doc.secciones;

  const n = secciones.length;
  if (n < 5 || n > 16) rojos.push({ ruta: "secciones", mensaje: `Hay ${n} secciones y debe haber de 5 a 16.` });

  const posHeroe = secciones.findIndex((s) => s.tipo === "heroe");
  if (posHeroe === -1) {
    rojos.push({ ruta: "secciones", mensaje: "Falta la sección de héroe." });
  } else if (posHeroe > 0) {
    secciones = [secciones[posHeroe], ...secciones.slice(0, posHeroe), ...secciones.slice(posHeroe + 1)];
    corregido = { ...doc, secciones };
    amarillos.push({ ruta: `secciones[${posHeroe}]`, mensaje: "El héroe no iba primero; se movió al inicio." });
  }

  const formularios = secciones.filter((s) => s.tipo === "formulario-lead").length;
  if (formularios === 0) rojos.push({ ruta: "secciones", mensaje: "Falta el formulario de lead." });
  if (formularios > 1) {
    rojos.push({ ruta: "secciones", mensaje: `El formulario de lead aparece ${formularios} veces y debe aparecer una.` });
  }

  const porTipo = new Map<string, number>();
  secciones.forEach((s, i) => {
    const total = (porTipo.get(s.tipo) ?? 0) + 1;
    porTipo.set(s.tipo, total);
    const max = registro[s.tipo]?.maxPorLanding;
    if (max !== undefined && total > max) {
      amarillos.push({ ruta: `secciones[${i}]`, mensaje: `«${s.tipo}» admite como máximo ${max} por landing.` });
    }
  });

  const objetivos = new Map<string, number>();
  secciones.forEach((s, i) => {
    const clave = normalizarTexto(s.intencion.objetivo);
    if (!clave) return;
    const previo = objetivos.get(clave);
    if (previo !== undefined) {
      amarillos.push({ ruta: `secciones[${i}].intencion.objetivo`, mensaje: `Repite el objetivo de secciones[${previo}].` });
    } else objetivos.set(clave, i);
  });

  const estado = rojos.length > 0 ? "rojo" : amarillos.length > 0 ? "amarillo" : "verde";
  return { resultado: { id: "estructura", estado, problemas: [...rojos, ...amarillos] }, doc: corregido };
};
