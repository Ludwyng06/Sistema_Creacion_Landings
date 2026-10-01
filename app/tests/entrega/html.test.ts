import { describe, expect, it } from "vitest";
import { absolutizarCss, empaquetarHtml, hojasDeEstilo, urlAbsoluta } from "@/lib/entrega/html";

const ORIGEN = "http://localhost:3000";

const PAGINA = `<!DOCTYPE html><html lang="es"><head><meta charSet="utf-8"/><title>Timbre</title>
<link rel="preload" as="image" imageSrcSet="/_next/image?url=%2Fmedia%2Fa.webp&amp;w=640&amp;q=75 640w"/>
<link rel="stylesheet" href="/_next/static/chunks/abc.css" data-precedence="next"/>
<link rel="preload" as="script" href="/_next/static/chunks/x.js"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&amp;display=swap" media="print" onLoad="this.media='all'"/>
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&amp;display=swap"/></noscript>
<script src="/_next/static/chunks/y.js" async=""></script></head>
<body><h1>Mira quién llega</h1>
<img alt="Timbre" loading="lazy" sizes="100vw" srcSet="/_next/image?url=%2Fmedia%2Fvitrina%2Ftimbre%2Fa.webp&amp;w=640&amp;q=75 640w, /_next/image?url=%2Fmedia%2Fvitrina%2Ftimbre%2Fa.webp&amp;w=3840&amp;q=75 3840w" src="/_next/image?url=%2Fmedia%2Fvitrina%2Ftimbre%2Fa.webp&amp;w=3840&amp;q=75"/>
<video src="/media/v.mp4" poster="/media/p.webp"></video>
<a href="/crear">Crear</a><a href="#faq">Preguntas</a><a href="https://wa.me/57300">WhatsApp</a>
<script>self.__next_f.push([1,"datos"])</script></body></html>`;

const CSS = `@font-face{font-family:x;src:url(/_next/static/media/f.woff2) format("woff2")}.a{background:url(../media/b.png)}.b{background:url(data:image/png;base64,AAA)}`;

describe("descargar HTML: empaquetado", () => {
  const hojas = new Map([["/_next/static/chunks/abc.css", CSS]]);
  const html = empaquetarHtml(PAGINA, ORIGEN, hojas);

  it("encuentra las hojas de estilo de la aplicación y no las de Google", () => {
    expect(hojasDeEstilo(PAGINA)).toEqual(["/_next/static/chunks/abc.css"]);
  });

  it("no deja JavaScript ni precargas del optimizador", () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/rel="preload"/i);
    expect(html).not.toMatch(/onLoad/i);
    expect(html).not.toContain("self.__next_f");
  });

  it("incrusta el CSS en línea con las rutas absolutas del servidor", () => {
    expect(html).toContain("<style>");
    expect(html).not.toMatch(/<link[^>]*abc\.css/);
    expect(html).toContain(`url(${ORIGEN}/_next/static/media/f.woff2)`);
    expect(html).toContain(`url(${ORIGEN}/_next/static/media/b.png)`);
    expect(html).toContain("url(data:image/png;base64,AAA)");
  });

  it("las fuentes de la landing siguen por link a Google Fonts, sin depender de un script", () => {
    expect(html).toContain('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&amp;display=swap"/>');
    expect(html).not.toMatch(/media="print"/);
  });

  it("las imágenes y el video usan la URL absoluta del servidor, sin srcset del optimizador", () => {
    expect(html).toContain(`src="${ORIGEN}/media/vitrina/timbre/a.webp"`);
    expect(html).not.toMatch(/srcSet|sizes=|_next\/image/i);
    expect(html).toContain(`src="${ORIGEN}/media/v.mp4"`);
    expect(html).toContain(`poster="${ORIGEN}/media/p.webp"`);
  });

  it("los enlaces de la aplicación quedan absolutos y los externos o de ancla no cambian", () => {
    expect(html).toContain(`href="${ORIGEN}/crear"`);
    expect(html).toContain('href="#faq"');
    expect(html).toContain('href="https://wa.me/57300"');
  });

  it("el texto de la landing se conserva", () => {
    expect(html).toContain("<h1>Mira quién llega</h1>");
  });

  it("un CSS que contiene </style no rompe el archivo", () => {
    const r = empaquetarHtml('<link rel="stylesheet" href="/a.css"/>', ORIGEN, new Map([["/a.css", "a::after{content:'</style>'}"]]));
    expect(r.match(/<\/style>/g)).toHaveLength(1);
  });
});

describe("direcciones", () => {
  it("urlAbsoluta", () => {
    expect(urlAbsoluta("/media/a.webp", ORIGEN)).toBe(`${ORIGEN}/media/a.webp`);
    expect(urlAbsoluta("/_next/image?url=%2Fmedia%2Fa.webp&amp;w=640&amp;q=75", ORIGEN)).toBe(`${ORIGEN}/media/a.webp`);
    expect(urlAbsoluta("https://x.co/a.jpg", ORIGEN)).toBe("https://x.co/a.jpg");
    expect(urlAbsoluta("data:image/png;base64,AA", ORIGEN)).toBe("data:image/png;base64,AA");
  });

  it("absolutizarCss resuelve las rutas relativas contra la hoja", () => {
    expect(absolutizarCss("a{b:url('../media/x.png')}", `${ORIGEN}/_next/static/chunks/a.css`)).toBe(`a{b:url('${ORIGEN}/_next/static/media/x.png')}`);
  });
});
