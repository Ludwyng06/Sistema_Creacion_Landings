"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type Pestana = "landing" | "prompt";

const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: "landing", texto: "Landing" },
  { id: "prompt", texto: "Prompt" },
];

/**
 * Landing y prompt lado a lado desde 1024 px; en móvil, dos pestañas («Landing» y «Prompt»).
 * Los dos paneles siempre están en el documento: en escritorio se ven juntos y en móvil solo el activo.
 */
export function VistaDividida({ landing, prompt }: { landing: ReactNode; prompt: ReactNode }) {
  const [activa, setActiva] = useState<Pestana>("landing");
  const base = useId();
  const refs = useRef<Record<Pestana, HTMLButtonElement | null>>({ landing: null, prompt: null });

  function teclas(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const i = PESTANAS.findIndex((p) => p.id === activa);
    const j = e.key === "Home" ? 0 : e.key === "End" ? PESTANAS.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + PESTANAS.length) % PESTANAS.length;
    setActiva(PESTANAS[j].id);
    refs.current[PESTANAS[j].id]?.focus();
  }

  return (
    <div className="flex flex-col gap-4" data-vista-dividida>
      <div role="tablist" aria-label="Qué ver" className="flex gap-2 border-b border-linea lg:hidden">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            ref={(el) => {
              refs.current[p.id] = el;
            }}
            role="tab"
            id={`${base}-tab-${p.id}`}
            type="button"
            aria-selected={activa === p.id}
            aria-controls={`${base}-panel-${p.id}`}
            tabIndex={activa === p.id ? 0 : -1}
            onClick={() => setActiva(p.id)}
            onKeyDown={teclas}
            className={`-mb-px min-h-11 border-b-2 px-4 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca ${activa === p.id ? "border-marca font-medium text-marca" : "border-transparent text-tinta-suave"}`}
          >
            {p.texto}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div
          role="tabpanel"
          id={`${base}-panel-landing`}
          aria-labelledby={`${base}-tab-landing`}
          data-panel="landing"
          className={`${activa === "landing" ? "block" : "hidden"} lg:sticky lg:top-4 lg:block`}
        >
          {landing}
        </div>
        <div
          role="tabpanel"
          id={`${base}-panel-prompt`}
          aria-labelledby={`${base}-tab-prompt`}
          data-panel="prompt"
          className={`${activa === "prompt" ? "block" : "hidden"} lg:block`}
        >
          {prompt}
        </div>
      </div>
    </div>
  );
}
