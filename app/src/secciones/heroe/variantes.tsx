"use client";

import { Boton } from "@/componentes/Boton";
import { Comparador } from "@/componentes/Comparador";
import { Icono } from "@/componentes/Icono";
import { MediaSlot } from "@/componentes/MediaSlot";
import { Titular } from "@/componentes/Titular";
import { BeneficiosCortos, SLOT_PRODUCTO, Sello, Subtitular, type Datos } from "./partes";

// Toda variante es centrada, superpuesta o apilada: nunca texto a un lado e imagen al otro,
// tampoco a 1280 px (regla 1 del proyecto y validadores anti-split).

const H1 = "text-balance font-titulos text-h1 font-semibold tracking-tight";

/**
 * Héroe espacial: el fondo del banco (`slots[0]`) a sangre con un velo del color de fondo (el titular cumple contraste AA) y el producto
 * en primer plano. La caja del producto mide al menos el 45 % del héroe (4:5, casi todo el alto) y el texto va superpuesto
 * en la parte de abajo, sobre un degradado: centrado y apilado, nunca partido.
 */
function HeroeSobreFondo({ ajustes, bloques, slotFondoPorDefecto, tipoFondo }: Datos & { slotFondoPorDefecto: string; tipoFondo: "imagen" | "video" }) {
  return (
    <section className="relative isolate flex min-h-[96svh] flex-col justify-end overflow-hidden text-center" data-heroe-espacial="">
      <div className="absolute inset-0 -z-30">
        <MediaSlot slot={ajustes.slots?.[0]} slotPorDefecto={slotFondoPorDefecto} relacion="16:9" tipo={tipoFondo} llenar prioridad sizes="100vw" />
      </div>
      <div aria-hidden="true" data-velo className="absolute inset-0 -z-20 bg-fondo/70" />
      <div
        data-producto=""
        className="absolute left-1/2 top-0 -z-10 w-[min(100%,calc(96svh*0.8))] -translate-x-1/2"
      >
        <MediaSlot slot={ajustes.slot} slotPorDefecto={SLOT_PRODUCTO} relacion="4:5" prioridad sizes="(min-width: 1024px) 40rem, 100vw" />
      </div>
      <div aria-hidden="true" data-velo-texto className="absolute inset-x-0 bottom-0 -z-[5] h-[60%] bg-gradient-to-t from-fondo via-fondo/85 to-transparent" />
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-5 pb-10 pt-40 md:pb-14">
        <Titular nivel="h1" className={H1}>
          {ajustes.titular}
        </Titular>
        <Subtitular>{ajustes.subtitular}</Subtitular>
        <Boton texto={ajustes.textoBoton} />
        <Sello texto={ajustes.sello} />
        <BeneficiosCortos bloques={bloques} />
      </div>
    </section>
  );
}

/** Producto grande y centrado (~60 % del viewport); titular encima, subtítulo y CTA debajo. */
export function ProductoMonumental({ ajustes, bloques }: Datos) {
  if (ajustes.slots?.[0]) return <HeroeSobreFondo ajustes={ajustes} bloques={bloques} slotFondoPorDefecto="heroe-fondo" tipoFondo="imagen" />;
  return (
    <section className="px-5 py-espacio text-center">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
        <Titular nivel="h1" className={H1}>
          {ajustes.titular}
        </Titular>
        <div className="w-[min(100%,calc(52svh*0.8))]">
          <MediaSlot slot={ajustes.slot} slotPorDefecto={SLOT_PRODUCTO} relacion="4:5" prioridad />
        </div>
        <Subtitular>{ajustes.subtitular}</Subtitular>
        <Boton texto={ajustes.textoBoton} />
        <Sello texto={ajustes.sello} />
        <BeneficiosCortos bloques={bloques} />
      </div>
    </section>
  );
}

/** Imagen a sangre; titular y CTA superpuestos en el tercio inferior sobre un velo del color de fondo. */
export function PosterASangre({ ajustes, bloques }: Datos) {
  if (ajustes.slots?.[0]) return <HeroeSobreFondo ajustes={ajustes} bloques={bloques} slotFondoPorDefecto="heroe-fondo" tipoFondo="imagen" />;
  return (
    <section className="relative isolate flex min-h-[88svh] flex-col justify-end overflow-hidden text-center">
      <div className="absolute inset-0 -z-20">
        <MediaSlot
          slot={ajustes.slot}
          slotPorDefecto="heroe-poster"
          relacion="4:5"
          llenar
          prioridad
          className="pb-[42%]"
        />
      </div>
      <div aria-hidden="true" data-velo className="absolute inset-x-0 bottom-0 -z-10 h-[62%] bg-gradient-to-t from-fondo via-fondo/90 to-transparent" />
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-5 pb-10 pt-40 md:pb-16">
        <Titular nivel="h1" className={H1}>
          {ajustes.titular}
        </Titular>
        <Subtitular>{ajustes.subtitular}</Subtitular>
        <Boton texto={ajustes.textoBoton} />
        <Sello texto={ajustes.sello} />
        <BeneficiosCortos bloques={bloques} />
      </div>
    </section>
  );
}

/** Titular gigante a todo el ancho; el producto aparece debajo, a un paso de su última línea (nunca encima: con 3 o 4 líneas la taparía). */
export function TitularTipografico({ ajustes, bloques }: Datos) {
  return (
    <section className="overflow-hidden px-5 py-espacio text-center">
      <div className="mx-auto flex max-w-6xl flex-col items-center">
        <Titular
          nivel="h1"
          className="relative z-0 text-balance break-words font-titulos text-display font-bold uppercase tracking-tighter"
        >
          {ajustes.titular}
        </Titular>
        <div className="relative z-10 mt-6 w-[min(80%,24rem)] md:mt-8">
          <MediaSlot slot={ajustes.slot} slotPorDefecto={SLOT_PRODUCTO} relacion="4:5" prioridad />
        </div>
        <div className="mt-8 flex flex-col items-center gap-6">
          <Subtitular>{ajustes.subtitular}</Subtitular>
          <Boton texto={ajustes.textoBoton} />
          <Sello texto={ajustes.sello} />
          <BeneficiosCortos bloques={bloques} />
        </div>
      </div>
    </section>
  );
}

/** Solo texto: la pregunta de dolor centrada, sin imagen y con indicador de scroll. */
export function ProblemaPrimero({ ajustes, bloques }: Datos) {
  return (
    <section className="flex min-h-[88svh] flex-col items-center justify-center px-5 py-espacio text-center">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8">
        <Titular
          nivel="h1"
          className="text-balance font-titulos text-[calc(clamp(2.5rem,9vw,5.5rem)*var(--escala-t,var(--escala)))] font-semibold leading-[1.02] tracking-tight"
        >
          {ajustes.titular}
        </Titular>
        <Subtitular>{ajustes.subtitular}</Subtitular>
        <Boton texto={ajustes.textoBoton} />
        <Sello texto={ajustes.sello} />
        <BeneficiosCortos bloques={bloques} />
      </div>
      <div aria-hidden="true" className="flecha-scroll mt-12 text-suave">
        <Icono nombre="flecha-abajo" className="size-7" />
      </div>
    </section>
  );
}

/** Titular centrado arriba y comparador antes/después a todo el ancho debajo. */
export function AntesDespuesHeroe({ ajustes, bloques }: Datos) {
  const [antes = "heroe-antes", despues = "heroe-despues"] = ajustes.slots ?? [];
  return (
    <section className="px-5 py-espacio text-center">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6">
        <Titular nivel="h1" className={H1}>
          {ajustes.titular}
        </Titular>
        <Subtitular>{ajustes.subtitular}</Subtitular>
        <div className="w-full">
          <Comparador
            slotAntes={antes}
            slotDespues={despues}
            relacion="16:9"
            nombre={`${ajustes.titular}: comparar antes y después`}
          />
        </div>
        <Boton texto={ajustes.textoBoton} />
        <Sello texto={ajustes.sello} />
        <BeneficiosCortos bloques={bloques} />
      </div>
    </section>
  );
}

/** Clip en loop a sangre con velo, titular centrado y CTA; póster de respaldo (`<slot>-poster`). */
export function VideoInmersivo({ ajustes, bloques }: Datos) {
  if (ajustes.slots?.[0]) return <HeroeSobreFondo ajustes={ajustes} bloques={bloques} slotFondoPorDefecto="heroe-video" tipoFondo="video" />;
  return (
    <section className="relative isolate flex min-h-[92svh] flex-col justify-end overflow-hidden text-center">
      <div className="absolute inset-0 -z-20">
        <MediaSlot
          slot={ajustes.slot}
          slotPorDefecto="heroe-video"
          relacion="16:9"
          tipo="video"
          llenar
          prioridad
          className="pb-[45%]"
        />
      </div>
      <div aria-hidden="true" data-velo className="absolute inset-0 -z-10 bg-fondo/55" />
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-5 pb-12 pt-40 md:pb-20">
        <Titular nivel="h1" className={H1}>
          {ajustes.titular}
        </Titular>
        <Subtitular>{ajustes.subtitular}</Subtitular>
        <Boton texto={ajustes.textoBoton} />
        <Sello texto={ajustes.sello} />
        <BeneficiosCortos bloques={bloques} />
      </div>
    </section>
  );
}

const POSICIONES_ORBITA: Record<number, string[]> = {
  1: ["md:left-0 md:top-[10%]"],
  2: ["md:left-0 md:top-[10%]", "md:right-0 md:top-[10%]"],
  3: ["md:left-0 md:top-[12%]", "md:right-0 md:top-[12%]", "md:bottom-2 md:left-1/2 md:-translate-x-1/2"],
  4: ["md:left-0 md:top-[8%]", "md:right-0 md:top-[8%]", "md:bottom-[8%] md:left-[3%]", "md:bottom-[8%] md:right-[3%]"],
};

/** Producto al centro y beneficios alrededor (escritorio); en móvil, producto y lista debajo. */
export function OrbitaBeneficios({ ajustes, bloques }: Datos) {
  const posiciones = POSICIONES_ORBITA[bloques.length] ?? [];
  return (
    <section className="overflow-hidden px-5 pb-10 pt-10 text-center md:pt-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4">
        <Titular
          nivel="h1"
          className="text-balance font-titulos text-[calc(clamp(2rem,5.5vw,3.5rem)*var(--escala-t,var(--escala)))] font-semibold leading-[1.05] tracking-tight"
        >
          {ajustes.titular}
        </Titular>
        <Subtitular>{ajustes.subtitular}</Subtitular>
        <div className="relative w-full md:h-[27rem]">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 hidden size-[25rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-borde md:block"
          />
          <div className="relative mx-auto w-[min(72%,17rem)] md:absolute md:left-1/2 md:top-1/2 md:w-52 md:-translate-x-1/2 md:-translate-y-1/2">
            <MediaSlot slot={ajustes.slot} slotPorDefecto={SLOT_PRODUCTO} relacion="4:5" prioridad />
          </div>
          <ul className="mx-auto mt-6 flex max-w-sm flex-col gap-2 md:mt-0 md:max-w-none">
            {bloques.map((bloque, i) => (
              <li
                key={bloque.id}
                className={`borde-token flex items-center gap-3 rounded-token bg-superficie px-4 py-3 text-left text-sm md:absolute md:w-56 ${posiciones[i] ?? ""}`}
              >
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-acento text-xs font-semibold text-acento-texto"
                >
                  {i + 1}
                </span>
                {bloque.ajustes.texto}
              </li>
            ))}
          </ul>
        </div>
        <Boton texto={ajustes.textoBoton} />
        <Sello texto={ajustes.sello} />
      </div>
    </section>
  );
}

const CELDAS_MOSAICO: Record<number, string[]> = {
  3: ["row-span-2", "col-span-2", "col-span-2"],
  4: ["row-span-2", "col-span-2", "col-span-1", "col-span-1"],
  5: ["row-span-2", "col-span-1", "col-span-1", "col-span-1", "col-span-1"],
};

/** Collage asimétrico de 3 a 5 imágenes; la franja del titular cruza el collage. */
export function MosaicoEditorial({ ajustes, bloques }: Datos) {
  const pedidos = ajustes.slots ?? [];
  const cantidad = Math.min(5, Math.max(3, pedidos.length || 4));
  const slots = Array.from({ length: cantidad }, (_, i) => pedidos[i] ?? `heroe-mosaico-${i + 1}`);

  return (
    <section className="py-espacio text-center">
      <div className="relative">
        <div className="mx-auto max-w-5xl px-5">
          <ul className="grid h-[70svh] grid-cols-3 grid-rows-2 gap-2 md:h-[34rem]">
            {slots.map((slot, i) => (
              <li key={slot} className={`min-h-0 overflow-hidden rounded-tarjeta ${CELDAS_MOSAICO[cantidad][i]}`}>
                <MediaSlot slot={slot} slotPorDefecto={slot} relacion="4:5" llenar compacto prioridad={i === 0} className={i === 0 ? "justify-start! pt-6" : ""} />
              </li>
            ))}
          </ul>
        </div>
        <div className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 bg-acento px-5 py-3 md:py-5">
          <Titular
            nivel="h1"
            className="mx-auto max-w-5xl text-balance font-titulos text-h1 font-bold uppercase leading-none tracking-tight text-acento-texto"
          >
            {ajustes.titular}
          </Titular>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-3xl flex-col items-center gap-6 px-5">
        <Subtitular>{ajustes.subtitular}</Subtitular>
        <Boton texto={ajustes.textoBoton} />
        <Sello texto={ajustes.sello} />
        <BeneficiosCortos bloques={bloques} />
      </div>
    </section>
  );
}
