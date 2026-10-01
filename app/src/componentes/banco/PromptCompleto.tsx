import { BLOQUES_PROMPT, NOMBRE_TECNICA } from "@/lib/banco";
import type { LandingCompleta } from "@/lib/landings";
import { ESTILO_BLOQUE } from "./estilos";

/** El prompt que creó la landing: sus 4 bloques con color, las técnicas usadas y la tabla de aportes. */
export function PromptCompleto({ landing }: { landing: LandingCompleta }) {
  const { promptBloques: prompt, tecnicas, doc } = landing;
  const semilla = doc.meta.semilla;

  return (
    <div className="flex flex-col gap-5" data-prompt>
      <div className="flex flex-col gap-2">
        <h2 className="font-editorial text-2xl font-semibold tracking-tight">El prompt que la creó</h2>
        <ul className="flex flex-wrap gap-1.5" aria-label="Técnicas usadas" data-tecnicas>
          {tecnicas.map((id) => (
            <li key={id} className="rounded-full border border-linea px-2.5 py-0.5 text-xs">
              {NOMBRE_TECNICA(id)}
            </li>
          ))}
        </ul>
        <p className="text-sm text-tinta-suave" data-semilla>
          Semilla {semilla.numero}: {semilla.estilo} × {semilla.industria}
        </p>
      </div>

      <div className="grid gap-4" data-bloques>
        {BLOQUES_PROMPT.map((b) => {
          const e = ESTILO_BLOQUE[b];
          return (
            <section key={b} data-bloque={b} aria-labelledby={`detalle-${b}`} className={`rounded-md border-l-4 p-4 ${e.caja}`}>
              <h3 id={`detalle-${b}`} className={`mb-2 font-editorial text-lg font-semibold ${e.titulo}`}>
                {e.nombre}
              </h3>
              <p
                tabIndex={0}
                aria-label={`Texto del bloque ${e.nombre}`}
                className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
              >
                {prompt[b]}
              </p>
            </section>
          );
        })}
      </div>

      <section aria-labelledby="detalle-aportes">
        <h3 id="detalle-aportes" className="mb-3 font-editorial text-lg font-semibold">
          Qué aportó cada técnica
        </h3>
        {prompt.aportes.length === 0 ? (
          <p className="text-sm text-tinta-suave">Esta landing se creó sin técnicas elegidas.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-linea">
            <table className="w-full min-w-[30rem] border-collapse text-left text-sm" data-aportes>
              <thead className="bg-papel-hondo">
                <tr>
                  <th scope="col" className="p-3 font-medium">
                    Técnica
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    Qué aportó
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    Bloque
                  </th>
                </tr>
              </thead>
              <tbody>
                {prompt.aportes.map((a, i) => (
                  <tr key={i} data-aporte className="border-t border-linea align-top">
                    <th scope="row" className="p-3 font-medium">
                      {NOMBRE_TECNICA(a.tecnica)}
                    </th>
                    <td className="p-3 text-tinta-suave">{a.texto}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs ${ESTILO_BLOQUE[a.bloque].marca}`}>{ESTILO_BLOQUE[a.bloque].nombre}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
