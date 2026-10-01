import type { Etapa } from "./encargo";

// Etapas de `POST /api/generar`. Con la generación en paralelo (24-A) varias están activas a la vez y cada una avisa con
// `estado: "inicio" | "fin"`; sin `estado` el evento se comporta como antes: esa etapa pasa a ser la única activa y las
// anteriores quedan hechas.

export interface EtapasEnCurso {
  activas: Etapa[];
  hechas: Etapa[];
  mensaje: string;
  n?: number;
  total?: number;
}

export interface EventoEtapa {
  etapa: Etapa;
  mensaje: string;
  estado?: "inicio" | "fin";
  n?: number;
  total?: number;
}

export function aplicarEtapa<T extends EtapasEnCurso>(p: T, e: EventoEtapa, orden: readonly Etapa[]): T {
  if (e.estado === "fin") {
    return { ...p, activas: p.activas.filter((x) => x !== e.etapa), hechas: p.hechas.includes(e.etapa) ? p.hechas : [...p.hechas, e.etapa] };
  }
  if (e.estado === "inicio") {
    return { ...p, activas: p.activas.includes(e.etapa) ? p.activas : [...p.activas, e.etapa], hechas: p.hechas.filter((x) => x !== e.etapa), mensaje: e.mensaje, n: e.n ?? p.n, total: e.total ?? p.total };
  }
  const indice = orden.indexOf(e.etapa);
  return { ...p, activas: [e.etapa], hechas: orden.slice(0, indice), mensaje: e.mensaje, n: e.n, total: e.total };
}
