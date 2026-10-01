// Cola de peticiones por minuto: Cerebras gratuito permite solo 5 por minuto. Las llamadas esperan su turno (una a una, en orden)
// en vez de fallar con 429; la ventana es deslizante de 60 s.

export interface ColaRpm {
  /** Resuelve cuando hay un cupo libre en la ventana de 60 s y lo reserva. */
  esperar(): Promise<void>;
  /** Peticiones que ya ocuparon la ventana (para las pruebas). */
  enVentana(): number;
}

export interface OpcionesCola {
  ahora?: () => number;
  dormir?: (ms: number) => Promise<void>;
}

export function crearColaRpm(rpm: number, op: OpcionesCola = {}): ColaRpm {
  const ahora = op.ahora ?? Date.now;
  const dormir = op.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const marcas: number[] = [];
  let cadena: Promise<void> = Promise.resolve();
  const purgar = () => {
    const t = ahora();
    while (marcas.length > 0 && t - marcas[0] >= 60_000) marcas.shift();
  };
  return {
    esperar() {
      const turno = cadena.then(async () => {
        for (;;) {
          purgar();
          if (marcas.length < rpm) {
            marcas.push(ahora());
            return;
          }
          await dormir(Math.max(50, 60_000 - (ahora() - marcas[0]) + 50));
        }
      });
      cadena = turno.catch(() => undefined);
      return turno;
    },
    enVentana: () => (purgar(), marcas.length),
  };
}

const COMPARTIDAS = new Map<string, ColaRpm>();

/** Una cola por proveedor para todo el proceso: dos llamadas simultáneas comparten las mismas 5 por minuto. */
export function colaCompartida(id: string, rpm: number): ColaRpm {
  const clave = `${id}:${rpm}`;
  let c = COMPARTIDAS.get(clave);
  if (!c) COMPARTIDAS.set(clave, (c = crearColaRpm(rpm)));
  return c;
}
