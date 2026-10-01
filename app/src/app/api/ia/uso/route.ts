import { contadorCompartido } from "@/lib/ia/gasto";
import { json, manejar } from "../../_util";

/**
 * `GET /api/ia/uso` → gasto de OpenAI de hoy: `{ proveedor, dia, entrada, salida, usd, peticiones, presupuestoUsd, restanteUsd, agotado, porModelo }`.
 * Tokens de entrada y salida y costo estimado en USD (tabla de precios en `lib/ia/gasto.ts`, `OPENAI_PRECIOS` la sobrescribe).
 * Al llegar a `OPENAI_PRESUPUESTO_USD_DIA` (por defecto 2) el enrutador salta a otro proveedor. La UI de /ajustes es de B.
 */
export async function GET() {
  return manejar(async () => {
    const h = await contadorCompartido("openai").hoy();
    const modelos = Object.keys(h.porModelo);
    return json({
      proveedor: "openai",
      ...h,
      restanteUsd: Math.max(0, h.presupuestoUsd - h.usd),
      agotado: h.usd >= h.presupuestoUsd,
      // Forma que espera el panel «Uso de IA de hoy» de /ajustes (B).
      proveedores: [{ proveedor: "openai", modelo: modelos.join(", ") || undefined, llamadas: h.peticiones, tokensEntrada: h.entrada, tokensSalida: h.salida, usd: h.usd, presupuestoUsd: h.presupuestoUsd }],
      totalUsd: h.usd,
    });
  });
}
