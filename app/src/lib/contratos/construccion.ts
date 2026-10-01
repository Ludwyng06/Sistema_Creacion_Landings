import { z } from "zod";
import { Brief } from "./brief";
import type { TareaIA } from "./ia";
import { Critica, type LandingDoc } from "./landing";
import { PromptEstructurado, TecnicaId } from "./tecnicas";

// Contrato de construcción (docs/bitacora/tarea-03-A.md §0). El paso 4 de /crear lo consume.

export type IdValidador =
  | "esquema"
  | "estructura"
  | "anti-split"
  | "anti-split-render"
  | "lista-negra"
  | "datos"
  | "a11y"
  | "efectos";

export type EstadoSalud = "verde" | "amarillo" | "rojo" | "pendiente";

export interface ResultadoValidador {
  id: IdValidador;
  estado: EstadoSalud;
  problemas: { ruta: string; mensaje: string }[];
}

export type EventoConstruccion =
  | {
      tipo: "tarea";
      tarea: TareaIA;
      estado: "en-curso" | "ok" | "error" | "omitida";
      proveedor?: string;
      ms?: number;
      mensaje?: string;
    }
  | {
      tipo: "resultado";
      doc: LandingDoc;
      salud: ResultadoValidador[];
      vueltasCritico: number;
      proveedores: Partial<Record<TareaIA, string>>;
      avisos: string[];
    }
  | {
      tipo: "manual";
      prompt: { sistema: string; usuario: string };
      intentos: { proveedor: string; tipo: string; mensaje: string }[];
    }
  | { tipo: "error"; mensaje: string };

export const PeticionConstruir = z.object({
  brief: Brief,
  tecnicas: z.array(TecnicaId),
  numeroSemilla: z.number().int().optional(),
  prompt: PromptEstructurado.optional(),
});
export type PeticionConstruir = z.infer<typeof PeticionConstruir>;

// ---------- Modo duelo (docs/07 §6) ----------

export type Lado = "a" | "b";

export type LadoDuelo = Omit<Extract<EventoConstruccion, { tipo: "resultado" }>, "tipo"> & { proveedorLanding: string };

export const JuezDuelo = z.object({
  a: Critica,
  b: Critica,
  ganador: z.enum(["a", "b", "empate"]),
  razon: z.string().min(1),
});
export type JuezDuelo = z.infer<typeof JuezDuelo>;

export type EventoDuelo =
  | (EventoConstruccion & { lado: Lado | "juez" })
  | {
      tipo: "duelo";
      a: LadoDuelo | null;
      b: LadoDuelo | null;
      juez: JuezDuelo | null;
      ganador: Lado | "empate";
      proveedores: { a: string; b: string; juez?: string };
      avisos: string[];
    };
