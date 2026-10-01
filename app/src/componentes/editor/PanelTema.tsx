"use client";

import { useEffect, useRef, useState } from "react";
import { ColorHex, type Brief, type Tokens } from "@/lib/contratos";
import { CONTRASTE_TEXTO, PALETAS, aplicarColoresMarca, contraste, otraSemillaDistinta, pesoPaleta, TIPOGRAFIAS, tokensParaBrief, type Paleta } from "@/lib/tecnicas/semillas";
import type { LandingDoc } from "@/lib/contratos";
import { BOTON_SECUNDARIO, CLASE_CONTROL } from "../crear/estilos";
import { marcaDeTiempo, type AccionEditor } from "./estado-editor";
import { paresSugeridos } from "../fuentes/catalogo";
import { cargarFuente } from "../fuentes/cargar-fuente";
import { SelectorTamano } from "./SelectorTamano";
import { SelectorTipografia } from "./SelectorTipografia";
import { conPresentacion, leerPresentacion, type Tamano } from "@/secciones/presentacion";

interface Props {
  doc: LandingDoc;
  brief: Brief;
  onAccion: (a: AccionEditor) => void;
}

const COLORES: { clave: keyof Tokens["colores"]; etiqueta: string }[] = [
  { clave: "fondo", etiqueta: "Fondo" },
  { clave: "superficie", etiqueta: "Superficie" },
  { clave: "texto", etiqueta: "Texto" },
  { clave: "textoSuave", etiqueta: "Texto suave" },
  { clave: "acento", etiqueta: "Acento" },
  { clave: "acentoTexto", etiqueta: "Texto sobre el acento" },
  { clave: "borde", etiqueta: "Borde" },
];

/** El selector nativo solo entiende #rrggbb: expande #rgb y, si el texto no es válido, muestra el color del texto de la primera paleta. */
function hexParaSelector(valor: string): string {
  if (!ColorHex.safeParse(valor).success) return PALETAS[0].colores.texto;
  return valor.length === 4 ? `#${[...valor.slice(1)].map((c) => c + c).join("")}` : valor;
}

const RADIOS: Tokens["radio"][] = [0, 4, 8, 16, 999];

/** Pares cuyo contraste se mide en vivo (AA para texto normal: 4,5). */
const PARES: { texto: keyof Tokens["colores"]; fondo: keyof Tokens["colores"]; etiqueta: string }[] = [
  { texto: "texto", fondo: "fondo", etiqueta: "Texto sobre fondo" },
  { texto: "acentoTexto", fondo: "acento", etiqueta: "Texto sobre el acento" },
];

function Contraste({ ratio }: { ratio: number }) {
  const ok = ratio >= CONTRASTE_TEXTO;
  return (
    <span
      data-contraste={ok ? "aa" : "bajo"}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${ok ? "border-contexto bg-contexto-suave text-contexto" : "border-error text-error"}`}
    >
      <span aria-hidden="true">{ok ? "✓" : "!"}</span>
      {ok ? "Cumple AA" : "Bajo AA"} · {ratio.toFixed(1).replace(".", ",")}:1
    </span>
  );
}

/** Titular real de la landing (el del héroe) para probar las tipografías; si no hay, el nombre del producto. */
function titularDe(doc: LandingDoc): string {
  const heroe = doc.secciones.find((s) => s.tipo === "heroe");
  const t = (heroe?.ajustes as { titular?: unknown } | undefined)?.titular;
  return typeof t === "string" && t.trim() ? t : doc.meta.producto;
}

export function PanelTema({ doc, brief, onAccion }: Props) {
  const { tokens } = doc;
  const [mantenerMarca, setMantenerMarca] = useState(false);
  const raiz = useRef<HTMLElement>(null);
  const coloresClave = Object.values(tokens.colores).join("|");
  // Animación corta de 150 ms en las muestras cuando cambian los colores (se omite con prefers-reduced-motion).
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    raiz.current?.querySelectorAll<HTMLElement>("[data-color-token] input[type=color]").forEach((el) => {
      el.animate?.([{ transform: "scale(0.8)", opacity: 0.4 }, { transform: "scale(1)", opacity: 1 }], { duration: 150, easing: "ease-out" });
    });
  }, [coloresClave]);

  const cambiar = (nuevo: Tokens, clave: string) => onAccion({ tipo: "editar-tokens", tokens: nuevo, clave, t: marcaDeTiempo() });
  const pares = paresSugeridos();
  const parActual = pares.find((t) => t.titulos === tokens.tipografia.titulos && t.cuerpo === tokens.tipografia.cuerpo);
  const titular = titularDe(doc);
  // Tamaño de letra de toda la landing: vive en la presentación del héroe (adaptador; ver peticiones.md).
  const heroe = doc.secciones.find((s) => s.tipo === "heroe");
  const tamGlobal: { titulos: Tamano; texto: Tamano } = heroe ? (leerPresentacion(heroe.ajustes).global ?? { titulos: "M", texto: "M" }) : { titulos: "M", texto: "M" };
  const guardarTamGlobal = (global: { titulos: Tamano; texto: Tamano }) => {
    if (!heroe) return;
    const vacio = global.titulos === "M" && global.texto === "M";
    const nueva = conPresentacion(heroe, { global: vacio ? undefined : global });
    onAccion({ tipo: "editar-seccion", id: heroe.id, seccion: nueva, clave: "tamano-global", t: marcaDeTiempo() });
  };
  const parSemilla = TIPOGRAFIAS.find((t) => t.id === doc.meta.semilla.tipografiaId) ?? TIPOGRAFIAS[0];
  const alDeLaSemilla = tokens.tipografia.titulos === parSemilla.titulos && tokens.tipografia.cuerpo === parSemilla.cuerpo;
  const elegirFamilia = (rol: "titulos" | "cuerpo", familia: string) => {
    cargarFuente(familia);
    cambiar({ ...tokens, tipografia: { ...tokens.tipografia, [rol]: familia } }, `tipografia-${rol}`);
  };
  const volverASemilla = () => {
    cambiar({ ...tokens, tipografia: { ...tokens.tipografia, titulos: parSemilla.titulos, cuerpo: parSemilla.cuerpo } }, "tipografia");
  };

  const hayMarca = (brief.coloresMarca?.length ?? 0) > 0;
  // Si la landing es oscura se prefieren paletas oscuras (temática «espacio»); ponderado, no excluyente.
  const tematica = contraste(tokens.colores.fondo, "#000000") < 3 ? "espacio" : undefined;
  const fondoActual = tokens.colores.fondo.toUpperCase();

  const otraSemilla = () => {
    const usarMarca = mantenerMarca && hayMarca;
    const tirada = otraSemillaDistinta(
      { semilla: doc.meta.semilla, tokens },
      { intensidad: tokens.intensidad, coloresMarca: usarMarca ? brief.coloresMarca : undefined },
    );
    const par = TIPOGRAFIAS.find((t) => t.id === tirada.semilla.tipografiaId);
    if (par) {
      cargarFuente(par.titulos);
      cargarFuente(par.cuerpo);
    }
    onAccion({ tipo: "editar-tokens", tokens: tokensParaBrief(tirada.semilla, { ...brief, intensidad: tokens.intensidad }, { respetarMarca: usarMarca }), semilla: tirada.semilla });
  };

  /** Cambia solo los colores: la tipografía y el resto de los tokens se quedan. */
  const aplicarPaleta = (p: Paleta) => {
    const colores = mantenerMarca && hayMarca ? aplicarColoresMarca({ ...tokens, colores: { ...p.colores } }, brief.coloresMarca ?? []).colores : { ...p.colores };
    onAccion({ tipo: "editar-tokens", tokens: aplicarColoresMarca({ ...tokens, colores }, []), semilla: { ...doc.meta.semilla, paletaId: p.id } });
  };
  const otraPaleta = () => {
    const otras = PALETAS.filter((p) => p.colores.fondo.toUpperCase() !== fondoActual);
    const pesos = otras.map((p) => pesoPaleta(p, tematica));
    let punto = Math.random() * pesos.reduce((a, b) => a + b, 0);
    const elegida = otras.find((_, i) => (punto -= pesos[i]) < 0) ?? otras[0];
    aplicarPaleta(elegida);
  };

  return (
    <section ref={raiz} aria-labelledby="titulo-tema" className="flex flex-col gap-4" data-panel-tema>
      <h2 id="titulo-tema" className="font-editorial text-lg font-semibold">
        Tema
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BOTON_SECUNDARIO} onClick={otraSemilla} data-otra-semilla>
          Otra semilla
        </button>
        <button type="button" className={BOTON_SECUNDARIO} onClick={otraPaleta} data-otra-paleta>
          Otra paleta
        </button>
        <p className="text-sm text-tinta-suave" data-semilla-actual>
          {doc.meta.semilla.estilo} × {doc.meta.semilla.industria}
        </p>
      </div>

      {hayMarca && (
        <label className="flex items-center gap-2 text-sm" data-mantener-marca>
          <input type="checkbox" className="size-5" checked={mantenerMarca} onChange={(e) => setMantenerMarca(e.target.checked)} />
          Mantener mis colores de marca
        </label>
      )}

      <div className="flex flex-col gap-2" data-paletas>
        <h3 className="text-sm font-medium">Paletas</h3>
        <ul className="grid grid-cols-2 gap-2">
          {PALETAS.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full flex-col gap-1 rounded border border-linea p-2 text-left text-xs hover:border-contexto aria-pressed:border-contexto aria-pressed:bg-contexto-suave"
                aria-pressed={doc.meta.semilla.paletaId === p.id}
                data-paleta={p.id}
                onClick={() => aplicarPaleta(p)}
              >
                <span className="flex h-6 overflow-hidden rounded" aria-hidden="true">
                  {[p.colores.fondo, p.colores.superficie, p.colores.texto, p.colores.acento].map((c, i) => (
                    <span key={i} className="flex-1" style={{ background: c }} />
                  ))}
                </span>
                {p.nombre}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        {COLORES.map(({ clave, etiqueta }) => {
          const valor = tokens.colores[clave];
          const valido = ColorHex.safeParse(valor).success;
          return (
            <div key={clave} className="flex items-center gap-2" data-color-token={clave}>
              <input
                type="color"
                aria-label={`Color: ${etiqueta}`}
                className="size-11 shrink-0 cursor-pointer rounded border border-linea bg-transparent p-0"
                value={hexParaSelector(valor)}
                onChange={(e) => cambiar({ ...tokens, colores: { ...tokens.colores, [clave]: e.target.value } }, `color-${clave}`)}
              />
              <div className="min-w-0 flex-1">
                <label htmlFor={`hex-${clave}`} className="block text-sm font-medium">
                  {etiqueta}
                </label>
                <input
                  id={`hex-${clave}`}
                  className={`${CLASE_CONTROL} min-h-9 py-1 font-mono text-sm`}
                  value={valor}
                  aria-invalid={valido ? undefined : true}
                  onChange={(e) => cambiar({ ...tokens, colores: { ...tokens.colores, [clave]: e.target.value } }, `color-${clave}`)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <ul className="flex flex-col gap-2" aria-label="Contraste de los colores">
        {PARES.map((p) => (
          <li key={p.etiqueta} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {p.etiqueta}
            {ColorHex.safeParse(tokens.colores[p.texto]).success && ColorHex.safeParse(tokens.colores[p.fondo]).success ? (
              <Contraste ratio={contraste(tokens.colores[p.texto], tokens.colores[p.fondo])} />
            ) : (
              <span className="text-xs text-error">Color no válido</span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3" data-tipografias>
        <h3 className="text-sm font-medium">Tipografías</h3>
        <SelectorTipografia rol="titulos" valor={tokens.tipografia.titulos} titular={titular} onElegir={(familia) => elegirFamilia("titulos", familia)} />
        <SelectorTipografia rol="cuerpo" valor={tokens.tipografia.cuerpo} titular={titular} onElegir={(familia) => elegirFamilia("cuerpo", familia)} />

        <div>
          <label htmlFor="tema-tipografia" className="mb-1 block text-sm font-medium">
            Pares sugeridos
          </label>
          <select
            id="tema-tipografia"
            className={CLASE_CONTROL}
            value={parActual?.id ?? "personalizada"}
            onChange={(e) => {
              const par = pares.find((t) => t.id === e.target.value);
              if (par) {
                cargarFuente(par.titulos);
                cargarFuente(par.cuerpo);
                cambiar({ ...tokens, tipografia: { ...tokens.tipografia, titulos: par.titulos, cuerpo: par.cuerpo } }, "tipografia");
              }
            }}
          >
            {!parActual && (
              <option value="personalizada">
                {tokens.tipografia.titulos} + {tokens.tipografia.cuerpo}
              </option>
            )}
            {pares.map((t) => (
              <option key={t.id} value={t.id}>
                {t.titulos} + {t.cuerpo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button type="button" className={BOTON_SECUNDARIO} disabled={alDeLaSemilla} onClick={volverASemilla} data-volver-semilla>
            Volver a la tipografía de la semilla
          </button>
          <p className="mt-1 text-sm text-tinta-suave">
            Semilla: {parSemilla.titulos} + {parSemilla.cuerpo}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3" data-tamano-global>
        <h3 className="text-sm font-medium">Tamaño de letra de toda la landing</h3>
        <SelectorTamano clave="global-titulos" etiqueta="Títulos" valor={tamGlobal.titulos} onCambio={(titulos) => guardarTamGlobal({ ...tamGlobal, titulos })} />
        <SelectorTamano clave="global-texto" etiqueta="Texto" valor={tamGlobal.texto} onCambio={(texto) => guardarTamGlobal({ ...tamGlobal, texto })} />
        <p className="text-xs text-tinta-suave">El texto del cuerpo nunca baja de 16 px. Cada sección puede cambiarlo aparte en Diseño.</p>
      </div>

      <div>
        <label htmlFor="tema-radio" className="mb-1 block text-sm font-medium">
          Radio de las esquinas
        </label>
        <select id="tema-radio" className={CLASE_CONTROL} value={tokens.radio} onChange={(e) => cambiar({ ...tokens, radio: Number(e.target.value) as Tokens["radio"] }, "radio")}>
          {RADIOS.map((r) => (
            <option key={r} value={r}>
              {r === 0 ? "Rectas (0)" : r === 999 ? "Píldora" : `${r} px`}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
