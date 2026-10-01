import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContenidoTecnicas } from "@/componentes/tecnicas/ContenidoTecnicas";
import { ENLACES_CLAVES, MODOS, TAREAS } from "@/componentes/ajustes/textos";
import { lintearTexto } from "@/lib/tecnicas/lista-negra";
import { modulos } from "@/lib/tecnicas/modulos";

const html = renderToStaticMarkup(<ContenidoTecnicas />);

function decodificar(t: string): string {
  return t.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&amp;", "&");
}

function textoVisible(fuente: string): string {
  return decodificar(fuente.replace(/<pre data-lista-negra="true"[^>]*>[\s\S]*?<\/pre>/g, " ").replace(/<[^>]+>/g, " "));
}

function textos(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.flatMap(textos);
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(textos);
  return [];
}

describe("página /tecnicas", () => {
  it("muestra las 8 técnicas leídas de `modulos`, con número, fase y descripción", () => {
    expect((html.match(/data-tecnica="/g) ?? []).length).toBe(8);
    for (const m of modulos) {
      expect(html).toContain(`data-tecnica="${m.id}"`);
      expect(html).toContain(m.nombre);
      expect(html).toContain(m.descripcionCorta);
      for (const t of m.aporta.tarea ?? []) expect(decodificar(html)).toContain(t);
    }
    for (const fase of ["Descubrir", "Definir", "Entregar"]) expect(html).toContain(`Fase: ${fase}`);
  });

  it("explica la anatomía de 4 bloques con los colores de la app y un ejemplo real", () => {
    for (const b of ["rol", "tarea", "contexto", "formato"]) {
      expect(html).toContain(`data-bloque="${b}"`);
      expect(html).toContain(`bg-${b}-suave`);
    }
    expect(html).toContain("Corrector de postura");
    expect(html).toContain("Eres estratega de conversión");
  });

  it("muestra el orden de aplicación 2 → 1 → 6 → 4 → 5 → 7 → 8 → 3 y las reglas de conflicto", () => {
    const orden = html.match(/data-testid="orden-aplicacion"[\s\S]*?<\/ol>/)![0];
    const numeros = [...orden.matchAll(/text-marca">(\d)</g)].map((m) => Number(m[1]));
    expect(numeros).toEqual([2, 1, 6, 4, 5, 7, 8, 3]);
    expect(html).toContain("manda el diseño sustractivo");
    expect(html).toContain("perfil Esencial");
    expect(html).toContain('data-testid="ejemplo-combinador"');
  });

  it("la sección que cita la lista negra se marca y el resto del texto queda en cero infracciones", () => {
    expect(html).toContain('data-lista-negra="true"');
    expect(html).toContain("Cita la lista negra");
    const propio = textoVisible(html);
    expect(lintearTexto(propio)).toEqual([]);
    // sin la exclusión, la cita sí se detecta (el linter funciona sobre este contenido)
    expect(lintearTexto(html.replace(/<[^>]+>/g, " ")).length).toBeGreaterThan(0);
  });
});

describe("textos de /ajustes", () => {
  it("no usan la lista negra", () => {
    const todo = textos([MODOS, TAREAS, ENLACES_CLAVES]).join("\n");
    expect(lintearTexto(todo)).toEqual([]);
  });

  it("explican los 3 modos y las 18 tareas", () => {
    expect(MODOS.map((m) => m.id)).toEqual(["cascada", "simultaneo", "duelo"]);
    expect(TAREAS).toHaveLength(18);
    for (const t of TAREAS) expect(t.motivo.length).toBeGreaterThan(20);
  });
});

describe("sistema de diseño", () => {
  it("las carpetas de /ajustes y /tecnicas no fijan colores hex", () => {
    const carpetas = ["src/componentes/ajustes", "src/componentes/tecnicas", "src/app/ajustes", "src/app/tecnicas"];
    for (const c of carpetas) {
      for (const f of readdirSync(c)) {
        const fuente = readFileSync(join(c, f), "utf8");
        expect(fuente, `${c}/${f}`).not.toMatch(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/);
      }
    }
  });
});
