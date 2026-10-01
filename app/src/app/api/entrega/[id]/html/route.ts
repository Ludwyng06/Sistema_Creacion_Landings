import { empaquetarHtml, hojasDeEstilo } from "@/lib/entrega/html";
import { obtenerLanding } from "@/lib/landings";
import { ErrorHttp, manejar, type Contexto } from "../../../_util";

/**
 * `GET` → la landing como un solo archivo HTML para descargar (`<slug>.html`): el HTML que ya sirve `/l/<slug>`, con el CSS
 * en línea, sin scripts, las fuentes por link a Google Fonts y las imágenes con la URL absoluta de este servidor.
 */
export async function GET(request: Request, { params }: Contexto<{ id: string }>) {
  return manejar(async () => {
    const { id } = await params;
    const landing = await obtenerLanding(id);
    const origen = new URL(request.url).origin;

    const pagina = await fetch(`${origen}/l/${landing.slug}`, { cache: "no-store" });
    if (!pagina.ok) throw new ErrorHttp(502, `No pudimos leer la landing publicada (/l/${landing.slug} respondió ${pagina.status}).`);
    const html = await pagina.text();

    const hojas = new Map<string, string>();
    await Promise.all(
      hojasDeEstilo(html).map(async (href) => {
        const r = await fetch(new URL(href, origen), { cache: "no-store" });
        if (r.ok) hojas.set(href, await r.text());
      }),
    );

    return new Response(empaquetarHtml(html, origen, hojas), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${landing.slug}.html"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
