"use client";

import { useEffect, useState } from "react";
import { leerEstadoCritico } from "@/componentes/editor/api-editor";
import { SIN_SENAL, type SenalGeneracion } from "./generacion";

export { hayAvisoGeneracion } from "./generacion";

/**
 * Lo que dejó la generación de una landing (`GET /api/landings/[id]/critico`). Solo las que salieron del generador traen
 * `etapa`; las manuales y de la semilla no tienen crítico que reintentar y no muestran aviso.
 */
export function useSenalGeneracion(id: string): SenalGeneracion {
  const [lectura, setLectura] = useState<{ id: string; senal: SenalGeneracion } | null>(null);
  useEffect(() => {
    let vigente = true;
    leerEstadoCritico(id)
      .then((e) => {
        if (!vigente) return;
        setLectura({ id, senal: e.etapa === null ? SIN_SENAL : { criticoPendiente: e.criticoPendiente, seccionesPendientes: e.seccionesPorCompletar.length } });
      })
      .catch(() => vigente && setLectura({ id, senal: SIN_SENAL }));
    return () => {
      vigente = false;
    };
  }, [id]);
  return lectura?.id === id ? lectura.senal : SIN_SENAL;
}
