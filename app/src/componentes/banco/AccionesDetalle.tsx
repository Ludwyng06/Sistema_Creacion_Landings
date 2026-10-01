"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from "@/componentes/crear/estilos";

/** «Abrir en el editor» y «Duplicar como nueva» (la copia queda como borrador y se abre en el editor). */
export function AccionesDetalle({ id }: { id: string }) {
  const router = useRouter();
  const [duplicando, setDuplicando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function duplicar() {
    setDuplicando(true);
    setError(null);
    try {
      const r = await fetch(`/api/landings/${id}/duplicar`, { method: "POST" });
      const cuerpo = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!r.ok || !cuerpo.id) throw new Error(cuerpo.error ?? `No se pudo duplicar (código ${r.status}).`);
      router.push(`/editor/${cuerpo.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo duplicar.");
      setDuplicando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <Link href={`/editor/${id}`} className={BOTON_PRIMARIO}>
          Abrir en el editor
        </Link>
        <Link href={`/ver/${id}`} className={BOTON_SECUNDARIO}>
          Ver a pantalla completa
        </Link>
        <button type="button" onClick={duplicar} disabled={duplicando} className={BOTON_SECUNDARIO}>
          {duplicando ? "Duplicando…" : "Duplicar como nueva"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
