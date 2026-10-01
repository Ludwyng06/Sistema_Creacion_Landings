// «Descargar HTML» (§12.1 del v2): un solo archivo autónomo con la landing ya renderizada por el servidor.
//  · el CSS va en línea (<style>), con las rutas de las fuentes locales y de las imágenes convertidas a URL absolutas;
//  · las fuentes de la landing siguen por link a Google Fonts;
//  · las imágenes usan la URL absoluta del servidor (sin el optimizador de Next);
//  · no lleva JavaScript: la página que sale del servidor ya está completa.
// Son funciones puras sobre el texto del HTML para poder probarlas sin servidor.

/** Direcciones de las hojas de estilo de la aplicación que hay que incrustar. */
export function hojasDeEstilo(html: string): string[] {
  const salida: string[] = [];
  for (const etiqueta of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/rel="stylesheet"/i.test(etiqueta)) continue;
    const href = atributo(etiqueta, "href");
    if (href && !/^https?:\/\//i.test(href)) salida.push(href);
  }
  return [...new Set(salida)];
}

function atributo(etiqueta: string, nombre: string): string | null {
  const m = new RegExp(`\\s${nombre}="([^"]*)"`, "i").exec(etiqueta);
  return m ? m[1].replace(/&amp;/g, "&") : null;
}

const quitarAtributo = (etiqueta: string, nombre: string) => etiqueta.replace(new RegExp(`\\s${nombre}="[^"]*"`, "gi"), "");

/** Convierte una dirección de la página en absoluta respecto del servidor; `/_next/image?url=…` vuelve a la imagen original. */
export function urlAbsoluta(valor: string, origen: string): string {
  const v = valor.replace(/&amp;/g, "&");
  if (/^(https?:|data:|mailto:|tel:|#|\/\/)/i.test(v)) return v;
  if (v.startsWith("/_next/image")) {
    const original = new URL(v, origen).searchParams.get("url");
    if (original) return urlAbsoluta(original, origen);
  }
  return new URL(v, origen).href;
}

/** Reescribe los `url(...)` de una hoja de estilo para que apunten al servidor, sea cual sea el archivo que la abra. */
export function absolutizarCss(css: string, urlHoja: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (todo, comilla: string, ruta: string) => {
    if (/^(data:|https?:|#|\/\/)/i.test(ruta)) return todo;
    return `url(${comilla}${new URL(ruta, urlHoja).href}${comilla})`;
  });
}

/**
 * Empaqueta el HTML de `/l/<slug>` en un solo archivo. `hojas` trae el texto de cada hoja de estilo, por la misma
 * dirección con la que aparece en el HTML.
 */
export function empaquetarHtml(html: string, origen: string, hojas: ReadonlyMap<string, string>): string {
  let salida = html;

  // Sin JavaScript: fuera los scripts y las precargas.
  salida = salida.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  salida = salida.replace(/<link\b[^>]*>/gi, (etiqueta) => {
    if (/rel="(preload|modulepreload|prefetch|dns-prefetch)"/i.test(etiqueta) && !/fonts\.g(static|oogleapis)/i.test(etiqueta)) return "";
    if (/rel="stylesheet"/i.test(etiqueta)) {
      const href = atributo(etiqueta, "href") ?? "";
      if (/fonts\.googleapis\.com/i.test(href)) return `<link rel="stylesheet" href="${href.replace(/&/g, "&amp;")}"/>`;
      const css = hojas.get(href);
      if (css === undefined) return "";
      // `</style` dentro del CSS cerraría la etiqueta antes de tiempo.
      return `<style>${absolutizarCss(css, new URL(href, origen).href).replace(/<\/style/gi, "<\\/style")}</style>`;
    }
    return etiqueta;
  });

  // La hoja de fuentes de la landing se carga con `media="print"` y un `onload`; aquí va directa, sin scripts.
  salida = salida.replace(/<noscript>\s*(<link\b[^>]*fonts\.googleapis[^>]*>)\s*<\/noscript>/gi, "");

  // Imágenes y videos: URL absoluta del servidor, una sola fuente (sin srcset del optimizador).
  salida = salida.replace(/<(img|source|video)\b[^>]*>/gi, (etiqueta) => {
    let e = quitarAtributo(quitarAtributo(etiqueta, "srcSet"), "sizes");
    e = e.replace(/\s(src|poster)="([^"]*)"/gi, (_t, nombre: string, valor: string) => ` ${nombre}="${urlAbsoluta(valor, origen)}"`);
    return e;
  });

  // Enlaces y formularios de la propia aplicación.
  salida = salida.replace(/\s(href|action)="(\/[^"/][^"]*)"/gi, (_t, nombre: string, valor: string) => ` ${nombre}="${urlAbsoluta(valor, origen)}"`);

  return salida;
}
