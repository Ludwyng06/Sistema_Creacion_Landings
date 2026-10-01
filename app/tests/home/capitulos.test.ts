import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGO_EFECTOS, MAX_EFECTOS_NIVEL_3 } from "@/lib/contratos";
import { lintearTexto, modulos } from "@/lib/tecnicas";
import { CAPITULOS, EFECTOS_NIVEL_3_DEL_HOME, capituloEn, progresoLocal } from "@/app/(home)/capitulos";
import { CAPAS, fichasDeTecnicas } from "@/app/(home)/capas";
import { piezasVisibles, textoEscrito } from "@/app/(home)/capitulos/Brief";
import { TEXTOS, todosLosTextos } from "@/app/(home)/textos";

describe("tabla de capítulos", () => {
  it("son 9 capítulos consecutivos que cubren de 0 a 1", () => {
    expect(CAPITULOS).toHaveLength(9);
    expect(CAPITULOS[0].inicio).toBe(0);
    expect(CAPITULOS.at(-1)!.fin).toBeCloseTo(1, 10);
    CAPITULOS.forEach((c, i) => {
      expect(c.numero).toBe(i);
      if (i > 0) expect(c.inicio).toBeCloseTo(CAPITULOS[i - 1].fin, 10);
    });
    expect(CAPITULOS.map((c) => c.id)).toEqual(["portada", "problema", "brief", "tecnicas", "ensamblaje", "semilla", "critico", "banco", "cierre"]);
  });

  it("capituloEn devuelve el capítulo según el progreso y respeta los bordes", () => {
    expect(capituloEn(0).id).toBe("portada");
    expect(capituloEn(0.001).id).toBe("portada");
    for (const c of CAPITULOS) {
      expect(capituloEn(c.inicio).id).toBe(c.id);
      expect(capituloEn((c.inicio + c.fin) / 2).id).toBe(c.id);
    }
    expect(capituloEn(1).id).toBe("cierre");
    expect(capituloEn(7).id).toBe("cierre");
    expect(capituloEn(-2).id).toBe("portada");
    expect(capituloEn(Number.NaN).id).toBe("portada");
  });

  it("progresoLocal va de 0 a 1 dentro del capítulo", () => {
    const c = CAPITULOS[3];
    expect(progresoLocal(c.inicio, c)).toBe(0);
    expect(progresoLocal(c.fin, c)).toBe(1);
    expect(progresoLocal((c.inicio + c.fin) / 2, c)).toBeCloseTo(0.5, 10);
    expect(progresoLocal(0, c)).toBe(0);
    expect(progresoLocal(1, c)).toBe(1);
  });

  it("los capítulos con coreografía reciben más recorrido que los bloques estáticos", () => {
    const alto = (id: string) => CAPITULOS.find((c) => c.id === id)!.alto;
    for (const id of ["portada", "problema", "brief", "tecnicas", "ensamblaje"]) expect(alto(id)).toBeGreaterThanOrEqual(300);
    expect(alto("semilla")).toBeLessThan(alto("portada"));
  });
});

describe("efectos del home", () => {
  it("usa como máximo 3 efectos de nivel 3, todos del catálogo", () => {
    const ids = Object.values(EFECTOS_NIVEL_3_DEL_HOME);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(MAX_EFECTOS_NIVEL_3);
    for (const id of ids) expect(CATALOGO_EFECTOS[id].nivel).toBe(3);
  });
});

describe("capítulo 2 · la frase se escribe sola", () => {
  it("no escribe nada al inicio, escribe el ejemplo de meteoros al final y nunca retrocede", () => {
    expect(textoEscrito(0)).toBe("");
    expect(textoEscrito(1)).toBe(TEXTOS.brief.ejemplo);
    expect(TEXTOS.brief.ejemplo).toMatch(/meteoros/);
    let previo = 0;
    for (let i = 0; i <= 100; i++) {
      const largo = textoEscrito(i / 100).length;
      expect(largo).toBeGreaterThanOrEqual(previo);
      previo = largo;
    }
  });

  it("primero se escribe, luego aparece el tipo detectado y al final se activan las fuentes una a una", () => {
    expect(piezasVisibles(0)).toEqual({ tipo: false, fuentes: 0 });
    expect(piezasVisibles(0.7)).toEqual({ tipo: true, fuentes: 0 });
    expect(piezasVisibles(1)).toEqual({ tipo: true, fuentes: 3 });
    expect(TEXTOS.brief.listaFuentes).toEqual(["NASA", "NOAA", "Openverse"]);
    expect([TEXTOS.brief.tipo, TEXTOS.brief.tematica]).toEqual(["Evento", "Espacio"]);
  });
});

describe("capítulo 3 · las 8 técnicas", () => {
  const fichas = fichasDeTecnicas();

  it("las 8 fichas salen del registro de técnicas, sin textos copiados", () => {
    expect(fichas).toHaveLength(8);
    for (const f of fichas) {
      const m = modulos.find((x) => x.id === f.id)!;
      expect(f.nombre).toBe(m.nombre);
      expect(f.resumen).toBe(m.descripcionCorta);
      expect(f.numero).toBe(m.numero);
    }
  });

  it("encajan de a dos en cada una de las 4 capas y cada una aporta a alguna capa", () => {
    for (const capa of CAPAS) expect(fichas.filter((f) => f.capa === capa)).toHaveLength(2);
    for (const f of fichas) expect(f.aporta.length).toBeGreaterThan(0);
  });
});

describe("texto y estilos del home", () => {
  it("el titular de la portada es el pedido", () => {
    expect(TEXTOS.portada.titular).toBe("Landings que no parecen hechas por IA.");
    expect(TEXTOS.portada.boton).toBe("Crear la mía");
    expect(TEXTOS.cierre.boton).toBe("Construir mi landing");
  });

  it("navegación mínima con los cuatro enlaces", () => {
    expect(TEXTOS.enlaces.map((e) => e.href)).toEqual(["/crear", "/banco", "/tecnicas", "/ajustes"]);
  });

  it("la lista negra queda en cero en todo el texto del home", () => {
    for (const t of todosLosTextos()) expect(lintearTexto(t), t).toEqual([]);
  });

  it("no hay colores hex en el código del home ni del video-scroll", () => {
    const raices = [join(process.cwd(), "src", "app", "(home)"), join(process.cwd(), "src", "efectos", "video-scroll")];
    const archivos: string[] = [join(process.cwd(), "src", "efectos", "VideoScroll.tsx")];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.(tsx?|css)$/.test(nombre)) archivos.push(ruta);
      }
    };
    raices.forEach(recorrer);
    expect(archivos.length).toBeGreaterThan(10);
    for (const a of archivos) expect(readFileSync(a, "utf8"), a).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
