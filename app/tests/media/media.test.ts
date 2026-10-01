import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { leerRango, resolverSegura, servirMedia } from "@/lib/media/servir";

const pedir = (ruta: string[], cabeceras: Record<string, string> = {}, metodo = "GET", raiz?: string) =>
  servirMedia(new Request(`http://x/media/${ruta.join("/")}`, { method: metodo, headers: cabeceras }), ruta, raiz);

function raiz() {
  const r = mkdtempSync(join(tmpdir(), "media-"));
  mkdirSync(join(r, "vitrina", "slug"), { recursive: true });
  writeFileSync(join(r, "vitrina", "slug", "a.webp"), Buffer.from("imagen-de-prueba"));
  writeFileSync(join(r, "clip.mp4"), Buffer.from("0123456789"));
  writeFileSync(join(r, ".oculto"), "x");
  writeFileSync(join(tmpdir(), "fuera-de-media.txt"), "secreto");
  return r;
}

describe("servir /media desde el disco", () => {
  it("200 con el content-type correcto, ETag, Last-Modified y Cache-Control", async () => {
    const r = raiz();
    const res = await pedir(["vitrina", "slug", "a.webp"], {}, "GET", r);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("ETag")).toMatch(/^W\/"/);
    expect(res.headers.get("Last-Modified")).toBeTruthy();
    expect(res.headers.get("Cache-Control")).toContain("must-revalidate");
    expect(res.headers.get("Content-Length")).toBe("16");
    expect(await res.text()).toBe("imagen-de-prueba");
  });

  it("un archivo creado después se sirve sin recompilar y un cambio cambia el ETag", async () => {
    const r = raiz();
    expect((await pedir(["nuevo.png"], {}, "GET", r)).status).toBe(404);
    writeFileSync(join(r, "nuevo.png"), Buffer.from("png"));
    const a = await pedir(["nuevo.png"], {}, "GET", r);
    expect(a.status).toBe(200);
    expect(a.headers.get("Content-Type")).toBe("image/png");
    const etagA = a.headers.get("ETag");
    writeFileSync(join(r, "nuevo.png"), Buffer.from("otro-contenido-mas-largo"));
    utimesSync(join(r, "nuevo.png"), new Date(), new Date(Date.now() + 5000));
    expect((await pedir(["nuevo.png"], {}, "GET", r)).headers.get("ETag")).not.toBe(etagA);
  });

  it("304 con If-None-Match", async () => {
    const r = raiz();
    const etag = (await pedir(["vitrina", "slug", "a.webp"], {}, "GET", r)).headers.get("ETag")!;
    const res = await pedir(["vitrina", "slug", "a.webp"], { "If-None-Match": etag }, "GET", r);
    expect(res.status).toBe(304);
    expect(await res.text()).toBe("");
  });

  it("Range para videos: 206 con Content-Range, sufijo, rango abierto y 416", async () => {
    const r = raiz();
    const a = await pedir(["clip.mp4"], { Range: "bytes=2-5" }, "GET", r);
    expect(a.status).toBe(206);
    expect(a.headers.get("Content-Range")).toBe("bytes 2-5/10");
    expect(a.headers.get("Content-Type")).toBe("video/mp4");
    expect(await a.text()).toBe("2345");
    expect(await (await pedir(["clip.mp4"], { Range: "bytes=7-" }, "GET", r)).text()).toBe("789");
    expect(await (await pedir(["clip.mp4"], { Range: "bytes=-3" }, "GET", r)).text()).toBe("789");
    expect((await pedir(["clip.mp4"], { Range: "bytes=50-60" }, "GET", r)).status).toBe(416);
    expect((await pedir(["clip.mp4"], {}, "GET", r)).headers.get("Accept-Ranges")).toBe("bytes");
    expect(leerRango("bytes=0-0", 10)).toEqual({ inicio: 0, fin: 0 });
    expect(leerRango(null, 10)).toBeNull();
    expect(leerRango("items=1-2", 10)).toBe("invalido");
  });

  it("HEAD no trae cuerpo", async () => {
    const r = raiz();
    const res = await pedir(["clip.mp4"], {}, "HEAD", r);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    expect(res.headers.get("Content-Length")).toBe("10");
  });

  it("protección contra recorrido de rutas: .., %2e%2e, barras, nulos, ocultos y rutas vacías dan 404 limpio", async () => {
    const r = raiz();
    for (const seg of [[".."], ["..", "fuera-de-media.txt"], ["%2e%2e", "fuera-de-media.txt"], ["vitrina", "..", "..", "fuera-de-media.txt"], ["a%2F..%2F..%2Fx"], ["a%5C..%5Cx"], ["x%00.webp"], [".oculto"], [""], []]) {
      const res = await pedir(seg, {}, "GET", r);
      expect(res.status, JSON.stringify(seg)).toBe(404);
      expect(await res.text()).not.toContain("secreto");
    }
    expect((await pedir(["vitrina"], {}, "GET", r)).status).toBe(404); // una carpeta no es un archivo
    expect(resolverSegura(r, ["vitrina", "slug", "a.webp"])).toContain("a.webp");
    expect(resolverSegura(r, ["%E0%A4%A"])).toBeNull();
  });
});
