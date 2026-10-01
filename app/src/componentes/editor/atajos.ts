// Atajos de teclado del editor (§5 de la 13-B). La traducción es pura: recibe la tecla y dice qué acción es, así se prueba
// sin interfaz y sirve igual para las teclas del editor y para las que reenvía la vista previa (iframe).

export type AtajoEditor = "deshacer" | "rehacer" | "eliminar" | "duplicar" | "subir" | "bajar" | "deseleccionar" | "ver-completa" | "ayuda";

export interface TeclaEditor {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /** `true` si el foco está en un campo de texto (entrada, área, lista o texto editable). */
  enCampo: boolean;
}

/**
 * Qué atajo es una tecla, o `null`. Deshacer y rehacer valen siempre (el editor tiene su propio historial de 100 estados);
 * las teclas sueltas (Supr, P, ?, Esc) no se tocan mientras se escribe en un campo.
 */
export function traducirAtajo(t: TeclaEditor): AtajoEditor | null {
  const tecla = t.key.length === 1 ? t.key.toLowerCase() : t.key;
  const control = t.ctrlKey || t.metaKey;
  if (control && !t.altKey) {
    if (tecla === "z") return t.shiftKey ? "rehacer" : "deshacer";
    if (tecla === "y") return "rehacer";
    if (tecla === "d" && !t.shiftKey && !t.enCampo) return "duplicar";
    return null;
  }
  if (t.altKey && !control && !t.shiftKey) {
    if (t.enCampo) return null;
    if (tecla === "ArrowUp") return "subir";
    if (tecla === "ArrowDown") return "bajar";
    return null;
  }
  if (control || t.altKey || t.enCampo) return null;
  if (tecla === "Delete") return "eliminar";
  if (tecla === "Escape") return "deseleccionar";
  if (tecla === "p" && !t.shiftKey) return "ver-completa";
  if (tecla === "?") return "ayuda";
  return null;
}

/** ¿El elemento es un campo donde se escribe? */
export function esCampoDeTexto(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  if (el.closest("input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='file']), textarea, select, [contenteditable]")) return true;
  return false;
}

export const LISTA_ATAJOS: { teclas: string; descripcion: string }[] = [
  { teclas: "Ctrl/Cmd + Z", descripcion: "Deshacer (hasta 100 pasos)" },
  { teclas: "Ctrl/Cmd + Mayús + Z", descripcion: "Rehacer" },
  { teclas: "Supr", descripcion: "Eliminar la sección seleccionada" },
  { teclas: "Ctrl/Cmd + D", descripcion: "Duplicar la sección" },
  { teclas: "Alt + ↑ / Alt + ↓", descripcion: "Subir o bajar la sección dentro de su grupo" },
  { teclas: "Esc", descripcion: "Quitar la selección (muestra el Tema)" },
  { teclas: "P", descripcion: "Ver la landing completa" },
  { teclas: "?", descripcion: "Mostrar esta ayuda" },
  { teclas: "Doble clic en un texto", descripcion: "Editarlo en la vista previa (Enter confirma, Esc cancela)" },
];
