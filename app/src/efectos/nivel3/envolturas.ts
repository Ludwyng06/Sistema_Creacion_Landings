import dynamic from "next/dynamic";
import type { ComponentType, ReactNode } from "react";
import type { EfectoId } from "@/lib/contratos";

type Envoltura = ComponentType<{ children: ReactNode }>;

// Cada efecto se carga solo en las landings que lo usan (ShaderOndas trae `ogl`). Sigue renderizándose en el servidor.
// `envolturas-sync.ts` es la misma tabla con importación directa; los tests la usan (alias en `vitest.config.mts`).
const cargar = (modulo: () => Promise<Record<string, unknown>>, nombre: string) =>
  dynamic(() => modulo().then((m) => m[nombre] as Envoltura)) as Envoltura;

/** Los 6 efectos de nivel 3 y el componente que envuelve la sección donde se activan. */
export const ENVOLTURAS_NIVEL_3: Partial<Record<EfectoId, Envoltura>> = {
  "video-scroll": cargar(() => import("./VideoScrollFijado"), "VideoScrollFijado"),
  "producto-explotado": cargar(() => import("./ProductoExplotado"), "ProductoExplotado"),
  horizontal: cargar(() => import("./Horizontal"), "Horizontal"),
  "pin-coreografia": cargar(() => import("./PinCoreografia"), "PinCoreografia"),
  "antes-despues-scroll": cargar(() => import("./AntesDespuesScroll"), "AntesDespuesScroll"),
  "shader-ondas": cargar(() => import("./ShaderOndas"), "ShaderOndas"),
};
