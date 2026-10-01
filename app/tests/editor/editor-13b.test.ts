import { describe, expect, it } from "vitest";
import type { LandingDoc, Seccion } from "@/lib/contratos";
import { traducirAtajo } from "@/componentes/editor/atajos";
import { conValorEnRuta, textosEditables } from "@/componentes/editor/edicion-en-linea";
import { destinoEnGrupo, grupoDe, posicionParaAgregar } from "@/componentes/editor/grupos";
import { estadoInicial, reducirEditor, MAX_HISTORIAL } from "@/componentes/editor/estado-editor";
import { leerMensajeAVista, leerMensajeDeVista } from "@/componentes/editor/mensajes";
import { buscarMedios } from "@/componentes/editor/bancos";
import { clasesDePresentacion, conPresentacion, leerPresentacion, normalizarAncla } from "@/secciones/presentacion";
import { tieneVariantes, varianteActual, conVariante, variantesDe } from "@/secciones/catalogo-variantes";
import { ejemplo as cta } from "@/secciones/cta-fija/ejemplo";
import { ejemplo as creditos } from "@/secciones/creditos/ejemplo";
import { ejemplo as cinta } from "@/secciones/cinta-anuncio/ejemplo";
import { landingEjemplo } from "../fixtures/landing-ejemplo";

const doc = (extra: Seccion[] = []): LandingDoc => ({ ...landingEjemplo, secciones: [...landingEjemplo.secciones, ...extra] });
const tecla = (key: string, o: Partial<Parameters<typeof traducirAtajo>[0]> = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, enCampo: false, ...o });

describe("grupos", () => {
  it("clasifica y respeta al héroe", () => {
    expect(grupoDe("cinta-anuncio")).toBe("encabezado");
    expect(grupoDe("creditos")).toBe("pie");
    expect(grupoDe("cta-fija")).toBe("fijos");
    const d = doc();
    const heroe = d.secciones[0].id;
    expect(destinoEnGrupo(d, heroe, 1)).toBeNull();
    expect(destinoEnGrupo(d, d.secciones[1].id, -1)).toBeNull(); // no sube sobre el héroe
    expect(destinoEnGrupo(d, d.secciones[1].id, 1)).toBe(2);
  });
  it("cada grupo agrega en su lugar", () => {
    const d = doc([creditos, cta]);
    const form = d.secciones.findIndex((s) => s.tipo === "formulario-lead");
    expect(posicionParaAgregar(d, "faq")).toBe(form);
    expect(posicionParaAgregar(d, "creditos")).toBe(d.secciones.findIndex((s) => s.tipo === "cta-fija"));
    expect(posicionParaAgregar(d, "cinta-anuncio")).toBe(1);
  });
  it("mover-en-grupo no cruza grupos", () => {
    const d = doc([cinta]);
    let e = estadoInicial(d);
    e = reducirEditor(e, { tipo: "mover-en-grupo", id: cinta.id, paso: -1 });
    expect(e.doc.secciones.map((s) => s.id)).toEqual(d.secciones.map((s) => s.id));
  });
  it("historial de 100 y 16 secciones", () => {
    expect(MAX_HISTORIAL).toBe(100);
  });
});

describe("atajos", () => {
  it("traduce cada tecla", () => {
    expect(traducirAtajo(tecla("z", { ctrlKey: true }))).toBe("deshacer");
    expect(traducirAtajo(tecla("Z", { metaKey: true, shiftKey: true }))).toBe("rehacer");
    expect(traducirAtajo(tecla("d", { ctrlKey: true }))).toBe("duplicar");
    expect(traducirAtajo(tecla("Delete"))).toBe("eliminar");
    expect(traducirAtajo(tecla("ArrowUp", { altKey: true }))).toBe("subir");
    expect(traducirAtajo(tecla("ArrowDown", { altKey: true }))).toBe("bajar");
    expect(traducirAtajo(tecla("Escape"))).toBe("deseleccionar");
    expect(traducirAtajo(tecla("p"))).toBe("ver-completa");
    expect(traducirAtajo(tecla("?", { shiftKey: true }))).toBe("ayuda");
  });
  it("al escribir en un campo solo valen deshacer y rehacer", () => {
    expect(traducirAtajo(tecla("Delete", { enCampo: true }))).toBeNull();
    expect(traducirAtajo(tecla("p", { enCampo: true }))).toBeNull();
    expect(traducirAtajo(tecla("z", { ctrlKey: true, enCampo: true }))).toBe("deshacer");
  });
});

describe("mensajes postMessage", () => {
  it("valida la forma", () => {
    expect(leerMensajeDeVista({ type: "CLICK_SECTION", id: "a" })).toEqual({ type: "CLICK_SECTION", id: "a", blockId: undefined });
    expect(leerMensajeDeVista({ type: "SECTION_ACTION", id: "a", action: "borrar-todo" })).toBeNull();
    expect(leerMensajeDeVista({ type: "INLINE_EDIT", id: "a", path: "ajustes.titulo" })).toBeNull();
    expect(leerMensajeDeVista("hola")).toBeNull();
    expect(leerMensajeAVista({ type: "DEVICE", device: "tablet" })).not.toBeNull();
    expect(leerMensajeAVista({ type: "DEVICE", device: "tv" })).toBeNull();
    expect(leerMensajeAVista({ type: "LANDING_UPDATE", landing: {} })).toBeNull();
  });
});

describe("edición en línea", () => {
  it("solo campos de texto del schema", () => {
    const heroe = landingEjemplo.secciones[0];
    const rutas = textosEditables(heroe).map((t) => t.ruta);
    expect(rutas).toContain("ajustes.titular");
    expect(conValorEnRuta(heroe, "ajustes.titular", "Nuevo")?.ajustes.titular).toBe("Nuevo");
    expect(conValorEnRuta(heroe, "ajustes.slot", "x")).toBeNull();
    expect(conValorEnRuta(heroe, "ajustes.__proto__", "x")).toBeNull();
  });
});

describe("presentación", () => {
  it("descarta basura y quita lo vacío", () => {
    const p = leerPresentacion({ presentacion: { fondo: "rojo", ancla: "Mal Ancla!", ocultarEn: ["movil", "tv"], focos: { a: "20% 30%", b: "x" } } });
    expect(p).toMatchObject({ fondo: "ninguno", ancla: "", ocultarEn: ["movil"], focos: { a: "20% 30%" } });
    const s = landingEjemplo.secciones[1];
    const con = conPresentacion(s, { fondo: "acento" });
    expect(clasesDePresentacion(leerPresentacion(con.ajustes))).toContain("bg-acento");
    expect(conPresentacion(con, { fondo: "ninguno" }).ajustes.presentacion).toBeUndefined();
    expect(normalizarAncla("Precios Día 1")).toBe("precios-dia-1");
  });
});

describe("variantes y bancos", () => {
  it("cambia la variante sin perder contenido", () => {
    const b = landingEjemplo.secciones.find((s) => s.tipo === "beneficios")!;
    expect(tieneVariantes("beneficios")).toBe(true);
    const otra = conVariante(b, "numerada");
    expect(varianteActual(otra)).toBe("numerada");
    expect(otra.bloques).toEqual(b.bloques);
    expect(variantesDe("heroe")).toHaveLength(8);
  });
  it("sin API de medios usa la muestra marcada como simulada", async () => {
    const r = await buscarMedios({ q: "neon" }, (async () => new Response("", { status: 404 })) as typeof fetch);
    expect(r.simulado).toBe(true);
    const real = await buscarMedios({}, (async () => new Response(JSON.stringify({ medios: [] }))) as typeof fetch);
    expect(real.simulado).toBe(false);
  });
});
