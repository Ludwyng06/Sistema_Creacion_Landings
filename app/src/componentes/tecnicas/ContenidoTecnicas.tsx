import { EJEMPLOS } from "@/datos/ejemplos";
import type { BloquePrompt } from "@/lib/contratos";
import { combinar } from "@/lib/tecnicas/combinador";
import { lintearTexto } from "@/lib/tecnicas/lista-negra";
import { modulos } from "@/lib/tecnicas/modulos";
import { EjemploCombinador } from "./EjemploCombinador";

// Contenido de /tecnicas. Las técnicas salen de `modulos` (nada de sus textos se copia a mano).
// Los fragmentos que citan la lista negra (técnica 7) se muestran como dato: van dentro de
// `<pre data-lista-negra="true">` y el linter de los tests de la página los excluye.

const BLOQUES: { id: BloquePrompt; nombre: string; caja: string; titulo: string; marca: string; descripcion: string }[] = [
  { id: "rol", nombre: "Rol", caja: "border-rol bg-rol-suave", titulo: "text-rol", marca: "bg-rol text-marca-texto", descripcion: "Quién es la IA: un experto concreto con vocabulario propio." },
  { id: "tarea", nombre: "Tarea", caja: "border-tarea bg-tarea-suave", titulo: "text-tarea", marca: "bg-tarea text-marca-texto", descripcion: "Qué debe hacer, en pasos numerados y con instrucciones positivas." },
  { id: "contexto", nombre: "Contexto", caja: "border-contexto bg-contexto-suave", titulo: "text-contexto", marca: "bg-contexto text-marca-texto", descripcion: "El brief, los tokens, las secciones disponibles y ejemplos few-shot." },
  { id: "formato", nombre: "Formato", caja: "border-formato bg-formato-suave", titulo: "text-formato", marca: "bg-formato text-marca-texto", descripcion: "El contrato de salida: un único JSON, razonando primero y sin texto extra." },
];

const FASE: Record<string, string> = { descubrir: "Descubrir", definir: "Definir", entregar: "Entregar" };

/** Qué comprueba el verificador de cada técnica (docs/04, «Salida verificable»). */
const VERIFICADOR: Record<string, string> = {
  semilla: "Los colores son hex válidos y la tipografía pertenece a la biblioteca de parejas.",
  ambicioso: "Cada sección declara su objetivo y cada objeción del brief tiene respuesta.",
  critico: "El documento trae la puntuación del auditor.",
  imagenes: "Cada recurso tiene su prompt de Grok con el bloque de consistencia.",
  video: "Los efectos pertenecen al catálogo, encajan con la sección y hay como máximo 3 de nivel 3.",
  sustractivo: "De 5 a 16 secciones, sin objetivos repetidos y un formulario de 3 campos obligatorios como máximo.",
  negativas: "El linter recorre todos los textos y debe dar cero infracciones.",
  humana: "Los botones prometen un beneficio y las frases miden de 8 a 18 palabras.",
};

const CONFLICTOS = [
  "Colores y tipografías: mandan los tokens de la semilla; solo los colores de marca del brief los reemplazan.",
  "Cantidad de secciones y de campos: manda el diseño sustractivo sobre el prompt ambicioso.",
  "Texto: mandan las restricciones negativas y la redacción humana sobre cualquier copy propuesto.",
  "Formato: se entrega siempre un único JSON LandingDoc.",
  "Sin técnicas elegidas se usa el perfil Esencial (2 + 6 + 7) y la técnica 7 se suma siempre.",
];

function Fragmento({ texto, clase }: { texto: string; clase: string }) {
  const cita = lintearTexto(texto).length > 0;
  if (cita) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-tinta-suave">Cita la lista negra: se muestra como dato</p>
        <pre data-lista-negra="true" className={`whitespace-pre-wrap rounded-sm border border-dashed p-2 font-ui text-sm ${clase}`}>
          {texto}
        </pre>
      </div>
    );
  }
  return <p className={`whitespace-pre-line rounded-sm p-2 text-sm ${clase}`}>{texto}</p>;
}

export function ContenidoTecnicas() {
  const ejemplo = EJEMPLOS[0];
  const prompt = combinar(ejemplo.brief, []);
  // El fragmento de la técnica 7 que cita la lista negra vive en su tarjeta, no en este ejemplo.
  const citaNegativas = prompt.aportes.filter((a) => a.tecnica === "negativas" && a.bloque === "contexto").map((a) => a.texto);
  const contexto = citaNegativas.reduce((t, c) => t.replace(c, "").replace(/\n{3,}/g, "\n\n"), prompt.contexto);
  const textos: Record<BloquePrompt, string> = { rol: prompt.rol, tarea: prompt.tarea, contexto, formato: prompt.formato };
  const porPrioridad = [...modulos].sort((a, b) => a.prioridad - b.prioridad);
  const ligeras = modulos.map((m) => ({ id: m.id, numero: m.numero, nombre: m.nombre }));

  return (
    <div className="flex flex-col gap-16">
      <section aria-labelledby="t-intro" className="flex max-w-3xl flex-col gap-4">
        <h2 id="t-intro" className="font-editorial text-3xl font-semibold tracking-tight">
          Un sistema experto para diseñar landings
        </h2>
        <p>
          Un sistema experto reúne el conocimiento de especialistas y lo aplica a un caso concreto, como lo haría una persona con años de oficio. Tiene tres piezas: una base de conocimiento, un motor de inferencia y una explicación de lo que decidió.
        </p>
        <p>
          Aquí la base de conocimiento son las 8 técnicas de diseño con IA: cada una guarda su rol, sus pasos, su contexto y su manera de verificar el resultado. El motor de inferencia es el combinador: recibe tu brief y las técnicas que elijas, las ordena, resuelve los cruces entre ellas y arma un solo prompt.
        </p>
        <p>
          La explicación es la tabla «técnica → qué aportó → en qué bloque», que verás más abajo y en el paso 3 de <code>/crear</code>. Nada queda en una caja negra: puedes leer qué frase vino de qué técnica y comprobar el resultado con verificadores escritos en código.
        </p>
      </section>

      <section aria-labelledby="t-anatomia" className="flex flex-col gap-5">
        <div className="max-w-3xl">
          <h2 id="t-anatomia" className="font-editorial text-3xl font-semibold tracking-tight">
            La anatomía de 4 bloques
          </h2>
          <p className="text-tinta-suave">
            Todo prompt del sistema se arma con Rol, Tarea, Contexto y Formato. Este ejemplo es real: sale de <code>combinar</code> con el brief de «{ejemplo.brief.nombre}» y sin técnicas elegidas.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {BLOQUES.map((b) => (
            <article key={b.id} className={`flex flex-col gap-2 rounded-md border p-4 ${b.caja}`} data-bloque={b.id}>
              <h3 className={`font-editorial text-xl font-semibold ${b.titulo}`}>{b.nombre}</h3>
              <p className="text-sm">{b.descripcion}</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-sm bg-papel p-3 font-ui text-sm">{textos[b.id]}</pre>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="t-tecnicas" className="flex flex-col gap-5">
        <div className="max-w-3xl">
          <h2 id="t-tecnicas" className="font-editorial text-3xl font-semibold tracking-tight">
            Las 8 técnicas
          </h2>
          <p className="text-tinta-suave">Cada tarjeta lee su módulo: el rol, los pasos, el contexto y el formato que la técnica añade al prompt.</p>
        </div>
        <ol className="grid gap-5 lg:grid-cols-2">
          {modulos.map((m) => (
            <li key={m.id} data-tecnica={m.id} className="flex flex-col gap-4 rounded-md border border-linea p-5">
              <div className="flex items-start gap-4">
                <span aria-hidden="true" className="font-editorial text-4xl font-semibold leading-none text-marca">
                  {m.numero}
                </span>
                <div>
                  <h3 className="font-editorial text-2xl font-semibold">{m.nombre}</h3>
                  <p className="text-sm text-tinta-suave">Fase: {FASE[m.fase]}</p>
                </div>
              </div>
              <p>{m.descripcionCorta}</p>
              <div className="flex flex-col gap-3">
                {m.aporta.rol && (
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-semibold text-rol">Rol</h4>
                    <Fragmento texto={m.aporta.rol} clase="bg-rol-suave" />
                  </div>
                )}
                {m.aporta.tarea && m.aporta.tarea.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-semibold text-tarea">Tarea</h4>
                    {m.aporta.tarea.map((t) => (
                      <Fragmento key={t} texto={t} clase="bg-tarea-suave" />
                    ))}
                  </div>
                )}
                {m.aporta.contexto && m.aporta.contexto.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-semibold text-contexto">Contexto</h4>
                    {m.aporta.contexto.map((t) => (
                      <Fragmento key={t} texto={t} clase="bg-contexto-suave" />
                    ))}
                  </div>
                )}
                {m.aporta.formato && m.aporta.formato.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-semibold text-formato">Formato</h4>
                    {m.aporta.formato.map((t) => (
                      <Fragmento key={t} texto={t} clase="bg-formato-suave" />
                    ))}
                  </div>
                )}
              </div>
              <p className="border-t border-linea pt-3 text-sm">
                <span className="font-medium">Verificador:</span> {m.verificador ? VERIFICADOR[m.id] : "No tiene verificador automático."}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="t-combinador" className="flex flex-col gap-5">
        <div className="max-w-3xl">
          <h2 id="t-combinador" className="font-editorial text-3xl font-semibold tracking-tight">
            El combinador
          </h2>
          <p className="text-tinta-suave">Cuando eliges 2 o más técnicas, el motor las aplica en este orden y funde cada bloque en uno solo.</p>
        </div>
        <ol className="flex flex-wrap gap-2" aria-label="Orden de aplicación" data-testid="orden-aplicacion">
          {porPrioridad.map((m, i) => (
            <li key={m.id} className="flex items-center gap-2 rounded-md border border-linea px-3 py-2 text-sm">
              <span className="font-editorial text-lg font-semibold text-marca">{m.numero}</span>
              {m.nombre}
              {i < porPrioridad.length - 1 && <span aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>
        <div className="max-w-3xl">
          <h3 className="font-editorial text-xl font-semibold">Cuando dos técnicas se cruzan</h3>
          <ul className="ml-5 mt-2 list-disc space-y-1">
            {CONFLICTOS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
        <EjemploCombinador tecnicas={ligeras} brief={ejemplo.brief} />
      </section>

      <section aria-labelledby="t-mantenimiento" className="flex max-w-3xl flex-col gap-4">
        <h2 id="t-mantenimiento" className="font-editorial text-3xl font-semibold tracking-tight">
          Meta-prompting y bucle de mantenimiento
        </h2>
        <p>
          <strong>Mejorar prompt.</strong> El botón le pide a la IA que actúe como experta en ingeniería de prompts: reescribe el prompt manteniendo sus 4 bloques, vuelve más específicas las instrucciones de la Tarea y añade un ejemplo few-shot al Contexto. Así la IA también diseña prompts.
        </p>
        <p>
          <strong>Diseñar → Evaluar → Refinar.</strong> Cuando un resultado no convence, marcas qué bloque falló (Rol, Tarea, Contexto o Formato) y corriges esa instrucción, no el resultado. Cada landing del banco guarda sus versiones para poder comparar.
        </p>
      </section>
    </div>
  );
}
