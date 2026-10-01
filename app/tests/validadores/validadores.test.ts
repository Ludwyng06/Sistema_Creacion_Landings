import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { LandingDoc } from "@/lib/contratos";
import { crearValidadorEsquema, registrarMedicionRender, saludDeMedicionRender, validarTodo } from "@/lib/validadores";
import { validarA11y } from "@/lib/validadores/a11y";
import { validarAntiSplit } from "@/lib/validadores/anti-split";
import { validarDatos } from "@/lib/validadores/datos";
import { validarEfectos } from "@/lib/validadores/efectos";
import { validarEsquema } from "@/lib/validadores/esquema";
import { validarEstructura } from "@/lib/validadores/estructura";
import { validarListaNegra } from "@/lib/validadores/lista-negra";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const copia = (): LandingDoc => structuredClone(landingEjemplo);
const seccion = (doc: LandingDoc, tipo: string) => doc.secciones.find((s) => s.tipo === tipo)!;

describe("esquema", () => {
  const cualquiera = z.object({ ajustes: z.record(z.string(), z.unknown()), bloques: z.array(z.unknown()) });
  const registroCompleto = Object.fromEntries(
    ["heroe", "problema-solucion", "beneficios", "oferta", "faq", "formulario-lead"].map((t) => [
      t,
      { schema: cualquiera, Componente: () => null, etiqueta: t, icono: "x", maxPorLanding: 1 },
    ]),
  );

  it("verde cuando todo cumple y cada tipo tiene esquema", () => {
    const { resultado } = crearValidadorEsquema(registroCompleto)(copia());
    expect(resultado).toEqual({ id: "esquema", estado: "verde", problemas: [] });
  });

  it("amarillo si un tipo no está registrado (registro inyectado sin esos tipos)", () => {
    const { "problema-solucion": _a, oferta: _b, ...sinEsos } = registroCompleto;
    void _a;
    void _b;
    const { resultado } = crearValidadorEsquema(sinEsos)(copia());
    expect(resultado.estado).toBe("amarillo");
    expect(resultado.problemas.map((p) => p.ruta)).toEqual(["secciones[1]", "secciones[3]"]);
    expect(resultado.problemas[0].mensaje).toContain("problema-solucion");
  });

  it("con el registro real, el ejemplo queda verde en esquema", () => {
    expect(validarEsquema(copia()).resultado.estado).toBe("verde");
  });

  it("rojo si los ajustes de una sección registrada no cumplen su esquema", () => {
    const doc = copia();
    doc.secciones[0].ajustes.titular = "";
    const { resultado } = validarEsquema(doc);
    expect(resultado.estado).toBe("rojo");
    expect(resultado.problemas[0].ruta).toBe("secciones[0].ajustes.titular");
  });

  it("rojo si los bloques no cumplen (faq con menos de 3 preguntas)", () => {
    const doc = copia();
    seccion(doc, "faq").bloques = seccion(doc, "faq").bloques.slice(0, 1);
    expect(validarEsquema(doc).resultado.estado).toBe("rojo");
  });

  it("rojo si el LandingDoc no cumple el contrato", () => {
    const doc = copia();
    doc.meta.slug = "Slug Malo";
    const { resultado } = validarEsquema(doc);
    expect(resultado.estado).toBe("rojo");
    expect(resultado.problemas.some((p) => p.ruta === "meta.slug")).toBe(true);
  });
});

describe("estructura", () => {
  it("verde con el ejemplo", () => {
    expect(validarEstructura(copia()).resultado.estado).toBe("verde");
  });

  it("reordena el héroe al inicio y queda amarillo", () => {
    const doc = copia();
    const [heroe, ...resto] = doc.secciones;
    doc.secciones = [resto[0], heroe, ...resto.slice(1)];
    const r = validarEstructura(doc);
    expect(r.resultado.estado).toBe("amarillo");
    expect(r.doc!.secciones[0].tipo).toBe("heroe");
    expect(r.doc!.secciones).toHaveLength(6);
  });

  it("rojo si falta el formulario, si se repite o si falta el héroe", () => {
    const sinForm = copia();
    sinForm.secciones = sinForm.secciones.filter((s) => s.tipo !== "formulario-lead");
    expect(validarEstructura(sinForm).resultado.estado).toBe("rojo");
    expect(validarEstructura(sinForm).resultado.problemas[0].mensaje).toContain("Falta el formulario");

    const doble = copia();
    doble.secciones.push({ ...structuredClone(seccion(doble, "formulario-lead")), id: "otro", intencion: { objetivo: "Otro objetivo" } });
    expect(validarEstructura(doble).resultado.estado).toBe("rojo");

    const sinHeroe = copia();
    sinHeroe.secciones = sinHeroe.secciones.filter((s) => s.tipo !== "heroe");
    expect(validarEstructura(sinHeroe).resultado.problemas.some((p) => p.mensaje.includes("héroe"))).toBe(true);
  });

  it("rojo con menos de 5 o más de 16 secciones", () => {
    const pocas = copia();
    pocas.secciones = pocas.secciones.slice(0, 3);
    expect(validarEstructura(pocas).resultado.problemas.some((p) => p.mensaje.includes("de 5 a 16"))).toBe(true);
  });

  it("amarillo por objetivos repetidos y por superar maxPorLanding", () => {
    const repetido = copia();
    repetido.secciones[2].intencion.objetivo = repetido.secciones[1].intencion.objetivo;
    const r1 = validarEstructura(repetido).resultado;
    expect(r1.estado).toBe("amarillo");
    expect(r1.problemas[0].ruta).toBe("secciones[2].intencion.objetivo");

    const dosFaq = copia();
    dosFaq.secciones.splice(5, 0, { ...structuredClone(seccion(dosFaq, "faq")), id: "faq-2", intencion: { objetivo: "Otra duda distinta" } });
    const r2 = validarEstructura(dosFaq).resultado;
    expect(r2.estado).toBe("amarillo");
    expect(r2.problemas[0].mensaje).toContain("máximo 1");
  });
});

describe("anti-split", () => {
  it("verde con variante del catálogo", () => {
    expect(validarAntiSplit(copia()).resultado.estado).toBe("verde");
  });

  it("rojo con una variante fuera del catálogo", () => {
    const doc = copia();
    doc.secciones[0].variante = "texto-izquierda-imagen-derecha";
    const { resultado } = validarAntiSplit(doc);
    expect(resultado.estado).toBe("rojo");
    expect(resultado.problemas[0].ruta).toBe("secciones[0].variante");
  });

  const htmlLibre = (html: string): LandingDoc["secciones"][number] => ({
    id: "html", tipo: "html-libre", visible: true, intencion: { objetivo: "Bloque libre" }, ajustes: { html }, bloques: [],
  });

  it("rojo con un html-libre en la primera posición", () => {
    const doc = copia();
    doc.secciones.unshift(htmlLibre("<p>hola</p>"));
    expect(validarAntiSplit(doc).resultado.estado).toBe("rojo");
  });

  it("rojo con dos columnas en el primer viewport; verde si no las tiene o va más abajo", () => {
    const dosCols = copia();
    dosCols.secciones.splice(1, 0, htmlLibre('<div class="grid grid-cols-2"><h1>x</h1><img/></div>'));
    expect(validarAntiSplit(dosCols).resultado.estado).toBe("rojo");
    for (const clase of ["flex-row", "float"]) {
      const d = copia();
      d.secciones.splice(1, 0, htmlLibre(`<div style="x" class="${clase}">a</div>`));
      expect(validarAntiSplit(d).resultado.estado, clase).toBe("rojo");
    }
    const limpio = copia();
    limpio.secciones.splice(1, 0, htmlLibre("<p>solo texto</p>"));
    expect(validarAntiSplit(limpio).resultado.estado).toBe("verde");
    const abajo = copia();
    abajo.secciones.splice(4, 0, htmlLibre('<div class="grid-cols-2">a</div>'));
    expect(validarAntiSplit(abajo).resultado.estado).toBe("verde");
  });
});

describe("lista-negra", () => {
  it("verde con el ejemplo y rojo con infracciones y su ruta", () => {
    expect(validarListaNegra(copia()).resultado.estado).toBe("verde");
    const doc = copia();
    doc.secciones[0].ajustes.subtitular = "Un corrector revolucionario";
    const { resultado } = validarListaNegra(doc);
    expect(resultado.estado).toBe("rojo");
    expect(resultado.problemas[0]).toEqual({
      ruta: "secciones[0].ajustes.subtitular",
      mensaje: "palabra-vetada: «revolucionario»",
    });
  });
});

describe("datos", () => {
  const conTexto = (texto: string) => {
    const doc = copia();
    doc.secciones[0].ajustes.subtitular = texto;
    return doc;
  };
  const estado = (doc: LandingDoc, brief = briefCorrector) => validarDatos(doc, brief).resultado;

  it("pendiente sin brief", () => {
    expect(validarDatos(copia()).resultado.estado).toBe("pendiente");
  });

  it("verde con el ejemplo (precios y ahorro salen del brief)", () => {
    expect(estado(copia()).estado).toBe("verde");
    expect(estado(conTexto("Antes $169.000, ahora $129.000: ahorras 40.000 COP, un 24 % menos.")).estado).toBe("verde");
  });

  it("amarillo con precios, porcentajes y cifras que no están en el brief", () => {
    for (const texto of ["Ahora $99.000", "Ahorra 50 % hoy", "Más de 5.000 clientes felices", "Calificación 4,9/5"]) {
      const r = estado(conTexto(texto));
      expect(r.estado, texto).toBe("amarillo");
      expect(r.problemas[0].ruta).toBe("secciones[0].ajustes.subtitular");
    }
  });

  it("acepta cifras del brief y campos marcados [COMPLETAR]", () => {
    const brief = { ...briefCorrector, pruebaSocial: { calificacion: 4.8, numOpiniones: 1200 } };
    expect(estado(conTexto("4,8/5 · 1.200 opiniones"), brief).estado).toBe("verde");
    expect(estado(conTexto("[COMPLETAR] % de clientes felices"), brief).estado).toBe("verde");
  });

  it("valida los campos numéricos (precio) del ajuste", () => {
    const doc = copia();
    seccion(doc, "oferta").ajustes.precio = 99000;
    const r = estado(doc);
    expect(r.estado).toBe("amarillo");
    expect(r.problemas[0].ruta).toBe("secciones[3].ajustes.precio");
  });

  it("compara fechas con la oferta del brief", () => {
    const brief = { ...briefCorrector, oferta: { descripcion: "Descuento", fechaFin: "2026-10-15T23:59:00-05:00" } };
    expect(estado(conTexto("Oferta hasta el 15 de octubre de 2026"), brief).estado).toBe("verde");
    expect(estado(conTexto("Oferta hasta el 15/10/2026"), brief).estado).toBe("verde");
    expect(estado(conTexto("Oferta hasta el 20 de octubre"), brief).estado).toBe("amarillo");
    expect(estado(conTexto("Oferta hasta el 15 de octubre")).estado).toBe("amarillo"); // el brief no trae oferta
  });

  it("los testimonios deben coincidir con los del brief", () => {
    const doc = copia();
    doc.secciones.splice(4, 0, {
      id: "sec-testimonios", tipo: "testimonios", visible: true, intencion: { objetivo: "Dar confianza con opiniones" },
      ajustes: { titulo: "Opiniones" },
      bloques: [{ id: "t1", tipo: "testimonio", ajustes: { nombre: "Laura", texto: "Me cambió el día" } }],
    });
    const r = estado(doc);
    expect(r.estado).toBe("amarillo");
    expect(r.problemas.map((p) => p.ruta)).toEqual([
      "secciones[4].bloques[0].ajustes.texto",
      "secciones[4].bloques[0].ajustes.nombre",
    ]);
    const brief = { ...briefCorrector, pruebaSocial: { testimonios: [{ nombre: "Laura", texto: "Me cambió el día" }] } };
    expect(estado(doc, brief).estado).toBe("verde");
    (doc.secciones[4].bloques[0].ajustes as Record<string, unknown>).texto = "[COMPLETAR]";
    (doc.secciones[4].bloques[0].ajustes as Record<string, unknown>).nombre = "[COMPLETAR]";
    expect(estado(doc).estado).toBe("verde");
  });
});

describe("a11y", () => {
  it("verde con el ejemplo; amarillo con bajo contraste o sin alt", () => {
    expect(validarA11y(copia()).resultado.estado).toBe("verde");

    const bajo = copia();
    bajo.tokens.colores.texto = "#888888";
    bajo.tokens.colores.acentoTexto = "#EEEEEE";
    const r = validarA11y(bajo).resultado;
    expect(r.estado).toBe("amarillo");
    expect(r.problemas.map((p) => p.ruta)).toEqual(["tokens.colores.texto", "tokens.colores.acentoTexto"]);

    const sinAlt = copia();
    sinAlt.assets[0].alt = "  ";
    expect(validarA11y(sinAlt).resultado.problemas[0].ruta).toBe("assets[0].alt");
  });
});

describe("efectos", () => {
  it("verde con el ejemplo", () => {
    const r = validarEfectos(copia());
    expect(r.resultado.estado).toBe("verde");
    expect(r.doc).toBeUndefined();
  });

  it("elimina el cuarto efecto de nivel 3 y queda amarillo", () => {
    const doc = copia();
    doc.secciones[0].variante = "producto-monumental";
    doc.secciones[0].efectos = ["video-scroll", "producto-explotado"];
    seccion(doc, "beneficios").efectos = ["pin-coreografia", "horizontal"];
    const r = validarEfectos(doc);
    expect(r.resultado.estado).toBe("amarillo");
    expect(r.resultado.problemas).toHaveLength(1);
    expect(r.resultado.problemas[0].ruta).toBe("secciones[2].efectos[1]");
    expect(seccion(r.doc!, "beneficios").efectos).toEqual(["pin-coreografia"]);
    expect(r.doc!.secciones[0].efectos).toEqual(["video-scroll", "producto-explotado"]);
    expect(doc.secciones[2].efectos).toEqual(["pin-coreografia", "horizontal"]); // no muta el original
  });

  it("elimina efectos incompatibles, de variante equivocada, de nivel superior a la intensidad y fuera del catálogo", () => {
    const doc = copia();
    seccion(doc, "faq").efectos = ["horizontal", "revelar-suave"];
    doc.secciones[0].efectos = ["video-scroll", "efecto-inventado" as never, "titular-cinetico"];
    doc.tokens.intensidad = 2;
    seccion(doc, "beneficios").efectos = ["pin-coreografia"];
    const r = validarEfectos(doc);
    expect(r.resultado.problemas.map((p) => p.ruta)).toEqual([
      "secciones[0].efectos[0]",
      "secciones[0].efectos[1]",
      "secciones[2].efectos[0]",
      "secciones[4].efectos[0]",
    ]);
    expect(r.doc!.secciones[0].efectos).toEqual(["titular-cinetico"]);
    expect(seccion(r.doc!, "faq").efectos).toEqual(["revelar-suave"]);
    expect(seccion(r.doc!, "beneficios").efectos).toEqual([]);
  });
});

describe("anti-split-render registrado", () => {
  const medicion = { aplica: true as const, solapamientoVertical: 1, solapamientoHorizontal: 0, explicacion: "Título y imagen lado a lado." };

  it("sin DOM ni medición queda pendiente y no rompe validarTodo en el servidor", () => {
    registrarMedicionRender(null);
    const { salud } = validarTodo(copia(), briefCorrector);
    expect(salud.find((s) => s.id === "anti-split-render")).toEqual({ id: "anti-split-render", estado: "pendiente", problemas: [] });
  });

  it("con medición: verde si no hay split, rojo con la explicación si lo hay, verde si no aplica", () => {
    expect(saludDeMedicionRender({ ...medicion, split: false }).estado).toBe("verde");
    expect(saludDeMedicionRender({ aplica: false, motivo: "ancho", split: false }).estado).toBe("verde");
    const rojo = saludDeMedicionRender({ ...medicion, split: true });
    expect(rojo.estado).toBe("rojo");
    expect(rojo.problemas[0].mensaje).toContain("lado a lado");
  });

  it("validarTodo usa la última medición registrada", () => {
    registrarMedicionRender({ ...medicion, split: true });
    expect(validarTodo(copia(), briefCorrector).salud.find((s) => s.id === "anti-split-render")?.estado).toBe("rojo");
    registrarMedicionRender(null);
  });
});

describe("validarTodo", () => {
  it("devuelve los 8 validadores en el orden de docs/05 §4, con el render pendiente", () => {
    const { salud } = validarTodo(copia(), briefCorrector);
    expect(salud.map((s) => s.id)).toEqual([
      "esquema", "estructura", "anti-split", "anti-split-render", "lista-negra", "datos", "a11y", "efectos",
    ]);
    expect(salud.map((s) => s.estado)).toEqual([
      "verde", "verde", "verde", "pendiente", "verde", "verde", "verde", "verde",
    ]);
  });

  it("encadena los documentos corregidos (héroe reordenado y efectos podados)", () => {
    const doc = copia();
    const [heroe, ...resto] = doc.secciones;
    doc.secciones = [resto[0], heroe, ...resto.slice(1)];
    doc.secciones[1].variante = "producto-monumental";
    doc.secciones[1].efectos = ["video-scroll", "producto-explotado"];
    seccion(doc, "beneficios").efectos = ["pin-coreografia", "horizontal"];
    const r = validarTodo(doc, briefCorrector);
    expect(r.doc.secciones[0].tipo).toBe("heroe");
    expect(seccion(r.doc, "beneficios").efectos).toEqual(["pin-coreografia"]);
    expect(r.salud.find((s) => s.id === "estructura")!.estado).toBe("amarillo");
    expect(r.salud.find((s) => s.id === "efectos")!.estado).toBe("amarillo");
  });
});
