import { LandingDoc, type RegistroSecciones } from "@/lib/contratos";
import { esFamiliaConocida } from "@/lib/fuentes/catalogo";
import { registro as registroPorDefecto } from "@/secciones/registro";
import type { Problema, Validador } from "./comun";

const rutaDe = (path: PropertyKey[]) =>
  path.reduce<string>((r, p) => (typeof p === "number" ? `${r}[${p}]` : r ? `${r}.${String(p)}` : String(p)), "");

/** Valida `LandingDoc` y, con el registro, `ajustes`/`bloques` de cada sección. */
export function crearValidadorEsquema(registro: RegistroSecciones = registroPorDefecto): Validador {
  return (doc) => {
    const rojos: Problema[] = [];
    const amarillos: Problema[] = [];

    const r = LandingDoc.safeParse(doc);
    if (!r.success) {
      for (const i of r.error.issues) rojos.push({ ruta: rutaDe(i.path), mensaje: i.message });
    }
    // Tipografía: cualquier familia es válida para el esquema, pero si no está en el catálogo ni en la biblioteca puede no existir en Google Fonts.
    for (const campo of ["titulos", "cuerpo"] as const) {
      const familia = doc.tokens?.tipografia?.[campo];
      if (typeof familia === "string" && familia.trim() && !esFamiliaConocida(familia)) {
        amarillos.push({ ruta: `tokens.tipografia.${campo}`, mensaje: `La tipografía «${familia}» no está en el catálogo ni en la biblioteca: revisa que exista en Google Fonts.` });
      }
    }
    (Array.isArray(doc.secciones) ? doc.secciones : []).forEach((s, i) => {
      const def = registro[s.tipo];
      if (!def) {
        amarillos.push({ ruta: `secciones[${i}]`, mensaje: `El tipo «${s.tipo}» aún no tiene esquema registrado.` });
        return;
      }
      const p = def.schema.safeParse({ ajustes: s.ajustes, bloques: s.bloques });
      if (!p.success) {
        for (const issue of p.error.issues) {
          rojos.push({ ruta: `secciones[${i}].${rutaDe(issue.path)}`, mensaje: issue.message });
        }
      }
    });

    const estado = rojos.length > 0 ? "rojo" : amarillos.length > 0 ? "amarillo" : "verde";
    return { resultado: { id: "esquema", estado, problemas: [...rojos, ...amarillos] } };
  };
}

export const validarEsquema: Validador = (doc, brief) => crearValidadorEsquema()(doc, brief);

/** Problemas en líneas legibles para reenviarlos a la IA. */
export function describirProblemas(problemas: Problema[]): string {
  return problemas.map((p) => `- ${p.ruta}: ${p.mensaje}`).join("\n");
}
