import type { ModoIA, ProveedorId, TareaIA } from "@/lib/contratos";

// Cliente de las APIs de /ajustes (día 6). Nunca maneja claves.

export type EstadoProveedor = "sin-clave" | "conectado" | "limite" | "error" | "sin-probar";

export interface ProveedorAjuste {
  id: ProveedorId;
  nombre: string;
  modelo: string;
  tieneClave: boolean;
  estado: EstadoProveedor;
  ultimoError?: string;
  usoHoy: number;
  limiteDiario: number | null;
  porcentaje: number | null;
}

export interface ResultadoPrueba {
  id: ProveedorId;
  ok: boolean;
  ms: number;
  error?: string;
}

export interface UsoResumen {
  dias: number;
  porProveedor: { proveedor: string; total: number; ok: number; errores: number; msPromedio: number }[];
  porDiaProveedor: { fecha: string; proveedor: string; total: number; errores: number; msPromedio: number }[];
  errores: { proveedor: string; tipo: string; cantidad: number; ultimo: string }[];
  avisos: string[];
}

export interface ModoCascada {
  modo: ModoIA;
  cascada: Exclude<ProveedorId, "manual">[];
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new Error("No se pudo conectar con la app. Revisa que el servidor siga en marcha.");
  }
  const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(cuerpo.error ?? `La petición falló (${res.status}).`);
  return cuerpo as T;
}

export const leerProveedores = () => pedir<{ proveedores: ProveedorAjuste[] }>("/api/ajustes/proveedores").then((r) => r.proveedores);
export const probar = (proveedor?: Exclude<ProveedorId, "manual">) =>
  pedir<{ resultados: ResultadoPrueba[] }>("/api/ajustes/probar", { method: "POST", body: JSON.stringify(proveedor ? { proveedor } : {}) }).then((r) => r.resultados);
export const leerModo = () => pedir<ModoCascada>("/api/ajustes/modo");
export const guardarModo = (m: ModoCascada) => pedir<ModoCascada>("/api/ajustes/modo", { method: "PUT", body: JSON.stringify(m) });
export const leerTareas = () => pedir<{ tareas: Record<TareaIA, Exclude<ProveedorId, "manual">> }>("/api/ajustes/tareas").then((r) => r.tareas);
export const guardarTareas = (tareas: Record<TareaIA, Exclude<ProveedorId, "manual">>) =>
  pedir<{ tareas: Record<TareaIA, Exclude<ProveedorId, "manual">> }>("/api/ajustes/tareas", { method: "PUT", body: JSON.stringify({ tareas }) }).then((r) => r.tareas);
export const leerUso = (dias = 7) => pedir<UsoResumen>(`/api/uso?dias=${dias}`);
