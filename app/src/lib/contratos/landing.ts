import { z } from "zod";
import { ColorHex, NivelConciencia } from "./brief";
import { EfectoId } from "./efectos";
import { Tematica, TipoLanding } from "./encargo";
import { FuenteMedio, LicenciaMedio } from "./medios";
import { TipoSeccion, VarianteHeroe } from "./secciones";
import { Semilla, TecnicaId } from "./tecnicas";

export const Meta = z.object({
  nombre: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "El slug debe ir en kebab-case"),
  producto: z.string().min(1),
  tecnicas: z.array(TecnicaId),
  semilla: Semilla,
  nivelConciencia: NivelConciencia,
  marco: z.enum(["AIDA", "PAS"]),
  eliminadas: z.array(z.object({ tipo: z.string(), motivo: z.string() })),
  /** Fuentes de datos y medios que usó la landing («NASA», «SerpAPI»…): /banco las muestra. Las escribe la vitrina. */
  fuentes: z.array(z.string()).optional(),
  tematica: Tematica.optional(),
  /** Tipo de landing que generó el encargo (producto, evento, divulgación…). */
  tipo: TipoLanding.optional(),
});
export type Meta = z.infer<typeof Meta>;

export const Tokens = z.object({
  colores: z.object({
    fondo: ColorHex,
    superficie: ColorHex,
    texto: ColorHex,
    textoSuave: ColorHex,
    acento: ColorHex,
    acentoTexto: ColorHex,
    borde: ColorHex,
  }),
  tipografia: z.object({
    titulos: z.string().min(1),
    cuerpo: z.string().min(1),
    escala: z.enum(["compacta", "normal", "amplia"]),
  }),
  radio: z.union([z.literal(0), z.literal(4), z.literal(8), z.literal(16), z.literal(999)]),
  espaciado: z.enum(["denso", "normal", "aireado"]),
  borde: z.enum(["ninguno", "fino", "grueso"]),
  imagen: z.enum(["natural", "duotono", "recorte", "marco"]),
  intensidad: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type Tokens = z.infer<typeof Tokens>;

export const SeccionBase = z.object({
    id: z.string().min(1),
    tipo: TipoSeccion,
    variante: z.string().optional(),
    visible: z.boolean(),
    intencion: z.object({
      objetivo: z.string(),
      emocion: z.string().optional(),
      objecionQueResponde: z.string().optional(),
    }),
    ajustes: z.record(z.string(), z.unknown()),
    bloques: z.array(
      z.object({
        id: z.string().min(1),
        tipo: z.string().min(1),
        ajustes: z.record(z.string(), z.unknown()),
      }),
    ),
    animacion: z
      .object({
        entrada: z.enum(["ninguna", "aparecer", "subir", "escala"]),
        retraso: z.number(),
      })
      .optional(),
    efectos: z.array(EfectoId).optional(),
    editadoPorHumano: z.array(z.string()).optional(),
  })

/** Exige la variante del héroe y que esté en el catálogo. */
export const refinarSeccion = (seccion: { tipo: string; variante?: string }, ctx: z.RefinementCtx) => {
    if (seccion.tipo !== "heroe") return;
    if (!seccion.variante) {
      ctx.addIssue({ code: "custom", path: ["variante"], message: "El héroe exige una variante" });
    } else if (!VarianteHeroe.safeParse(seccion.variante).success) {
      ctx.addIssue({
        code: "custom",
        path: ["variante"],
        message: `Variante de héroe fuera del catálogo: ${seccion.variante}`,
      });
    }
  };

export const Seccion = SeccionBase.superRefine(refinarSeccion);
export type Seccion = z.infer<typeof Seccion>;

export const Asset = z.object({
  slot: z.string().min(1),
  tipo: z.enum(["imagen", "video"]),
  relacion: z.enum(["1:1", "4:5", "16:9", "9:16"]),
  promptGrok: z.string(),
  ruta: z.string().optional(),
  alt: z.string(),
  // Procedencia del medio (bancos de medios, docs/bitacora/plan-v2.md). Solo aparece en imágenes reales.
  fuente: FuenteMedio.optional(),
  credito: z.string().optional(),
  licencia: LicenciaMedio.optional(),
  urlOrigen: z.string().optional(),
  bancoId: z.string().optional(),
  /** `true` en una imagen generada con IA (FLUX): el editor avisa «Imagen generada · reemplázala por tu foto real». */
  generada: z.boolean().optional(),
});
export type Asset = z.infer<typeof Asset>;

export const Critica = z.object({
  puntaje: z.number(),
  porCriterio: z.array(z.object({ criterio: z.string(), puntaje: z.number(), evidencia: z.string() })),
  problemas: z.array(z.string()),
  correcciones: z.array(z.string()),
});
export type Critica = z.infer<typeof Critica>;

export const LandingDoc = z.object({
  version: z.literal(1),
  meta: Meta,
  tokens: Tokens,
  secciones: z.array(Seccion).min(5).max(16),
  assets: z.array(Asset),
  critica: Critica.optional(),
});
export type LandingDoc = z.infer<typeof LandingDoc>;
