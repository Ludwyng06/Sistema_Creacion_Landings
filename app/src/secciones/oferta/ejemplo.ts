import type { Seccion } from "@/lib/contratos";

// Precios y cantidades salen del brief: en el ejemplo van como [COMPLETAR].
export const ejemplo: Seccion = {
  id: "ejemplo-oferta",
  tipo: "oferta",
  visible: true,
  intencion: {
    objetivo: "Presentar el precio con el ahorro a la vista y una opción que destaque.",
    emocion: "claridad",
    objecionQueResponde: "¿Vale lo que cuesta?",
  },
  ajustes: {
    titulo: "Llévalo hoy",
    precio: "[COMPLETAR]",
    precioAnterior: "[COMPLETAR]",
    moneda: "COP",
    textoBoton: "Quiero aprovecharlo",
  },
  bloques: [
    { id: "opc-1", tipo: "opcion-cantidad", ajustes: { unidades: 1, precio: "[COMPLETAR]" } },
    { id: "opc-2", tipo: "opcion-cantidad", ajustes: { unidades: 2, precio: "[COMPLETAR]", etiqueta: "Más elegido" } },
  ],
  animacion: { entrada: "subir", retraso: 0 },
};
