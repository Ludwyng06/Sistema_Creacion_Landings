import { z } from "zod";
import type { Brief } from "./brief";
import type { LandingDoc } from "./landing";

export const TECNICAS_ID = [
  "semilla",
  "ambicioso",
  "critico",
  "imagenes",
  "video",
  "sustractivo",
  "negativas",
  "humana",
] as const;

export const TecnicaId = z.enum(TECNICAS_ID);
export type TecnicaId = z.infer<typeof TecnicaId>;

// Misma forma que `meta.semilla` del LandingDoc (docs/05 §1).
export const Semilla = z.object({
  estilo: z.string().min(1),
  industria: z.string().min(1),
  paletaId: z.string().min(1),
  tipografiaId: z.string().min(1),
  numero: z.number().int(),
});
export type Semilla = z.infer<typeof Semilla>;

export const BloquePrompt = z.enum(["rol", "tarea", "contexto", "formato"]);
export type BloquePrompt = z.infer<typeof BloquePrompt>;

export const PromptEstructurado = z.object({
  rol: z.string(),
  tarea: z.string(),
  contexto: z.string(),
  formato: z.string(),
  aportes: z.array(z.object({ tecnica: TecnicaId, bloque: BloquePrompt, texto: z.string() })),
});
export type PromptEstructurado = z.infer<typeof PromptEstructurado>;

export const ResultadoVerificacion = z.object({
  ok: z.boolean(),
  problemas: z.array(
    z.object({
      ruta: z.string(),
      mensaje: z.string(),
      severidad: z.enum(["error", "advertencia"]),
    }),
  ),
});
export type ResultadoVerificacion = z.infer<typeof ResultadoVerificacion>;

// Contrato de un módulo de técnica (docs/04 §0).
export interface ModuloTecnica {
  id: TecnicaId;
  numero: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  nombre: string;
  fase: "descubrir" | "definir" | "entregar";
  descripcionCorta: string;
  prioridad: number;
  aporta: {
    rol?: string;
    tarea?: string[];
    contexto?: string[];
    formato?: string[];
  };
  generarPromptIndividual(brief: Brief, semilla?: Semilla): PromptEstructurado;
  verificador?: (doc: LandingDoc, brief?: Brief) => ResultadoVerificacion;
}
