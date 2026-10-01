import { z } from "zod";
import { Brief } from "@/lib/contratos";
import { proponerObjeciones } from "@/lib/ia/edicion";
import { json, leerCuerpo, manejar } from "../_util";

const Cuerpo = z.object({ brief: Brief });

/** `POST { brief }` → `{ objeciones: string[] }` con 5 objeciones realistas. */
export async function POST(request: Request) {
  return manejar(async () => {
    const { brief } = await leerCuerpo(request, Cuerpo);
    const { objeciones } = await proponerObjeciones(brief);
    return json({ objeciones });
  });
}
