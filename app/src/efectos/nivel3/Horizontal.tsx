"use client";

import type { ReactNode } from "react";
import { Fijado } from "./Fijado";
import { recorridoHorizontal } from "./progreso";

/** La lista de tarjetas más numerosa de la sección (galería, beneficios o testimonios). */
export function pistaDe(interno: HTMLElement): HTMLElement | null {
  const listas = [...interno.querySelectorAll<HTMLElement>("ul, ol")].filter((l) => l.children.length >= 2 && [...l.children].every((c) => c.tagName === "LI"));
  return listas.sort((a, b) => b.children.length - a.children.length)[0] ?? null;
}

/**
 * `horizontal`: la sección se fija y su lista de tarjetas corre de lado con el scroll. La pista se pone en una sola
 * fila y se desplaza con `translate3d` según `--p`; al terminar, se suelta.
 */
export function Horizontal({ children }: { children: ReactNode }) {
  return (
    <Fijado
      id="horizontal"
      alMontar={({ interno, fijarRecorrido, desactivar }) => {
        const pista = pistaDe(interno);
        if (!pista) {
          desactivar();
          return;
        }
        const previoInterno = interno.style.overflowX;
        const previoPista = pista.getAttribute("style");
        const tarjetas = [...pista.children] as HTMLElement[];
        const previoTarjetas = tarjetas.map((t) => t.getAttribute("style"));

        interno.style.overflowX = "clip";
        Object.assign(pista.style, {
          display: "flex",
          flexWrap: "nowrap",
          columns: "auto",
          overflow: "visible",
          width: "max-content",
          maxWidth: "none",
          gap: "1rem",
          scrollSnapType: "none",
          willChange: "transform",
        });
        tarjetas.forEach((t) => Object.assign(t.style, { flex: "none", width: "min(78vw, 24rem)", breakInside: "auto" }));

        const medir = () => {
          const izquierda = pista.getBoundingClientRect().left - interno.getBoundingClientRect().left + 20;
          const recorrido = recorridoHorizontal(pista.scrollWidth + izquierda, interno.clientWidth);
          pista.style.setProperty("--x", `${recorrido}px`);
          pista.style.transform = "translate3d(calc(var(--p) * var(--x) * -1), 0, 0)";
          fijarRecorrido(recorrido);
        };
        medir();
        window.addEventListener("resize", medir);
        return () => {
          window.removeEventListener("resize", medir);
          interno.style.overflowX = previoInterno;
          if (previoPista === null) pista.removeAttribute("style");
          else pista.setAttribute("style", previoPista);
          tarjetas.forEach((t, i) => (previoTarjetas[i] === null ? t.removeAttribute("style") : t.setAttribute("style", previoTarjetas[i]!)));
        };
      }}
    >
      {children}
    </Fijado>
  );
}
