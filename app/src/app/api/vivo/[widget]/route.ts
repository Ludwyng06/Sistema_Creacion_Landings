import { WidgetVivo } from "@/lib/contratos";
import { obtenerDatoVivo, TTL_WIDGET_SEGUNDOS } from "@/lib/vivo";
import { json, type Contexto } from "../../_util";

/**
 * `GET /api/vivo/<widget>` con widget = auroras | fase-lunar | iss | lanzamiento | asteroides.
 * 200 con un `DatoEnVivo` normalizado (desde la caché del servidor); 204 sin cuerpo si la fuente falla o está apagada,
 * para que el widget se oculte; 404 si el widget no existe.
 */
export async function GET(_request: Request, { params }: Contexto<{ widget: string }>) {
  const { widget } = await params;
  const valido = WidgetVivo.safeParse(widget);
  if (!valido.success) return json({ error: `Widget desconocido: ${widget}` }, 404);
  const dato = await obtenerDatoVivo(valido.data).catch(() => null);
  if (!dato) return new Response(null, { status: 204 });
  const ttl = TTL_WIDGET_SEGUNDOS[valido.data];
  const res = json(dato);
  res.headers.set("Cache-Control", `public, max-age=${Math.min(ttl, 60)}, s-maxage=${ttl}`);
  return res;
}
