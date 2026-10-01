"use client";

import { useEffect, useState } from "react";
import type { Seccion, Tokens } from "@/lib/contratos";
import { Dato } from "@/componentes/Dato";
import { COMPLETAR } from "@/componentes/dinero";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import type { schema } from "./schema";
import type { z } from "zod";

const UNIDADES = [
  { clave: "dias", etiqueta: "Días" },
  { clave: "horas", etiqueta: "Horas" },
  { clave: "minutos", etiqueta: "Minutos" },
  { clave: "segundos", etiqueta: "Segundos" },
] as const;

export function partesRestantes(msRestantes: number) {
  const total = Math.max(0, Math.floor(msRestantes / 1000));
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
  };
}

const dos = (n: number) => String(n).padStart(2, "0");

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  // `null` hasta montar: el servidor no conoce la hora del visitante.
  const [ahora, setAhora] = useState<number | null>(null);

  useEffect(() => {
    const marcar = () => setAhora(Date.now());
    const inicio = setTimeout(marcar, 0);
    const reloj = setInterval(marcar, 1000);
    return () => {
      clearTimeout(inicio);
      clearInterval(reloj);
    };
  }, []);

  if (!datos) return <SeccionInvalida tipo="cuenta-regresiva" />;

  const { ajustes } = datos;
  const encabezado = (
    <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">
      {ajustes.titulo}
    </Titular>
  );

  if (ajustes.fechaFin === COMPLETAR) {
    return (
      <section className="px-5 py-espacio text-center">
        <div className="mx-auto max-w-xl">
          {encabezado}
          <p className="mt-4 text-sm text-suave">
            Fecha de fin: <Dato>{COMPLETAR}</Dato>
          </p>
        </div>
      </section>
    );
  }

  const fin = Date.parse(ajustes.fechaFin);
  // Una oferta vencida no se muestra.
  if (ahora !== null && ahora >= fin) return null;

  const partes = ahora === null ? null : partesRestantes(fin - ahora);
  const valor = (clave: (typeof UNIDADES)[number]["clave"]) =>
    partes ? (clave === "dias" ? String(partes.dias) : dos(partes[clave])) : "--";

  return (
    <section className="px-5 py-espacio text-center">
      <div className="mx-auto max-w-xl">
        {encabezado}
        {partes && (
          <p className="sr-only" role="timer" aria-live="off">
            Quedan {partes.dias} días, {partes.horas} horas y {partes.minutos} minutos.
          </p>
        )}
        {ajustes.estilo === "bloques" ? (
          <dl aria-hidden="true" className="mt-8 grid grid-cols-4 gap-2 md:gap-4">
            {UNIDADES.map(({ clave, etiqueta }) => (
              <div key={clave} className="borde-token rounded-tarjeta bg-superficie px-1 py-4">
                <dd className="font-titulos text-[calc(clamp(1.75rem,8vw,3rem)*var(--escala-t,var(--escala)))] font-bold leading-none tabular-nums">
                  {valor(clave)}
                </dd>
                <dt className="mt-2 text-xs uppercase tracking-widest text-suave">{etiqueta}</dt>
              </div>
            ))}
          </dl>
        ) : (
          <p
            aria-hidden="true"
            className="mt-8 font-titulos text-[calc(clamp(2rem,9vw,3.5rem)*var(--escala-t,var(--escala)))] font-bold tabular-nums"
          >
            {valor("dias")}d {valor("horas")}:{valor("minutos")}:{valor("segundos")}
          </p>
        )}
      </div>
    </section>
  );
}
