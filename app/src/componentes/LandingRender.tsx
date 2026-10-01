"use client";

import { Fragment, useEffect, useMemo, type CSSProperties } from "react";
import type { LandingDoc } from "@/lib/contratos";
import { efectosDelDoc, efectosGlobales } from "@/efectos/aplicables";
import { CATALOGO_CLIENTE } from "@/efectos/catalogo-cliente";
import { conEfectosNivel3 } from "@/efectos/nivel3";
import { ProveedorEfectos } from "@/efectos/contexto-efectos";
import { CursorVivo } from "@/efectos/CursorVivo";
import { Grano } from "@/efectos/Grano";
import { ProveedorMovimiento } from "@/efectos/movimiento";
import { Revelar } from "@/efectos/Revelar";
import { componentesSeccion } from "@/secciones/componentes";
import { clasesDePresentacion, fondoDeBorde, leerPresentacion, variablesDeTamano, variablesGlobales } from "@/secciones/presentacion";
import { fondosDeRitmo } from "@/secciones/fondos";
import { personalidadDe } from "@/secciones/personalidad";
import { TamanosDeBloque } from "./TamanosDeBloque";
import { ProveedorLanding } from "./contexto-landing";
import { Entrada } from "./Entrada";
import { HojaFuentes } from "./fuentes/HojaFuentes";
import { tokensAVariables } from "./tokens-css";

/** Secciones con `position: fixed`: sin `content-visibility` ni animación de entrada (crean un bloque contenedor que las descoloca). */
const SECCIONES_FIJAS: readonly string[] = ["cta-fija"];

type Props = {
  doc: LandingDoc;
  /** URL de Google Fonts con solo las 2 familias del doc (`urlFuentes`). La calcula quien llama: así la página pública no descarga el catálogo. */
  urlFuentes?: string | null;
  /** Simula `prefers-reduced-motion` (lo usa /dev/efectos). */
  reducirMovimiento?: boolean;
  /** Id de la landing guardada: activa el envío real del formulario (página pública). */
  landingId?: string;
  /** Miniatura del editor: las secciones no piden datos ni se fijan a la ventana. */
  vistaPrevia?: boolean;
  /** Solo el editor: qué hacer con «Buscar en bancos» en una imagen pendiente. */
  onBuscarBancos?: (slot: string) => void;
  /** Anima el cambio de tokens (transición de las variables CSS); lo usa el editor. */
  morph?: boolean;
  /**
   * Página pública: las secciones de abajo (sin efectos de nivel 3, que miden y fijan la sección) se pintan al acercarse
   * (`content-visibility: auto`), así el primer pintado no calcula estilos ni layout de toda la landing.
   */
  diferirSecciones?: boolean;
};

/**
 * Renderiza un `LandingDoc`: aplica los tokens, pinta las secciones visibles con el registro
 * y conecta los efectos declarados en `seccion.efectos`, filtrados por catálogo, sección e intensidad.
 */
export function LandingRender({ doc, urlFuentes: urlDeFuentes = null, reducirMovimiento = false, landingId, vistaPrevia = false, onBuscarBancos, morph = false, diferirSecciones = false }: Props) {
  // El tamaño de letra de toda la landing (adaptador en la presentación del héroe) pisa la escala de los tokens.
  const personalidad = personalidadDe(doc.meta.semilla?.estilo);
  const variables = useMemo(() => ({ ...tokensAVariables(doc.tokens, personalidad), ...variablesGlobales(doc.secciones) }), [doc.tokens, doc.secciones, personalidad]);
  const valor = useMemo(
    () => ({
      assets: doc.assets,
      anclaFormulario: `${doc.meta.slug}-formulario`,
      landingId,
      vistaPrevia,
      onBuscarBancos,
      // El foco de cada imagen (`object-position`) viene de la presentación de las secciones.
      focos: Object.assign({}, ...doc.secciones.map((s) => leerPresentacion(s.ajustes).focos)) as Record<string, string>,
    }),
    [doc.assets, doc.secciones, doc.meta.slug, landingId, vistaPrevia, onBuscarBancos],
  );
  const globales = useMemo(() => efectosGlobales(doc), [doc]);
  const { porSeccion, recortados } = useMemo(() => efectosDelDoc(doc), [doc]);
  useEffect(() => {
    if (recortados.length > 0 && process.env.NODE_ENV !== "production") {
      console.warn(`LandingRender: la landing declara más de 3 efectos de nivel 3; se omiten ${recortados.join(", ")}.`);
    }
  }, [recortados]);
  const fondos = useMemo(() => fondosDeRitmo(doc.secciones, doc.meta.semilla?.estilo, doc.meta.semilla?.numero), [doc.secciones, doc.meta.semilla]);
  const movimiento = useMemo(() => ({ forzarReducido: reducirMovimiento }), [reducirMovimiento]);

  return (
    <ProveedorMovimiento value={movimiento}>
      {urlDeFuentes && <HojaFuentes href={urlDeFuentes} />}
      <ProveedorLanding value={valor}>
        <div
          className="landing relative bg-fondo font-cuerpo text-cuerpo text-texto"
          style={variables}
          data-imagen={doc.tokens.imagen}
          data-estilo={personalidad}
          data-intensidad={doc.tokens.intensidad}
          data-morph={morph ? "" : undefined}
          data-reducido={reducirMovimiento ? "" : undefined}
        >
          {globales.includes("grano") && <Grano />}
          {globales.includes("cursor-vivo") && <CursorVivo />}
          {doc.secciones
            .filter((seccion) => seccion.visible)
            .map((seccion, posicion, visibles) => {
              const Componente = componentesSeccion[seccion.tipo];
              if (!Componente) {
                if (process.env.NODE_ENV === "production") return null;
                return (
                  <p
                    key={seccion.id}
                    className="borde-token m-4 rounded-token p-3 text-center text-sm text-suave"
                  >
                    Sección «{seccion.tipo}» sin registrar todavía.
                  </p>
                );
              }
              const activos = porSeccion.get(seccion.id) ?? [];
              const presentacion = leerPresentacion(seccion.ajustes);
              const tamanosSeccion = variablesDeTamano(presentacion);
              const contenido = conEfectosNivel3(
                <ProveedorEfectos value={activos}>
                  <TamanosDeBloque seccion={seccion}>
                    <Componente seccion={seccion} tokens={doc.tokens} />
                  </TamanosDeBloque>
                </ProveedorEfectos>,
                activos,
              );
              // Transición de color al entrar o salir de una sección de fondo acento.
              const anterior = visibles[posicion - 1];
              const divisor =
                anterior && !SECCIONES_FIJAS.includes(seccion.tipo) && fondoDeBorde(anterior) !== fondoDeBorde(seccion) && (fondoDeBorde(anterior) === "acento" || fondoDeBorde(seccion) === "acento")
                  ? fondoDeBorde(anterior) === "acento"
                    ? "bg-gradient-to-b from-acento to-fondo"
                    : "bg-gradient-to-b from-fondo to-acento"
                  : null;
              return (
                <Fragment key={seccion.id}>
                {divisor && <div aria-hidden="true" data-divisor className={`h-10 ${divisor}`} />}
                <div
                  id={`${doc.meta.slug}--${seccion.id}`}
                  className={
                    [
                      diferirSecciones && posicion > 0 && !SECCIONES_FIJAS.includes(seccion.tipo) && !activos.some((id) => CATALOGO_CLIENTE[id].nivel === 3) ? "seccion-diferida" : "",
                      clasesDePresentacion(presentacion),
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  style={Object.keys(tamanosSeccion).length > 0 ? (tamanosSeccion as CSSProperties) : undefined}
                  data-peso-titulo={presentacion.pesoTitular !== "heredado" ? "" : undefined}
                  data-seccion-id={seccion.id}
                  data-fondo={fondos.get(seccion.id)}
                  data-tipo={seccion.tipo}
                  data-efectos={activos.join(" ") || undefined}
                >
                  {presentacion.ancla && <span id={presentacion.ancla} className="block scroll-mt-4" />}
                  {SECCIONES_FIJAS.includes(seccion.tipo) ? (
                    contenido
                  ) : activos.includes("revelar-suave") ? (
                    <Revelar>{contenido}</Revelar>
                  ) : (
                    <Entrada animacion={seccion.animacion}>{contenido}</Entrada>
                  )}
                </div>
                </Fragment>
              );
            })}
        </div>
      </ProveedorLanding>
    </ProveedorMovimiento>
  );
}
