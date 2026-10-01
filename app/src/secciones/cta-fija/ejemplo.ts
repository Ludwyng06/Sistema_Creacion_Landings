import type { Seccion } from "@/lib/contratos";
import { COMPLETAR } from "@/componentes/dinero";

// El número de WhatsApp sale del brief: en el ejemplo va como [COMPLETAR].
function armar(variante: "barra-inferior-movil" | "whatsapp-flotante"): Seccion {
  return {
    id: `ejemplo-cta-fija-${variante}`,
    tipo: "cta-fija",
    variante,
    visible: true,
    intencion: { objetivo: "Dejar el pedido al alcance del pulgar en todo momento.", emocion: "decisión" },
    ajustes:
      variante === "barra-inferior-movil"
        ? { texto: "Pídelo y paga al recibir" }
        : { texto: "Escríbenos por WhatsApp", whatsapp: COMPLETAR, mensajeWhatsapp: "Hola, quiero pedir el producto" },
    bloques: [],
  };
}

export const ejemplos = { "barra-inferior-movil": armar("barra-inferior-movil"), "whatsapp-flotante": armar("whatsapp-flotante") } as const;

/** Valor por defecto al «Agregar sección». */
export const ejemplo: Seccion = ejemplos["barra-inferior-movil"];
