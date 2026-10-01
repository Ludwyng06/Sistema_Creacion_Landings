import "../ayudas-db"; // primero: fija DATABASE_URL y MEDIA_DIR aislados
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as ASSETS } from "@/app/api/assets/route";
import { POST as CORREGIR } from "@/app/api/corregir/route";
import { POST as LEADS } from "@/app/api/leads/route";
import { GET as LANDINGS_GET, POST as LANDINGS_POST } from "@/app/api/landings/route";
import { DELETE, GET, PATCH } from "@/app/api/landings/[id]/route";
import { POST as BANCO } from "@/app/api/landings/[id]/banco/route";
import { GET as LEADS_GET } from "@/app/api/landings/[id]/leads/route";
import { GET as LEADS_CSV } from "@/app/api/landings/[id]/leads.csv/route";
import { POST as REGENERAR } from "@/app/api/landings/[id]/regenerar-seccion/route";
import { GET as VERSIONES_GET, POST as VERSIONES_POST } from "@/app/api/landings/[id]/versiones/route";
import { POST as RESTAURAR } from "@/app/api/landings/[id]/versiones/[versionId]/restaurar/route";
import { POST as MEJORAR } from "@/app/api/mejorar-prompt/route";
import { POST as OBJECIONES } from "@/app/api/objeciones/route";
import { reiniciarLimites } from "@/app/api/_leads";
import { fijarDepsEnrutador } from "@/lib/ia/deps";
import type { ProveedorIA, RegistradorUso } from "@/lib/ia/tipos";
import { combinar } from "@/lib/tecnicas/combinador";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const prompt = combinar(briefCorrector, []);
const doc = () => structuredClone(landingEjemplo);

const req = (cuerpo?: unknown, url = "http://localhost/x") =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
const ctx = (id: string, versionId?: string) => ({ params: Promise.resolve({ id, versionId: versionId ?? "" }) });

async function crear(d = doc()) {
  const res = await LANDINGS_POST(req({ brief: briefCorrector, tecnicas: ["semilla"], prompt, doc: d, proveedor: "gemini" }));
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; slug: string; doc: ReturnType<typeof doc> };
}

function simular(datos: unknown) {
  const p: ProveedorIA = {
    id: "gemini",
    disponible: () => true,
    generarJSON: async () => ({ datos: datos as never, proveedor: "gemini", modelo: "sim", ms: 1 }),
  };
  const registrarUso: RegistradorUso = async () => {};
  fijarDepsEnrutador({ proveedores: [p], registrarUso, modo: "cascada" });
}

beforeEach(() => {
  reiniciarLimites();
  fijarDepsEnrutador(undefined);
});

describe("landings: CRUD, slug y versiones", () => {
  it("crea con versión inicial, slug único con sufijo, puntaje y prompt en texto", async () => {
    const d = doc();
    d.critica = { puntaje: 8.2, porCriterio: [], problemas: [], correcciones: [] };
    const a = await crear(d);
    const b = await crear();
    expect(a.slug).toBe("corrector-postura-bauhaus");
    expect(b.slug).toBe("corrector-postura-bauhaus-2");
    expect(b.doc.meta.slug).toBe("corrector-postura-bauhaus-2");
    const completa = await (await GET(req(), ctx(a.id))).json();
    expect(completa.puntaje).toBe(8.2);
    expect(completa.prompt).toContain("### ROL");
    expect(completa.promptBloques.rol).toBe(prompt.rol);
    const { versiones } = await (await VERSIONES_GET(req(), ctx(a.id))).json();
    expect(versiones.map((v: { nota: string }) => v.nota)).toEqual(["Generada por IA"]);
  });

  it("lista con filtros, PATCH nombre y favorita, DELETE en cascada y 404", async () => {
    const a = await crear();
    await PATCH(req({ favorita: true }), ctx(a.id));
    await PATCH(req({ nombre: "Nombre nuevo" }), ctx(a.id));
    const url = (q: string) => new Request(`http://localhost/api/landings?${q}`);
    const fav = await (await LANDINGS_GET(url("favoritas=true"))).json();
    expect(fav.landings.some((l: { id: string; nombre: string; doc?: unknown }) => l.id === a.id && l.nombre === "Nombre nuevo" && !("doc" in l))).toBe(true);
    const tec = await (await LANDINGS_GET(url("tecnica=semilla&estado=borrador"))).json();
    expect(tec.landings.length).toBeGreaterThan(0);
    expect((await (await LANDINGS_GET(url("tecnica=humana"))).json()).landings).toEqual([]);
    expect((await (await LANDINGS_GET(url("puntajeMin=9"))).json()).landings).toEqual([]);
    expect((await LANDINGS_GET(url("tecnica=magia"))).status).toBe(400);
    expect((await PATCH(req({}), ctx(a.id))).status).toBe(400);

    expect((await DELETE(req(), ctx(a.id))).status).toBe(200);
    expect((await GET(req(), ctx(a.id))).status).toBe(404);
    expect((await VERSIONES_GET(req(), ctx(a.id))).status).toBe(404);
  });

  it("POST inválido → 400 con mensaje legible", async () => {
    const res = await LANDINGS_POST(req({ brief: { nombre: "" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("brief");
    expect((await LANDINGS_POST(req("{roto"))).status).toBe(400);
  });

  it("restaurar guarda «Antes de restaurar» y vuelve al documento anterior", async () => {
    const a = await crear();
    const nuevo = doc();
    nuevo.secciones[0].ajustes.titular = "Titular cambiado a mano";
    await PATCH(req({ doc: nuevo }), ctx(a.id));
    expect((await (await VERSIONES_GET(req(), ctx(a.id))).json()).versiones).toHaveLength(1); // autoguardado no crea versión
    const v = await (await VERSIONES_POST(req({ nota: "Manual" }), ctx(a.id))).json();
    expect(v.nota).toBe("Manual");
    const { versiones } = await (await VERSIONES_GET(req(), ctx(a.id))).json();
    const inicial = versiones.find((x: { nota: string }) => x.nota === "Generada por IA");
    const restaurada = await (await RESTAURAR(req(), ctx(a.id, inicial.id))).json();
    expect(restaurada.doc.secciones[0].ajustes.titular).toBe("¿Terminas el día con la espalda cargada?");
    const despues = (await (await VERSIONES_GET(req(), ctx(a.id))).json()).versiones;
    expect(despues[0].nota).toBe("Antes de restaurar");
    expect((await RESTAURAR(req(), ctx(a.id, "no-existe"))).status).toBe(404);
  });
});

describe("editadoPorHumano y regenerar sección", () => {
  it("PATCH doc marca los textos cambiados y regenerar-seccion no los toca", async () => {
    const a = await crear();
    const editado = doc();
    editado.secciones[0].ajustes.titular = "Mi titular escrito a mano";
    const patch = await (await PATCH(req({ doc: editado }), ctx(a.id))).json();
    expect(patch.doc.secciones[0].editadoPorHumano).toEqual(["ajustes.titular"]);
    expect(patch.doc.secciones[1].editadoPorHumano).toBeUndefined();

    simular({
      ...doc().secciones[0],
      id: "otro-id",
      intencion: { objetivo: "Nueva intención del héroe" },
      ajustes: { titular: "Titular de la IA", subtitular: "Subtítulo nuevo de la IA", textoBoton: "Quiero ver cómo funciona" },
    });
    const res = await REGENERAR(req({ seccionId: "sec-heroe", instruccion: "más directo" }), ctx(a.id));
    expect(res.status).toBe(200);
    const r = await res.json();
    const heroe = r.doc.secciones[0];
    expect(heroe.id).toBe("sec-heroe");
    expect(heroe.ajustes.titular).toBe("Mi titular escrito a mano");
    expect(heroe.ajustes.subtitular).toBe("Subtítulo nuevo de la IA");
    expect(heroe.editadoPorHumano).toEqual(["ajustes.titular"]);
    const { versiones } = await (await VERSIONES_GET(req(), ctx(a.id))).json();
    expect(versiones[0].nota).toBe("Antes de regenerar heroe");
  });

  it("rechaza secciones inexistentes (404), inválidas (422) o con lista negra (422)", async () => {
    const a = await crear();
    simular(doc().secciones[0]);
    expect((await REGENERAR(req({ seccionId: "nada" }), ctx(a.id))).status).toBe(404);
    expect((await REGENERAR(req({}), ctx(a.id))).status).toBe(400);
    simular({ ...doc().secciones[0], ajustes: { titular: "", textoBoton: "Ok" } });
    expect((await REGENERAR(req({ seccionId: "sec-heroe" }), ctx(a.id))).status).toBe(422);
    simular({ ...doc().secciones[0], ajustes: { titular: "Un corrector revolucionario", textoBoton: "Ok" } });
    const mala = await REGENERAR(req({ seccionId: "sec-heroe" }), ctx(a.id));
    expect(mala.status).toBe(422);
    expect((await mala.json()).error).toContain("lista negra");
  });
});

describe("banco", () => {
  it("con salud roja → 409 y motivos; con salud limpia pasa a en-banco", async () => {
    const roto = doc();
    roto.secciones = roto.secciones.filter((s) => s.tipo !== "formulario-lead");
    const a = await crear(roto);
    const res = await BANCO(req({}), ctx(a.id));
    expect(res.status).toBe(409);
    const cuerpo = await res.json();
    expect(cuerpo.motivos[0]).toMatchObject({ validador: "estructura" });
    expect(cuerpo.motivos.length).toBeGreaterThan(0);

    const b = await crear();
    const render = { id: "anti-split-render", estado: "rojo", problemas: [{ ruta: "h1", mensaje: "Héroe split detectado" }] };
    const rojoRender = await BANCO(req({ saludRender: render }), ctx(b.id));
    expect(rojoRender.status).toBe(409);
    expect((await rojoRender.json()).motivos[0].validador).toBe("anti-split-render");
    const ok = await BANCO(req({ saludRender: { ...render, estado: "verde", problemas: [] } }), ctx(b.id));
    expect(ok.status).toBe(200);
    expect((await ok.json()).estado).toBe("en-banco");
    expect((await BANCO(req({}), ctx("no-existe"))).status).toBe(404);
  });
});

describe("leads", () => {
  const valido = { nombre: "Ana Pérez", correo: "ana@correo.co", telefono: "300 123 4567" };
  const enviar = (landingId: string, datos: Record<string, string>, extra: object = {}) => LEADS(req({ landingId, datos, ...extra }));

  it("guarda un lead válido y lo lista", async () => {
    const a = await crear();
    const res = await enviar(a.id, { ...valido, ciudad: "no está en el formulario" });
    expect(res.status).toBe(201);
    const { leads, campos } = await (await LEADS_GET(req(), ctx(a.id))).json();
    expect(campos).toEqual(["nombre", "correo", "telefono"]);
    expect(leads).toHaveLength(1);
    expect(leads[0].datos).toEqual(valido);
  });

  it("400 sin campo obligatorio, con correo o teléfono inválidos y con honeypot", async () => {
    const a = await crear();
    const sinNombre = await enviar(a.id, { correo: valido.correo, telefono: valido.telefono });
    expect(sinNombre.status).toBe(400);
    expect((await sinNombre.json()).errores[0]).toContain("nombre");
    expect((await enviar(a.id, { ...valido, correo: "no-es-correo" })).status).toBe(400);
    expect((await enviar(a.id, { ...valido, telefono: "123" })).status).toBe(400);
    expect((await enviar(a.id, { ...valido, telefono: "1".repeat(16) })).status).toBe(400);
    expect((await enviar(a.id, valido, { sitio: "http://spam.com" })).status).toBe(400);
    expect((await enviar(a.id, { ...valido, sitio: "bot" })).status).toBe(400);
    expect((await enviar("no-existe", valido)).status).toBe(404);
    expect((await LEADS(req({ landingId: a.id }))).status).toBe(400);
    expect((await (await LEADS_GET(req(), ctx(a.id))).json()).leads).toEqual([]);
  });

  it("el undécimo envío en un minuto → 429", async () => {
    const a = await crear();
    for (let i = 0; i < 10; i++) expect((await enviar(a.id, valido)).status).toBe(201);
    expect((await enviar(a.id, valido)).status).toBe(429);
    const otra = await crear();
    expect((await enviar(otra.id, valido)).status).toBe(201); // el límite es por landing
  });

  it("CSV con BOM, cabeceras fijas, comas escapadas y nombre de archivo", async () => {
    const a = await crear();
    await enviar(a.id, { nombre: "Pérez, Ana", correo: "ana@correo.co", telefono: "3001234567" });
    await enviar(a.id, { nombre: "=SUMA(1)", correo: "b@correo.co", telefono: "3001234568" });
    const res = await LEADS_CSV(req(), ctx(a.id));
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toMatch(new RegExp(`^attachment; filename="leads-${a.slug}-\\d{4}-\\d{2}-\\d{2}\\.csv"$`));
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const texto = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes).slice(1);
    const lineas = texto.split("\r\n");
    expect(lineas[0]).toBe("fecha,nombre,correo,telefono");
    expect(texto).toContain('"Pérez, Ana"');
    expect(texto).toContain("'=SUMA(1)"); // no se interpreta como fórmula en Excel
    expect(lineas).toHaveLength(3);
  });
});

describe("assets", () => {
  const subir = (campos: Record<string, string | Blob>, nombre = "foto.png", tipo = "image/png") => {
    const f = new FormData();
    for (const [k, v] of Object.entries(campos)) f.set(k, k === "archivo" ? new File([v as Blob], nombre, { type: tipo }) : (v as string));
    return ASSETS(new Request("http://localhost/api/assets", { method: "POST", body: f }));
  };
  const png = () => sharp({ create: { width: 400, height: 200, channels: 3, background: "#cc3300" } }).png().toBuffer();

  it("convierte un PNG a WebP recortado a la relación del slot y actualiza el doc", async () => {
    const a = await crear();
    const res = await subir({ landingId: a.id, slot: "oferta-producto", archivo: new Blob([new Uint8Array(await png())]) });
    expect(res.status).toBe(201);
    const { ruta } = await res.json();
    expect(ruta).toBe(`/media/${a.id}/oferta-producto.webp`);
    const archivo = join(process.env.MEDIA_DIR!, a.id, "oferta-producto.webp");
    expect(existsSync(archivo)).toBe(true);
    const meta = await sharp(archivo).metadata();
    expect(meta.format).toBe("webp");
    expect([meta.width, meta.height]).toEqual([160, 200]); // 4:5 recortado del 400×200
    const guardado = await (await GET(req(), ctx(a.id))).json();
    expect(guardado.doc.assets[0].ruta).toBe(ruta);
  });

  it("acepta mp4 y rechaza slots con «..» o «/», formatos y archivos dañados (400)", async () => {
    const a = await crear();
    const mp4 = await subir({ landingId: a.id, slot: "clip", archivo: new Blob([new Uint8Array([0, 0, 0, 24])]) }, "c.mp4", "video/mp4");
    expect(mp4.status).toBe(201);
    expect((await mp4.json()).ruta).toBe(`/media/${a.id}/clip.mp4`);
    const buffer = new Blob([new Uint8Array(await png())]);
    for (const slot of ["../x", "a/b", "..", ""]) {
      expect((await subir({ landingId: a.id, slot, archivo: buffer })).status, slot).toBe(400);
    }
    expect((await subir({ landingId: a.id, slot: "x", archivo: new Blob(["hola"]) }, "a.txt", "text/plain")).status).toBe(400);
    expect((await subir({ landingId: a.id, slot: "x", archivo: new Blob(["no es imagen"]) })).status).toBe(400);
    expect((await subir({ landingId: a.id, slot: "x" })).status).toBe(400);
    expect((await subir({ landingId: "no-existe", slot: "x", archivo: buffer })).status).toBe(404);
  });
});

describe("IA: corregir, mejorar-prompt y objeciones", () => {
  it("/api/corregir corrige lo que no es de la persona y reporta pendientes", async () => {
    const d = doc();
    d.secciones[1].ajustes.historia = "Una historia increíble sobre tu espalda.";
    d.secciones[0].ajustes.subtitular = "Un aviso revolucionario";
    d.secciones[0].editadoPorHumano = ["ajustes.subtitular"];
    const a = await crear(d);
    simular({ correcciones: [{ ruta: "secciones[1].ajustes.historia", texto: "Una historia real sobre tu espalda." }] });
    const res = await CORREGIR(req({ landingId: a.id }));
    expect(res.status).toBe(200);
    const r = await res.json();
    expect(r.corregidas).toBe(1);
    expect(r.doc.secciones[1].ajustes.historia).toBe("Una historia real sobre tu espalda.");
    expect(r.doc.secciones[0].ajustes.subtitular).toBe("Un aviso revolucionario");
    expect(r.pendientes.map((p: { ruta: string }) => p.ruta)).toEqual(["secciones[0].ajustes.subtitular"]);
    expect((await (await GET(req(), ctx(a.id))).json()).doc.secciones[1].ajustes.historia).toBe("Una historia real sobre tu espalda.");
    expect((await CORREGIR(req({}))).status).toBe(400);
    expect((await CORREGIR(req({ landingId: "no-existe" }))).status).toBe(404);
  });

  const limpio = { ...prompt, rol: "Eres editor de prompts.", tarea: "1. Redacta cada paso con un verbo concreto.", contexto: "Ejemplo: «Quiero el mío».", formato: "Entrega el JSON." };

  it("/api/mejorar-prompt mantiene los 4 bloques y los aportes", async () => {
    simular({ prompt: { ...limpio, aportes: [] }, cambios: ["Tarea más específica", "Ejemplo few-shot añadido"] });
    const res = await MEJORAR(req({ prompt }));
    expect(res.status).toBe(200);
    const r = await res.json();
    expect(r.prompt.rol).toBe("Eres editor de prompts.");
    expect(r.prompt.aportes).toEqual(prompt.aportes);
    expect(r.cambios).toHaveLength(2);
  });

  it("/api/mejorar-prompt rechaza bloques vacíos o con lista negra (422) y entradas inválidas (400)", async () => {
    simular({ prompt: { ...limpio, tarea: "  ", aportes: [] }, cambios: [] });
    expect((await MEJORAR(req({ prompt }))).status).toBe(422);
    simular({ prompt: { ...limpio, rol: "Eres un experto innovador.", aportes: [] }, cambios: [] });
    expect((await MEJORAR(req({ prompt }))).status).toBe(422);
    expect((await MEJORAR(req({ prompt: { rol: "x" } }))).status).toBe(400);
  });

  it("/api/objeciones devuelve 5 objeciones", async () => {
    simular({ objeciones: ["¿Se nota?", "¿Dura?", "¿Es cómodo?", "¿Cuánto tarda el envío?", "¿Puedo devolverlo?", "Sobra una"] });
    const res = await OBJECIONES(req({ brief: briefCorrector }));
    expect(res.status).toBe(200);
    expect((await res.json()).objeciones).toHaveLength(5);
    expect((await OBJECIONES(req({ brief: { nombre: "" } }))).status).toBe(400);
  });

  it("sin proveedores devuelve 503 con el prompt para el modo manual", async () => {
    fijarDepsEnrutador({ proveedores: [], registrarUso: async () => {}, modo: "cascada" });
    const res = await OBJECIONES(req({ brief: briefCorrector }));
    expect(res.status).toBe(503);
    expect((await res.json()).promptManual.usuario).toContain("Brief");
  });
});
