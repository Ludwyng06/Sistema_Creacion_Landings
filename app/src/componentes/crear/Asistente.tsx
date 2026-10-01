"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { deBrief } from "./borrador";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from "./estilos";
import {
  ESTADO_INICIAL,
  guardarSesion,
  leerSesion,
  motivoBloqueo,
  promptEfectivo,
  puedeEstarEn,
  PASOS,
  reducir,
  type Paso,
} from "./estado";
import { PasoBrief } from "./PasoBrief";

// Los pasos 2 a 4 se descargan cuando la persona llega a ellos: el paso 1 (lo primero que se ve) carga solo lo suyo.
const PasoTecnicas = dynamic(() => import("./PasoTecnicas").then((m) => m.PasoTecnicas));
const PasoPrompt = dynamic(() => import("./PasoPrompt").then((m) => m.PasoPrompt));
const PasoConstruir = dynamic(() => import("./PasoConstruir").then((m) => m.PasoConstruir));

/** Cada botón dice qué vas a conseguir en el paso siguiente. */
const ETIQUETA_AVANZAR: Partial<Record<Paso, string>> = {
  1: "Elegir mis técnicas",
  2: "Armar mi prompt",
  3: "Ir a construir mi landing",
};

function BarraPasos({ actual, puede, onIr }: { actual: Paso; puede: (p: Paso) => boolean; onIr: (p: Paso) => void }) {
  return (
    <nav aria-label="Pasos del asistente">
      <ol className="grid grid-cols-4 gap-2">
        {PASOS.map(({ numero, nombre }) => {
          const activo = numero === actual;
          const habilitado = numero <= actual || puede(numero);
          return (
            <li key={numero}>
              <button
                type="button"
                disabled={!habilitado}
                aria-current={activo ? "step" : undefined}
                onClick={() => onIr(numero)}
                className={`flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-not-allowed disabled:opacity-50 sm:flex-row sm:gap-2 ${
                  activo ? "border-marca bg-marca text-marca-texto" : numero < actual ? "border-marca text-marca hover:bg-papel-hondo" : "border-linea"
                }`}
              >
                <span aria-hidden="true" className="font-editorial text-lg font-semibold leading-none">
                  {numero}
                </span>
                <span>
                  <span className="sr-only">Paso {numero}: </span>
                  {nombre}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Asistente() {
  const router = useRouter();
  const [estado, despachar] = useReducer(reducir, ESTADO_INICIAL);
  const listo = useRef(false);
  const primerPaso = useRef(true);
  const [desdePrompt, setDesdePrompt] = useState(false);
  const [intentoAvanzar, setIntentoAvanzar] = useState(false);
  const cabecera = useRef<HTMLHeadingElement>(null);

  // Recupera el brief al recargar. Se hace tras montar para que el servidor y el cliente coincidan.
  useEffect(() => {
    const guardado = leerSesion();
    // Un estado guardado en el paso 4 no puede reconstruir el resultado: se vuelve al 3 (el prompt se regenera).
    if (guardado) despachar({ tipo: "hidratar", estado: { ...guardado, paso: guardado.paso === 4 ? 3 : guardado.paso } });
  }, []);

  // La primera pasada solo hidrata: guardar aquí pisaría lo que acaba de leerse.
  useEffect(() => {
    if (!listo.current) {
      listo.current = true;
      return;
    }
    guardarSesion(estado);
  }, [estado]);

  // Al cambiar de paso, el foco pasa al encabezado para lectores de pantalla y teclado.
  useEffect(() => {
    if (primerPaso.current) {
      primerPaso.current = false;
      return;
    }
    cabecera.current?.focus();
  }, [estado.paso]);

  const bloqueo = motivoBloqueo(estado);
  const puede = (p: Paso) => puedeEstarEn(estado, p);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-tinta-suave">Nueva landing</p>
        <h1 ref={cabecera} tabIndex={-1} className="mt-2 font-editorial text-4xl font-semibold tracking-tight outline-none md:text-5xl">
          Crea tu landing en cuatro pasos
        </h1>
      </header>

      <BarraPasos
        actual={estado.paso}
        puede={puede}
        onIr={(paso) => {
          setDesdePrompt(false);
          despachar({ tipo: "ir", paso });
        }}
      />

      <div className="mt-10">
        {estado.paso === 1 && (
          <PasoBrief
            brief={estado.brief}
            onCambio={(cambios) => despachar({ tipo: "editar-brief", cambios })}
            revision={estado.revision}
            intentoAvanzar={intentoAvanzar}
            onAplicarBorrador={(datos) => despachar({ tipo: "aplicar-borrador", ...datos })}
            onAceptarSugerido={(campo) => despachar({ tipo: "aceptar-sugerido", campo })}
            onAceptarTodoSugerido={() => despachar({ tipo: "aceptar-todo-sugerido" })}
            onQuitarSugerido={(campo, cambios) => despachar({ tipo: "quitar-sugerido", campo, cambios })}
            onEjemplo={(x) => despachar({ tipo: "cargar-ejemplo", brief: deBrief(x.brief), tecnicas: x.tecnicas, numeroSemilla: x.numeroSemilla })}
          />
        )}
        {estado.paso === 2 && <PasoTecnicas tecnicas={estado.tecnicas} onCambio={(tecnicas) => despachar({ tipo: "tecnicas", tecnicas })} />}
        {estado.paso === 3 && (
          <PasoPrompt
            brief={estado.brief}
            tecnicas={estado.tecnicas}
            numeroSemilla={estado.numeroSemilla}
            respuesta={estado.prompt}
            mejorado={estado.promptMejorado}
            onPrompt={(prompt) => despachar({ tipo: "prompt", prompt })}
            onOtraSemilla={(numero) => despachar({ tipo: "otra-semilla", numero })}
            onUsarMejorado={(prompt) => despachar({ tipo: "usar-mejorado", prompt })}
            onDescartarMejorado={() => despachar({ tipo: "descartar-mejorado" })}
            onConstruir={() => {
              setDesdePrompt(true);
              despachar({ tipo: "avanzar" });
            }}
          />
        )}
        {estado.paso === 4 && (
          <PasoConstruir
            brief={estado.brief}
            tecnicas={estado.tecnicas}
            numeroSemilla={estado.numeroSemilla}
            prompt={promptEfectivo(estado)}
            autoIniciar={desdePrompt}
            onAbrirEditor={(id) => router.push(`/editor/${id}`)}
          />
        )}
      </div>

      {estado.paso !== 4 && (
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-linea pt-6">
          <button type="button" className={BOTON_SECUNDARIO} disabled={estado.paso === 1} onClick={() => despachar({ tipo: "volver" })}>
            Atrás
          </button>
          {estado.paso !== 3 && (
            <div className="flex flex-wrap items-center gap-3">
              {bloqueo && (
                <p id="motivo-bloqueo" role="status" className="text-sm text-tinta-suave">
                  {bloqueo}
                </p>
              )}
              <button
                type="button"
                className={BOTON_PRIMARIO}
                aria-disabled={bloqueo !== null ? true : undefined}
                aria-describedby={bloqueo ? "motivo-bloqueo" : undefined}
                onClick={() => {
                  if (bloqueo !== null) setIntentoAvanzar(true);
                  else despachar({ tipo: "avanzar" });
                }}
              >
                {ETIQUETA_AVANZAR[estado.paso] ?? "Seguir"}
              </button>
            </div>
          )}
        </footer>
      )}
      {estado.paso === 4 && (
        <footer className="mt-10 border-t border-linea pt-6">
          <button type="button" className={BOTON_SECUNDARIO} onClick={() => despachar({ tipo: "volver" })}>
            Atrás
          </button>
        </footer>
      )}
    </main>
  );
}
