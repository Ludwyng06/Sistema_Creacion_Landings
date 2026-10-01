import type { ComponentType, ReactNode } from "react";
import type { EfectoId } from "@/lib/contratos";
import { AntesDespuesScroll } from "./AntesDespuesScroll";
import { Horizontal } from "./Horizontal";
import { PinCoreografia } from "./PinCoreografia";
import { ProductoExplotado } from "./ProductoExplotado";
import { ShaderOndas } from "./ShaderOndas";
import { VideoScrollFijado } from "./VideoScrollFijado";

export const ENVOLTURAS_NIVEL_3: Partial<Record<EfectoId, ComponentType<{ children: ReactNode }>>> = {
  "video-scroll": VideoScrollFijado,
  "producto-explotado": ProductoExplotado,
  horizontal: Horizontal,
  "pin-coreografia": PinCoreografia,
  "antes-despues-scroll": AntesDespuesScroll,
  "shader-ondas": ShaderOndas,
};
