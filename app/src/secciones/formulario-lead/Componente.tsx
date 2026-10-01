"use client";

import { useState, type FormEvent } from "react";
import type { Seccion, Tokens } from "@/lib/contratos";
import { useLanding } from "@/componentes/contexto-landing";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { Magnetico } from "@/efectos/Magnetico";
import { leerSeccion } from "../leer";
import { enviarLead, type DatosLead } from "./enviar-lead";
import { obligatoriosDe, type CampoLeadTipo as CampoLead } from "./campos";
import type { schema } from "./schema";
import type { z } from "zod";
import { errorPorCampo, ETIQUETAS_CAMPO, validarLead } from "./validar";

const TIPO_INPUT: Partial<Record<CampoLead, { type: string; autoComplete: string; inputMode?: "email" | "tel" }>> = {
  nombre: { type: "text", autoComplete: "name" },
  correo: { type: "email", autoComplete: "email", inputMode: "email" },
  telefono: { type: "tel", autoComplete: "tel", inputMode: "tel" },
  ciudad: { type: "text", autoComplete: "address-level2" },
};

const CLASE_CONTROL =
  "block min-h-12 w-full rounded-token border-2 border-borde bg-superficie px-4 py-3 text-texto placeholder:text-suave focus-visible:border-acento focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento aria-[invalid=true]:border-texto";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datosSeccion = leerSeccion<z.infer<typeof schema>>(seccion);
  const { anclaFormulario, landingId } = useLanding();
  const [errores, setErrores] = useState<Partial<Record<CampoLead, string>>>({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  if (!datosSeccion) return <SeccionInvalida tipo="formulario-lead" />;

  const { ajustes } = datosSeccion;
  const obligatorios = obligatoriosDe(ajustes);
  const dividido = seccion.variante === "dividido";

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    // Los campos no son controlados: lo que la persona escribió antes de que la página hidratara sigue en el DOM.
    const formulario = new FormData(evento.currentTarget);
    const valores: DatosLead = {};
    for (const campo of ajustes.campos) {
      const valor = String(formulario.get(campo) ?? "");
      if (valor) valores[campo] = valor;
    }
    const sitio = String(formulario.get("sitio") ?? "");
    const encontrados = validarLead(ajustes.campos, obligatorios, valores);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setEnviando(true);
    setErrorEnvio(null);
    const resultado = await enviarLead(valores, { landingId, sitio });
    setEnviando(false);
    if (resultado.ok) {
      setEnviado(true);
      return;
    }
    // Los mensajes del servidor van junto al campo al que se refieren; el resto, encima del botón.
    const { porCampo, generales } = errorPorCampo(resultado.errores ?? [], ajustes.campos);
    setErrores(porCampo);
    setErrorEnvio(Object.keys(porCampo).length > 0 && generales.length === 0 ? null : (generales[0] ?? resultado.error));
  }

  return (
    <section id={anclaFormulario} className="scroll-mt-4 px-5 py-espacio" data-variante={dividido ? "dividido" : "tarjeta"}>
      <div className={dividido ? "mx-auto grid max-w-5xl items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-14" : undefined}>
        {dividido && (
          <div className="md:sticky md:top-8">
            <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
            {ajustes.subtitulo && <p className="mt-4 text-pretty text-lead text-suave">{ajustes.subtitulo}</p>}
            <p className="mt-6 hidden border-l-4 border-acento pl-4 text-sm text-suave md:block">{ajustes.privacidad}</p>
          </div>
        )}
      <div className={`borde-token rounded-tarjeta bg-superficie p-6 md:p-10 ${dividido ? "" : "mx-auto max-w-xl"}`}>
        {!dividido && <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>}
        {!dividido && ajustes.subtitulo && <p className="mt-3 text-pretty text-lead text-suave">{ajustes.subtitulo}</p>}

        {enviado ? (
          <p role="status" className="mt-8 rounded-token bg-fondo p-5 text-lead text-texto">
            {ajustes.mensajeGracias}
          </p>
        ) : (
          <form noValidate onSubmit={alEnviar} className="mt-8 flex flex-col gap-5">
            {ajustes.campos.map((campo) => {
              const id = `${anclaFormulario}-${campo}`;
              const error = errores[campo];
              const esObligatorio = obligatorios.includes(campo);
              const comunes = {
                id,
                name: campo,
                required: esObligatorio,
                "aria-invalid": error ? true : undefined,
                "aria-describedby": error ? `${id}-error` : undefined,
                className: CLASE_CONTROL,
              };
              return (
                <div key={campo}>
                  <label htmlFor={id} className="mb-2 block text-sm font-medium">
                    {ETIQUETAS_CAMPO[campo]}
                    {!esObligatorio && <span className="font-normal text-suave"> (opcional)</span>}
                  </label>
                  {campo === "mensaje" ? (
                    <textarea rows={4} {...comunes} />
                  ) : (
                    <input {...TIPO_INPUT[campo]} {...comunes} />
                  )}
                  {error && (
                    <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-texto">
                      {error}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Honeypot: fuera de pantalla y fuera del orden de tabulación; una persona nunca lo llena. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor={`${anclaFormulario}-sitio`}>No completes este campo</label>
              <input id={`${anclaFormulario}-sitio`} name="sitio" tabIndex={-1} autoComplete="off" />
            </div>

            {errorEnvio && (
              <p role="alert" className="text-sm text-texto">
                {errorEnvio}
              </p>
            )}

            <Magnetico className="mt-1 self-start"><button
              type="submit"
              data-cursor="Enviar"
              disabled={enviando}
              className="inline-flex min-h-12 items-center justify-center rounded-token bg-acento px-8 text-cuerpo font-medium text-acento-texto transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acento disabled:opacity-60"
            >
              {enviando ? "Enviando…" : ajustes.textoBoton}
            </button></Magnetico>
            <p className={`text-sm text-suave ${dividido ? "md:hidden" : ""}`}>{ajustes.privacidad}</p>
          </form>
        )}
      </div>
      </div>
    </section>
  );
}
