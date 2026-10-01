import { afterEach, describe, expect, it, vi } from "vitest";
import { BORRADOR_VACIO, aBrief, briefValido, deBrief, erroresDelBrief } from "@/componentes/crear/borrador";
import { EJEMPLOS } from "@/datos/ejemplos";
import {
  CLAVE_SESION,
  ESTADO_INICIAL,
  guardarSesion,
  leerSesion,
  motivoBloqueo,
  promptEfectivo,
  puedeEstarEn,
  reducir,
  type Accion,
  type EstadoAsistente,
} from "@/componentes/crear/estado";
import { combinar } from "@/lib/tecnicas/combinador";
import { tirarSemilla, tokensParaBrief } from "@/lib/tecnicas/semillas";

const BRIEF_EJEMPLO = EJEMPLOS[0].brief;
const valido = deBrief(BRIEF_EJEMPLO);
const conBriefValido: EstadoAsistente = { ...ESTADO_INICIAL, brief: valido };

function respuestaPrompt() {
  const { semilla } = tirarSemilla(7, 3);
  const prompt = combinar(BRIEF_EJEMPLO, [], semilla);
  return { prompt, texto: "texto", semilla, tokens: tokensParaBrief(semilla, BRIEF_EJEMPLO) };
}

afterEach(() => vi.unstubAllGlobals());

describe("reducer del asistente", () => {
  it("empieza en el paso 1 con el brief vacío", () => {
    expect(ESTADO_INICIAL.paso).toBe(1);
    expect(briefValido(ESTADO_INICIAL.brief)).toBe(false);
  });

  it("bloquea el avance con un brief inválido", () => {
    const despues = reducir(ESTADO_INICIAL, { tipo: "avanzar" });
    expect(despues.paso).toBe(1);
    expect(motivoBloqueo(ESTADO_INICIAL)).toMatch(/campos obligatorios/i);
  });

  it("avanza cuando el brief es válido y puede volver atrás", () => {
    const en2 = reducir(conBriefValido, { tipo: "avanzar" });
    expect(en2.paso).toBe(2);
    const en3 = reducir(en2, { tipo: "avanzar" });
    expect(en3.paso).toBe(3);
    expect(reducir(en3, { tipo: "volver" }).paso).toBe(2);
    expect(reducir(ESTADO_INICIAL, { tipo: "volver" }).paso).toBe(1);
  });

  it("del paso 3 al 4 exige que el prompt esté listo", () => {
    const en3: EstadoAsistente = { ...conBriefValido, paso: 3 };
    expect(reducir(en3, { tipo: "avanzar" }).paso).toBe(3);
    const conPrompt = reducir(en3, { tipo: "prompt", prompt: respuestaPrompt() });
    expect(reducir(conPrompt, { tipo: "avanzar" }).paso).toBe(4);
  });

  it("no se salta pasos: ir al 3 o al 4 exige los anteriores completos", () => {
    expect(reducir(ESTADO_INICIAL, { tipo: "ir", paso: 3 }).paso).toBe(1);
    expect(puedeEstarEn(conBriefValido, 3)).toBe(true);
    expect(reducir(conBriefValido, { tipo: "ir", paso: 4 }).paso).toBe(1);
    // Volver siempre se puede.
    expect(reducir({ ...conBriefValido, paso: 3 }, { tipo: "ir", paso: 1 }).paso).toBe(1);
  });

  it("editar el brief, las técnicas o la semilla invalida el prompt y el mejorado", () => {
    const listo = reducir({ ...conBriefValido, paso: 3 }, { tipo: "prompt", prompt: respuestaPrompt() });
    const mejorado = reducir(listo, { tipo: "usar-mejorado", prompt: listo.prompt!.prompt });
    expect(promptEfectivo(mejorado)).toBe(listo.prompt!.prompt);
    const acciones: Accion[] = [
      { tipo: "editar-brief", cambios: { nombre: "Otro" } },
      { tipo: "tecnicas", tecnicas: ["semilla"] },
      { tipo: "otra-semilla", numero: 99 },
    ];
    for (const accion of acciones) {
      const s = reducir(mejorado, accion);
      expect(s.prompt, accion.tipo).toBeNull();
      expect(s.promptMejorado, accion.tipo).toBeNull();
    }
  });

  it("descartar lo mejorado vuelve al prompt generado", () => {
    const listo = reducir({ ...conBriefValido, paso: 3 }, { tipo: "prompt", prompt: respuestaPrompt() });
    const otro = { ...listo.prompt!.prompt, rol: "Rol distinto" };
    const mejorado = reducir(listo, { tipo: "usar-mejorado", prompt: otro });
    expect(promptEfectivo(mejorado)?.rol).toBe("Rol distinto");
    expect(promptEfectivo(reducir(mejorado, { tipo: "descartar-mejorado" }))?.rol).toBe(listo.prompt!.prompt.rol);
  });
});

describe("validación del brief", () => {
  it("el brief de ejemplo es válido y produce un Brief de Zod", () => {
    expect(erroresDelBrief(valido)).toEqual({});
    expect(aBrief(valido).nombre).toBe(BRIEF_EJEMPLO.nombre);
  });

  it("los 5 ejemplos del banco son válidos como borrador y no traen testimonios inventados", () => {
    for (const ejemplo of EJEMPLOS) {
      expect(erroresDelBrief(deBrief(ejemplo.brief)), ejemplo.id).toEqual({});
      expect(ejemplo.brief.pruebaSocial?.testimonios, ejemplo.id).toBeUndefined();
    }
  });

  it("cargar un ejemplo trae también sus técnicas y su semilla, e invalida el prompt", () => {
    const ejemplo = EJEMPLOS[2];
    const previo = reducir({ ...conBriefValido, paso: 3 }, { tipo: "prompt", prompt: respuestaPrompt() });
    const s = reducir(previo, { tipo: "cargar-ejemplo", brief: deBrief(ejemplo.brief), tecnicas: ejemplo.tecnicas, numeroSemilla: ejemplo.numeroSemilla });
    expect(s.tecnicas).toEqual(ejemplo.tecnicas);
    expect(s.numeroSemilla).toBe(ejemplo.numeroSemilla);
    expect(s.prompt).toBeNull();
  });

  it("un brief vacío marca los obligatorios con mensajes en español", () => {
    const e = erroresDelBrief(BORRADOR_VACIO);
    expect(e.nombre).toMatch(/nombre del producto/);
    expect(e.categoria).toMatch(/categoría/);
    expect(e.problema).toBeTruthy();
    expect(e.publico).toBeTruthy();
    expect(e["precio.valor"]).toMatch(/precio/i);
    expect(e["beneficios.0"]).toMatch(/beneficio/i);
    for (const mensaje of Object.values(e)) expect(mensaje).not.toMatch(/invalid|expected|required/i);
  });

  it("pide entre 3 y 5 beneficios", () => {
    expect(erroresDelBrief({ ...valido, beneficios: ["a", "b"] }).beneficios).toMatch(/entre 3 y 5/);
    expect(erroresDelBrief({ ...valido, beneficios: ["a", "b", "c", "d", "e", "f"] }).beneficios).toMatch(/entre 3 y 5/);
  });

  it("la oferta exige una fecha futura", () => {
    const ahora = Date.parse("2026-06-01T12:00:00Z");
    const base = { ...valido, ofertaActiva: true, ofertaDescripcion: "Envío gratis" };
    expect(erroresDelBrief({ ...base, ofertaFecha: "" }, ahora)["oferta.fechaFin"]).toBeTruthy();
    expect(erroresDelBrief({ ...base, ofertaFecha: "2020-01-01T10:00" }, ahora)["oferta.fechaFin"]).toMatch(/futura/);
    expect(erroresDelBrief({ ...base, ofertaFecha: "2027-01-01T10:00" }, ahora)).toEqual({});
  });

  it("el precio anterior debe ser mayor que el actual", () => {
    expect(erroresDelBrief({ ...valido, precioAnterior: "100" })["precio.anterior"]).toMatch(/mayor/);
    expect(erroresDelBrief({ ...valido, precioAnterior: "200000" })).toEqual({});
  });

  it("acepta precios con separador de miles y coma decimal", () => {
    expect(aBrief({ ...valido, precio: "129.000" }).precio.valor).toBe(129000);
    expect(aBrief({ ...valido, precio: "19,5", moneda: "USD" }).precio.valor).toBe(19.5);
  });

  it("los testimonios incompletos se marcan y los vacíos se ignoran", () => {
    const incompleto = { ...valido, testimonios: [{ nombre: "Ana", ciudad: "", texto: "", estrellas: "" }] };
    expect(Object.keys(erroresDelBrief(incompleto)).some((k) => k.startsWith("pruebaSocial.testimonios"))).toBe(true);
    const vacio = { ...valido, testimonios: [{ nombre: "", ciudad: "", texto: "", estrellas: "" }] };
    expect(erroresDelBrief(vacio)).toEqual({});
    expect(aBrief(vacio).pruebaSocial).toBeUndefined();
  });
});

describe("persistencia en sessionStorage", () => {
  function simularAlmacen() {
    const datos = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => void datos.set(k, v),
      removeItem: (k: string) => void datos.delete(k),
    });
    return datos;
  }

  it("guarda y recupera el estado", () => {
    const datos = simularAlmacen();
    guardarSesion({ ...conBriefValido, paso: 2, tecnicas: ["semilla"] });
    expect(datos.has(CLAVE_SESION)).toBe(true);
    const leido = leerSesion();
    expect(leido?.paso).toBe(2);
    expect(leido?.tecnicas).toEqual(["semilla"]);
    expect(leido?.brief.nombre).toBe(valido.nombre);
  });

  it("no revienta si el almacenamiento falla o trae basura", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(() => guardarSesion(ESTADO_INICIAL)).not.toThrow();
    expect(leerSesion()).toBeNull();

    vi.stubGlobal("sessionStorage", { getItem: () => "{no es json", setItem: () => {}, removeItem: () => {} });
    expect(leerSesion()).toBeNull();
  });
});
