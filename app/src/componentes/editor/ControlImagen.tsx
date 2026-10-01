"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { MarcadorAsset } from "@/componentes/MarcadorAsset";
import { BOTON_PEQUENO, CLASE_CONTROL } from "../crear/estilos";
import { BANCOS, buscarMedios, focoDe, leerFoco, type MedioBusqueda, type ResultadoMedios } from "./bancos";
import type { ContextoSlots } from "./ControlCampo";

/** Buscador de los bancos de medios: filtro por banco, texto y orientación; elegir una imagen la deja en el slot. */
function BuscadorBancos({ nombre, slots }: { nombre: string; slots: ContextoSlots }) {
  const [banco, setBanco] = useState("");
  const [q, setQ] = useState("");
  const [orientacion, setOrientacion] = useState<"" | MedioBusqueda["orientacion"]>("");
  const [resultado, setResultado] = useState<ResultadoMedios | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = useId();

  async function buscar() {
    setBuscando(true);
    setError(null);
    try {
      setResultado(await (slots.buscarMedios ?? buscarMedios)({ banco: banco || undefined, q, orientacion: orientacion || undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos consultar los bancos.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-linea bg-papel-hondo p-2" data-buscador-bancos={nombre}>
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 flex flex-col gap-1 text-xs">
          Qué buscas
          <input className={CLASE_CONTROL} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void buscar())} placeholder="Luna, aurora, cohete…" />
        </label>
        <label className="flex flex-col gap-1 text-xs" htmlFor={`${base}-banco`}>
          Banco
          <select id={`${base}-banco`} className={CLASE_CONTROL} value={banco} onChange={(e) => setBanco(e.target.value)}>
            <option value="">Todos</option>
            {BANCOS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" htmlFor={`${base}-orientacion`}>
          Forma
          <select id={`${base}-orientacion`} className={CLASE_CONTROL} value={orientacion} onChange={(e) => setOrientacion(e.target.value as typeof orientacion)}>
            <option value="">Cualquiera</option>
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
            <option value="cuadrada">Cuadrada</option>
          </select>
        </label>
      </div>
      <button type="button" className={`${BOTON_PEQUENO} self-start`} disabled={buscando} onClick={() => void buscar()}>
        {buscando ? "Buscando…" : "Buscar"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      {resultado?.simulado && <p className="text-xs text-tinta-suave">Muestra de prueba: los bancos reales llegan con la API de medios.</p>}
      {resultado && resultado.medios.length === 0 && <p className="text-sm text-tinta-suave">Sin resultados. Prueba con otra palabra o con «Todos» los bancos.</p>}
      {resultado && resultado.medios.length > 0 && (
        <ul className="grid grid-cols-2 gap-2" data-resultados-bancos>
          {resultado.medios.map((m) => (
            <li key={m.id}>
              <button type="button" data-medio={m.id} onClick={() => slots.onMedio?.(nombre, m)} className="flex w-full flex-col gap-1 rounded-md border border-linea bg-papel p-1 text-left hover:border-marca focus-visible:outline-2 focus-visible:outline-marca">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.ruta} alt={m.titulo} loading="lazy" className="aspect-[4/3] w-full rounded-sm object-cover" />
                <span className="truncate text-xs font-medium">{m.titulo}</span>
                <span className="truncate text-xs text-tinta-suave">{m.credito}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Control «Imagen» del inspector: subir, buscar en bancos, copiar el prompt y elegir el foco. */
export function ControlImagen({ nombre, onNombre, id, slots }: { nombre: string; onNombre: (n: string) => void; id: string; slots: ContextoSlots }) {
  const asset = slots.assets.find((a) => a.slot === nombre);
  const ocupado = slots.subiendo === nombre;
  const fallo = slots.errorSubida?.slot === nombre ? slots.errorSubida.mensaje : null;
  const [abiertoAMano, setBancos] = useState(false);
  // Se abre solo si vino de «Buscar en bancos» en el marcador de esta imagen.
  const bancos = abiertoAMano || (nombre !== "" && slots.abrirBancos === nombre);
  const [foco, setFoco] = useState(false);
  const actual = leerFoco(slots.focos?.[nombre]);
  const esImagen = asset?.ruta && asset.tipo !== "video";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-linea p-3" data-slot-editor={nombre}>
      <input id={id} aria-label="Nombre del slot" className={`${CLASE_CONTROL} font-mono text-sm`} value={nombre} onChange={(e) => onNombre(e.target.value)} />
      {asset?.ruta ? (
        asset.tipo === "video" ? (
          <video src={asset.ruta} aria-label={asset.alt} className="max-h-40 w-full rounded-md object-cover" muted playsInline controls />
        ) : (
          <Image src={asset.ruta} alt={asset.alt} width={320} height={200} unoptimized style={{ objectPosition: `${actual.x}% ${actual.y}%` }} className="h-32 w-full rounded-md object-cover" />
        )
      ) : (
        <div className="max-w-[10rem]">
          <MarcadorAsset slot={nombre || "sin-nombre"} relacion={asset?.relacion ?? "4:5"} tipo={asset?.tipo} promptGrok={asset?.promptGrok} compacto />
        </div>
      )}
      {asset?.credito && <p className="text-xs text-tinta-suave">Crédito: {asset.credito}</p>}
      <div className="flex flex-wrap gap-1.5">
        <label className={`${BOTON_PEQUENO} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marca ${ocupado ? "opacity-60" : ""}`}>
          {ocupado ? "Subiendo…" : "Subir archivo"}
          <input
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp,image/avif,video/mp4"
            disabled={ocupado || nombre === ""}
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) slots.onSubir(nombre, archivo);
              e.target.value = "";
            }}
          />
        </label>
        <button type="button" className={BOTON_PEQUENO} aria-expanded={bancos} disabled={nombre === ""} onClick={() => setBancos(!bancos)}>
          Buscar en bancos
        </button>
        {esImagen && (
          <button type="button" className={BOTON_PEQUENO} aria-expanded={foco} onClick={() => setFoco((v) => !v)}>
            Foco
          </button>
        )}
      </div>
      {bancos && <BuscadorBancos nombre={nombre} slots={slots} />}
      {foco && esImagen && (
        <fieldset className="flex flex-col gap-2 rounded-md border border-linea p-2" data-foco={nombre}>
          <legend className="px-1 text-xs">Qué parte de la imagen queda a la vista</legend>
          {(["x", "y"] as const).map((eje) => (
            <label key={eje} className="flex items-center gap-2 text-xs">
              <span className="w-16">{eje === "x" ? "Horizontal" : "Vertical"}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={actual[eje]}
                aria-valuetext={`${actual[eje]} %`}
                className="min-w-0 flex-1 accent-marca"
                onChange={(e) => {
                  const nuevo = { ...actual, [eje]: Number(e.target.value) };
                  slots.onFoco?.(nombre, nuevo.x === 50 && nuevo.y === 50 ? null : focoDe(nuevo.x, nuevo.y));
                }}
              />
              <span className="w-9 text-right tabular-nums">{actual[eje]} %</span>
            </label>
          ))}
          <button type="button" className={`${BOTON_PEQUENO} self-start`} onClick={() => slots.onFoco?.(nombre, null)}>
            Centrar
          </button>
        </fieldset>
      )}
      {fallo && (
        <p role="alert" className="text-sm text-error">
          {fallo}
        </p>
      )}
    </div>
  );
}
