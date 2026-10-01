"use client";

import { useLayoutEffect, useRef } from "react";
import type { Seccion } from "@/lib/contratos";
import { fontSizeDeBloque, leerPresentacion } from "@/secciones/presentacion";

// Sin importar los schemas (zod pesa ~90 KB y esta pieza viaja en la página pública): la ruta se resuelve a mano.
const compactar = (t: string) => t.replace(/\s+/g, " ").trim();

/** Texto guardado en la ruta de un campo (`ajustes.titulo` o `bloques.<id>.texto`), o `null`. */
export function textoDeRuta(seccion: Seccion, ruta: string): string | null {
  const partes = ruta.split(".");
  const valor = partes[0] === "ajustes" && partes.length === 2 ? seccion.ajustes[partes[1]] : partes[0] === "bloques" && partes.length === 3 ? seccion.bloques.find((b) => b.id === partes[1])?.ajustes[partes[2]] : undefined;
  return typeof valor === "string" && valor.trim() ? valor : null;
}

/** El texto que se ve en un elemento (en los titulares cinéticos, la copia para lectores de pantalla). */
export function textoVisible(el: Element): string {
  const cinetico = el.matches('[data-efecto="titular-cinetico"]') ? el : el.querySelector(':scope > [data-efecto="titular-cinetico"]');
  return compactar((cinetico?.querySelector(":scope > .sr-only") ?? el).textContent ?? "");
}

/** El elemento más profundo de `raiz` cuyo texto visible es justo `texto`. */
export function elementoConTexto(raiz: Element, texto: string): HTMLElement | null {
  const objetivo = compactar(texto);
  const candidatos = [...raiz.querySelectorAll<HTMLElement>("*")].filter((el) => textoVisible(el) === objetivo && !el.closest("[data-editor-capa]"));
  // Se prefiere la etiqueta de texto (h1, p, li…) antes que un `span` interno (los titulares cinéticos tienen uno con el
  // mismo texto): el tamaño va en quien lo declara, y los hijos lo heredan.
  const DE_TEXTO = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "LI", "BLOCKQUOTE", "FIGCAPTION", "SUMMARY", "DT", "DD", "A", "BUTTON", "LABEL"]);
  return candidatos.find((el) => DE_TEXTO.has(el.tagName)) ?? candidatos.at(-1) ?? null;
}

/**
 * Aplica los tamaños de letra por bloque de texto (`presentacion.tamanos`): cada ruta (`ajustes.titulo`,
 * `bloques.<id>.texto`) se busca por su texto dentro de la sección y recibe un `font-size` con `clamp()` alrededor de su
 * tamaño base. Sin cambios guardados no hace nada.
 */
export function TamanosDeBloque({ seccion, children }: { seccion: Seccion; children: React.ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);
  const tamanos = leerPresentacion(seccion.ajustes).tamanos;
  const huella = JSON.stringify(tamanos);

  // Sin lista de dependencias: el contenido de la sección puede cambiar (textos, variante) y hay que volver a buscarlo.
  useLayoutEffect(() => {
    const raiz = caja.current;
    if (!raiz) return;
    for (const previo of raiz.querySelectorAll<HTMLElement>("[data-tam-bloque]")) {
      previo.style.removeProperty("font-size");
      previo.removeAttribute("data-tam-bloque");
    }
    if (huella === "{}") return;
    for (const [ruta, paso] of Object.entries(tamanos)) {
      const texto = textoDeRuta(seccion, ruta);
      const el = texto ? elementoConTexto(raiz, texto) : null;
      if (!el) continue;
      const base = parseFloat(getComputedStyle(el).fontSize);
      if (!Number.isFinite(base)) continue;
      el.style.fontSize = fontSizeDeBloque(base, paso);
      el.setAttribute("data-tam-bloque", String(paso));
    }
  });

  return (
    <div ref={caja} className="contents">
      {children}
    </div>
  );
}
