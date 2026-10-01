import type { Seccion } from "@/lib/contratos";

const bloques: Seccion["bloques"] = [
  { id: "sel-1", tipo: "sello", ajustes: { icono: "billete", titulo: "Pagas al recibir", texto: "Pago contraentrega: le pagas al mensajero cuando llega." } },
  { id: "sel-2", tipo: "sello", ajustes: { icono: "envio", titulo: "Envío a domicilio", texto: "Te lo llevamos hasta la puerta de tu casa." } },
  { id: "sel-3", tipo: "sello", ajustes: { icono: "escudo", titulo: "Garantía", texto: "Si llega con un defecto, lo resolvemos." } },
  { id: "sel-4", tipo: "sello", ajustes: { icono: "retorno", titulo: "Derecho de retracto", texto: "Tienes 5 días hábiles para retractarte (Ley 1480)." } },
];

function armar(variante: "iconos-fila" | "franja-texto"): Seccion {
  return {
    id: `ejemplo-sellos-confianza-${variante}`,
    tipo: "sellos-confianza",
    variante,
    visible: true,
    intencion: { objetivo: "Quitar el riesgo de comprar a la vista, antes de leer el resto.", emocion: "tranquilidad", objecionQueResponde: "¿Y si no llega o no me sirve?" },
    ajustes: {},
    bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = { "iconos-fila": armar("iconos-fila"), "franja-texto": armar("franja-texto") } as const;

/** Valor por defecto al «Agregar sección». */
export const ejemplo: Seccion = ejemplos["iconos-fila"];
