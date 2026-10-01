// Clases compartidas del asistente. Solo tokens de la app (papel, tinta, línea, marca).

export const CLASE_CONTROL =
  "block min-h-11 w-full rounded-md border border-linea bg-papel px-3 py-2 text-base text-tinta placeholder:text-tinta-suave focus-visible:border-marca focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca aria-[invalid=true]:border-error";

export const BOTON_PRIMARIO =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-marca px-5 text-base font-medium text-marca-texto transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export const BOTON_SECUNDARIO =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-tinta px-5 text-base font-medium text-tinta transition-colors hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-not-allowed disabled:opacity-50";

export const BOTON_PEQUENO =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-linea px-3 text-sm text-tinta transition-colors hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-not-allowed disabled:opacity-40";

export const TITULO_SECCION = "font-editorial text-2xl font-semibold tracking-tight";

export const ESTILO_SALUD: Record<"verde" | "amarillo" | "rojo" | "pendiente", string> = {
  verde: "border-contexto bg-contexto-suave text-contexto",
  amarillo: "border-tarea bg-tarea-suave text-tarea",
  rojo: "border-error text-error",
  pendiente: "border-linea text-tinta-suave",
};

export const MARCA_SALUD: Record<"verde" | "amarillo" | "rojo" | "pendiente", string> = { verde: "✓", amarillo: "!", rojo: "✕", pendiente: "…" };
