import { servirMedia } from "@/lib/media/servir";
type Contexto = { params: Promise<{ ruta: string[] }> };

// `/media/**` se sirve del disco en cada petición (next dev y next start), no de lo que había en public/ al compilar.
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: Contexto) {
  return servirMedia(request, (await params).ruta);
}

export async function HEAD(request: Request, { params }: Contexto) {
  return servirMedia(request, (await params).ruta);
}
