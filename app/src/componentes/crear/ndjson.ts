import type { EventoConstruccion } from "@/lib/contratos";

// `duelo` es el evento final de `POST /api/construir-duelo`; en ese flujo cada evento trae además `lado`.
const TIPOS = new Set(["tarea", "resultado", "manual", "error", "duelo"]);

export interface ParserNdjson {
  /** Recibe un trozo de texto; emite cada línea completa y guarda el resto para el siguiente trozo. */
  empujar(trozo: string): void;
  /** Al cerrar el flujo, procesa lo que quedó sin salto de línea final. */
  cerrar(): void;
}

/**
 * Parser NDJSON tolerante: admite líneas partidas entre trozos y varias líneas por trozo.
 * Una línea que no es JSON o no es un evento conocido se ignora y se avisa.
 */
export function crearParserNdjson<T = EventoConstruccion>(
  alEvento: (evento: T) => void,
  alAviso: (aviso: string) => void = () => {},
  tipos: ReadonlySet<string> = TIPOS,
): ParserNdjson {
  let resto = "";

  function linea(texto: string) {
    const limpia = texto.trim();
    if (limpia === "") return;
    let dato: unknown;
    try {
      dato = JSON.parse(limpia);
    } catch {
      alAviso(`Se ignoró una línea que no es JSON: ${limpia.slice(0, 60)}`);
      return;
    }
    const tipo = (dato as { tipo?: unknown } | null)?.tipo;
    if (typeof tipo !== "string" || !tipos.has(tipo)) {
      alAviso("Se ignoró un evento de tipo desconocido.");
      return;
    }
    alEvento(dato as T);
  }

  return {
    empujar(trozo) {
      resto += trozo;
      const partes = resto.split("\n");
      resto = partes.pop() ?? "";
      for (const parte of partes) linea(parte);
    },
    cerrar() {
      const pendiente = resto;
      resto = "";
      linea(pendiente);
    },
  };
}

/** Lee un cuerpo de respuesta como flujo NDJSON hasta que termina. */
export async function leerFlujoNdjson<T = EventoConstruccion>(
  cuerpo: ReadableStream<Uint8Array>,
  alEvento: (evento: T) => void,
  alAviso?: (aviso: string) => void,
  tipos?: ReadonlySet<string>,
): Promise<void> {
  const lector = cuerpo.getReader();
  const decodificador = new TextDecoder();
  const parser = crearParserNdjson<T>(alEvento, alAviso, tipos);
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    parser.empujar(decodificador.decode(value, { stream: true }));
  }
  parser.empujar(decodificador.decode());
  parser.cerrar();
}
