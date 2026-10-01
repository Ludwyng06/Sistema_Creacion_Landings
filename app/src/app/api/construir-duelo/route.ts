import { obtenerDepsEnrutador } from "@/lib/ia/deps";
import { crearManejadorDuelo } from "@/lib/ia/duelo-http";

/**
 * `POST { brief, tecnicas, numeroSemilla?, prompt?, proveedores?: [a, b] }` → NDJSON (`application/x-ndjson`).
 * Cada línea es un `EventoConstruccion` con `lado: "a" | "b"`; la última es
 * `{ tipo: "duelo", a, b, juez, ganador: "a" | "b" | "empate", proveedores: { a, b, juez? }, avisos }`
 * (o `{ tipo: "error", mensaje }` si fallan los dos lados).
 */
export async function POST(request: Request) {
  return crearManejadorDuelo({ enrutador: obtenerDepsEnrutador() })(request);
}
