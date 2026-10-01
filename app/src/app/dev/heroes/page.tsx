import { notFound } from "next/navigation";
import { LandingRender } from "@/componentes/LandingRender";
import { VARIANTES_HEROE } from "@/lib/contratos";
import { ejemplos, assets } from "@/secciones/heroe/ejemplo";
import { armarDoc, TOKENS_BAUHAUS } from "../secciones/documentos";

export const metadata = { title: "Héroes con titulares largos · desarrollo" };

export const TITULARES = {
  tres: "Limpieza profunda con una sola mano",
  cuatro: "Limpieza profunda para toda la familia con una sola mano y sin complicarte",
} as const;

/** Banco de pruebas: las 8 variantes de héroe con un titular de 3 y otro de 4 líneas. `tests/e2e/dia8-heroes.ts` mide que el titular no se cruce con la imagen. */
export default function PaginaHeroes() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main>
      {VARIANTES_HEROE.flatMap((variante) =>
        (Object.entries(TITULARES) as [keyof typeof TITULARES, string][]).map(([largo, titular]) => {
          const base = ejemplos[variante];
          const seccion = { ...base, id: `${base.id}-${largo}`, ajustes: { ...base.ajustes, titular } };
          const doc = armarDoc(`heroe-${variante}-${largo}`, variante, TOKENS_BAUHAUS, [seccion], assets);
          return (
            <div key={`${variante}-${largo}`} data-caso={`${variante}:${largo}`} data-variante={variante} className="border-b-4 border-dashed border-linea">
              <LandingRender doc={doc} reducirMovimiento />
            </div>
          );
        }),
      )}
    </main>
  );
}
