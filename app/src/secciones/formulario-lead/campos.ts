// Datos y ayudas del formulario sin dependencias: el componente los usa en el navegador sin cargar zod.
export const CAMPOS_LEAD = ["nombre", "correo", "telefono", "ciudad", "mensaje"] as const;
export type CampoLeadTipo = (typeof CAMPOS_LEAD)[number];

export const CAMPOS_POR_DEFECTO: CampoLeadTipo[] = ["nombre", "correo", "telefono"];
export const MAX_OBLIGATORIOS = 3;

export function obligatoriosDe(a: { campos: readonly CampoLeadTipo[]; obligatorios?: readonly CampoLeadTipo[] }): CampoLeadTipo[] {
  const lista = a.obligatorios ?? CAMPOS_POR_DEFECTO;
  return lista.filter((campo) => a.campos.includes(campo)).slice(0, MAX_OBLIGATORIOS);
}
