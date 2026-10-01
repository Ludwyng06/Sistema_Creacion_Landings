import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lintearTexto } from "@/lib/tecnicas/lista-negra";

const RAIZ = process.cwd();
const CARPETAS = ["src/componentes/crear", "src/app/crear"];

function archivos(carpeta: string): string[] {
  return readdirSync(join(RAIZ, carpeta)).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (statSync(join(RAIZ, ruta)).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx)$/.test(nombre) ? [ruta] : [];
  });
}

const ARCHIVOS = CARPETAS.flatMap(archivos);

/** Textos que ve la persona: texto de JSX y literales entre comillas o plantillas. */
function textosDe(fuente: string): string[] {
  const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const encontrados: string[] = [];
  for (const m of sinComentarios.matchAll(/>([^<>{}=\n][^<>{}\n]*)</g)) encontrados.push(m[1]);
  for (const m of sinComentarios.matchAll(/"((?:[^"\\\n]|\\.){4,})"/g)) encontrados.push(m[1]);
  for (const m of sinComentarios.matchAll(/`((?:[^`\\]|\\.){4,})`/g)) encontrados.push(m[1]);
  return encontrados.map((t) => t.replace(/\$\{[^}]*\}/g, "").trim()).filter((t) => /\s|[¿¡áéíóúñ]/.test(t) || t.length > 12);
}

describe("microcopy del asistente", () => {
  it("hay archivos que revisar", () => {
    expect(ARCHIVOS.length).toBeGreaterThan(10);
  });

  it("la lista negra del texto (docs/04 §7) queda en cero", () => {
    const infracciones = ARCHIVOS.flatMap((archivo) =>
      textosDe(readFileSync(join(RAIZ, archivo), "utf8")).flatMap((texto) =>
        lintearTexto(texto, archivo).map((i) => `${archivo}: «${texto}» → ${JSON.stringify(i)}`),
      ),
    );
    expect(infracciones).toEqual([]);
  });

  it("el detector sí atrapa texto vetado", () => {
    expect(lintearTexto("Una solución innovadora y revolucionaria").length).toBeGreaterThan(0);
  });

  it("no hay colores hex fijos en el asistente", () => {
    const conHex = ARCHIVOS.filter((a) => /#[0-9a-fA-F]{3,6}\b/.test(readFileSync(join(RAIZ, a), "utf8")));
    expect(conHex).toEqual([]);
  });

  it("todo el texto de interfaz está en español (sin frases comunes en inglés)", () => {
    const ingles = /\b(Submit|Cancel|Loading|Next|Previous|Save)\b/;
    const malos = ARCHIVOS.flatMap((a) => textosDe(readFileSync(join(RAIZ, a), "utf8")).filter((t) => ingles.test(t)));
    expect(malos).toEqual([]);
  });
});
