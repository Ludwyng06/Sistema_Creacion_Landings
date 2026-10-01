import DOMPurify from "isomorphic-dompurify";

/** Deja solo HTML seguro: sin scripts, iframes, formularios ni atributos de eventos. */
export function sanitizarHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "iframe", "object", "embed", "link", "meta", "base"],
    FORBID_ATTR: ["style"],
  });
}
