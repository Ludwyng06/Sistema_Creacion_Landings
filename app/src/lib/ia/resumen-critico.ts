import type { LandingDoc } from "@/lib/contratos";

/**
 * Resumen del `LandingDoc` para el crítico: estructura y textos de cada sección, sin `tokens`, sin los prompts de
 * imagen ni la metadata de la semilla. Las rutas se conservan (`secciones[0].ajustes.titular`) para que la evidencia
 * del auditor siga apuntando a campos reales.
 */
export function resumirParaCritico(doc: LandingDoc): unknown {
  return {
    meta: { nombre: doc.meta.nombre, nivelConciencia: doc.meta.nivelConciencia, marco: doc.meta.marco, estilo: doc.meta.semilla.estilo },
    secciones: doc.secciones.map((s) => ({
      id: s.id,
      tipo: s.tipo,
      ...(s.variante && { variante: s.variante }),
      visible: s.visible,
      intencion: s.intencion,
      ajustes: s.ajustes,
      ...(s.bloques.length > 0 && { bloques: s.bloques.map((b) => ({ tipo: b.tipo, ajustes: b.ajustes })) }),
      ...(s.efectos && s.efectos.length > 0 && { efectos: s.efectos }),
    })),
    assets: doc.assets.map((a) => ({ slot: a.slot, tipo: a.tipo, relacion: a.relacion, alt: a.alt })),
  };
}
