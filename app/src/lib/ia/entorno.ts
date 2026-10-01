type Env = Record<string, string | undefined>;

const TIMEOUT_POR_DEFECTO_MS = 60_000;

/** Lee IA_TIMEOUT_MS; si no es un número positivo usa 60 s. */
export function leerTimeoutMs(env: Env = process.env): number {
  const n = Number(env.IA_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : TIMEOUT_POR_DEFECTO_MS;
}
