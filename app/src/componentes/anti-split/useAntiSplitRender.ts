"use client";

import { useEffect } from "react";
import { MSG_ANTI_SPLIT, validarAntiSplitRender, type ResultadoAntiSplit } from "@/lib/validadores/anti-split-render";

const ESPERA_MS = 200;

/**
 * Corre el validador anti-split (render) dentro del iframe de la vista previa: mide con `getBoundingClientRect`
 * cuando cambia el documento, el tamaño o cargan las imágenes, y avisa a la ventana padre solo si el iframe
 * mide ≥ 1024 px (por debajo el validador no aplica y no dice nada).
 */
export function useAntiSplitRender(claveDelDocumento: unknown): void {
  useEffect(() => {
    if (window.parent === window) return;
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let ultimo = "";

    const medir = () => {
      temporizador = null;
      if (!document.querySelector("[data-seccion-id]")) return; // aún no se pintó la landing
      const resultado: ResultadoAntiSplit = validarAntiSplitRender(document);
      if (!resultado.aplica && resultado.motivo === "ancho") return;
      const huella = JSON.stringify(resultado);
      if (huella === ultimo) return;
      ultimo = huella;
      window.parent.postMessage({ tipo: MSG_ANTI_SPLIT, resultado }, window.location.origin);
    };
    const programar = () => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(medir, ESPERA_MS);
    };

    programar();
    const observador = typeof ResizeObserver !== "undefined" ? new ResizeObserver(programar) : null;
    observador?.observe(document.body);
    window.addEventListener("resize", programar);
    document.addEventListener("load", programar, true); // imágenes y videos que terminan de cargar
    return () => {
      if (temporizador) clearTimeout(temporizador);
      observador?.disconnect();
      window.removeEventListener("resize", programar);
      document.removeEventListener("load", programar, true);
    };
  }, [claveDelDocumento]);
}
