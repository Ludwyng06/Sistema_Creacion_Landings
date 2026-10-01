import type { Seccion } from "@/lib/contratos";

export const ejemplo: Seccion = {
  id: "ejemplo-html-libre",
  tipo: "html-libre",
  visible: true,
  intencion: {
    objetivo: "Dejar un espacio para un bloque propio que una persona escribe a mano en el editor.",
  },
  ajustes: {
    html: "<h2>Un mensaje de la marca</h2><p>Aquí va un texto escrito por una persona, con enlaces y listas simples.</p>",
  },
  bloques: [],
  animacion: { entrada: "aparecer", retraso: 0 },
};
