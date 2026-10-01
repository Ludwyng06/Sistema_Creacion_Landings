import { Brief } from "@/lib/contratos";

/** Brief de ejemplo del corrector de postura (datos ficticios para pruebas). */
export const briefCorrector = Brief.parse({
  nombre: "Corrector de postura inteligente",
  categoria: "salud-y-bienestar",
  problema: "Pasas ocho horas sentado y la espalda te duele al final del día.",
  publico: "Trabajadores de oficina de 25 a 45 años que usan computador todo el día.",
  beneficios: ["Vibra cuando te encorvas", "Se usa bajo la ropa", "Carga por USB"],
  precio: { valor: 129000, anterior: 169000, moneda: "COP" },
  objeciones: ["¿Se nota bajo la ropa?", "¿Cuánto dura la batería?", "¿Cómo lo devuelvo?"],
  nivelConciencia: "problema",
  intensidad: 3,
});
