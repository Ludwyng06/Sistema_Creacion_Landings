"use client";

import { useMemo, useState } from "react";
import { CATEGORIAS_BRIEF, type NivelConciencia } from "@/lib/contratos";
import { formatearDinero, MONEDAS } from "@/componentes/dinero";
import { aBrief, BORRADOR_VACIO, COLOR_INICIAL, erroresDelBrief, MAX_BENEFICIOS, MAX_COLORES, MIN_BENEFICIOS, numeroDeTexto, type BorradorBrief } from "./borrador";
import { pedirObjeciones } from "./api";
import { Campo } from "./Campo";
import { EJEMPLOS, type EjemploBanco } from "@/datos/ejemplos";
import { BOTON_PEQUENO, BOTON_SECUNDARIO, CLASE_CONTROL, TITULO_SECCION } from "./estilos";
import { BarraSugerida, ChipsFuentes } from "./BarraSugerida";
import { REVISION_VACIA, type RevisionBorrador } from "./estado";
import { aplicarBorrador, type CampoSugerible, type PrecioReferencia, type RespuestaInvestigar } from "./investigar";
import { TarjetaFoto } from "./TarjetaFoto";
import { ListaEditable } from "./ListaEditable";
import { PanelInvestigar } from "./PanelInvestigar";

const CATEGORIAS: Record<(typeof CATEGORIAS_BRIEF)[number], string> = {
  "salud-y-bienestar": "Salud y bienestar",
  hogar: "Hogar",
  tecnologia: "Tecnología",
  belleza: "Belleza",
  "moda-y-accesorios": "Moda y accesorios",
  mascotas: "Mascotas",
  deporte: "Deporte",
  cocina: "Cocina",
  bebes: "Bebés",
  otro: "Otro",
};

const NIVELES: { valor: NivelConciencia; nombre: string; explicacion: string }[] = [
  { valor: "inconsciente", nombre: "No sabe que tiene el problema", explicacion: "La página abre con una escena que reconozca." },
  { valor: "problema", nombre: "Siente el problema", explicacion: "Aún no busca una solución: se le nombra el dolor y se le muestra el camino." },
  { valor: "solucion", nombre: "Busca soluciones", explicacion: "Compara opciones: hay que mostrar por qué esta funciona." },
  { valor: "producto", nombre: "Conoce el producto", explicacion: "Duda si comprarlo: hacen falta pruebas y respuestas." },
  { valor: "total", nombre: "Ya te conoce", explicacion: "Solo necesita la oferta y un motivo para decidir hoy." },
];

const INTENSIDADES: { valor: 1 | 2 | 3; nombre: string; cambia: string }[] = [
  { valor: 1, nombre: "Sobria", cambia: "Revelados suaves y precio animado; nada más se mueve." },
  { valor: 2, nombre: "Audaz", cambia: "Suma titulares que se arman, máscaras y botones que atraen al cursor." },
  { valor: 3, nombre: "De otro mundo", cambia: "Suma video con scroll, secciones fijadas y scroll horizontal." },
];

interface Props {
  brief: BorradorBrief;
  onCambio: (cambios: Partial<BorradorBrief>) => void;
  /** Carga el brief de un ejemplo con sus técnicas y su número de semilla. */
  onEjemplo: (ejemplo: EjemploBanco) => void;
  /** Campos pre-llenados por la investigación y su estado de revisión. */
  revision?: RevisionBorrador;
  /** La persona intentó avanzar con el paso incompleto: se muestran todos los errores. */
  intentoAvanzar?: boolean;
  onAplicarBorrador?: (datos: { cambios: Partial<BorradorBrief>; meta: RevisionBorrador["meta"]; precioReferencia: PrecioReferencia | null }) => void;
  onAceptarSugerido?: (campo: CampoSugerible) => void;
  onAceptarTodoSugerido?: () => void;
  onQuitarSugerido?: (campo: CampoSugerible, cambios: Partial<BorradorBrief>) => void;
}

/** Clave de error de Zod a la que pertenece el control con este `id` (para saber qué errores mostrar tras el blur). */
export function claveDeErrorPorId(id: string): string | null {
  const fijos: Record<string, string> = {
    "brief-nombre": "nombre",
    "brief-categoria": "categoria",
    "brief-problema": "problema",
    "brief-publico": "publico",
    "brief-precio": "precio.valor",
    "brief-precio-anterior": "precio.anterior",
    "brief-calificacion": "pruebaSocial.calificacion",
    "brief-opiniones": "pruebaSocial.numOpiniones",
    "brief-oferta-descripcion": "oferta.descripcion",
    "brief-oferta-fecha": "oferta.fechaFin",
    "brief-garantia-dias": "garantia.dias",
    "brief-garantia-condiciones": "garantia.condiciones",
  };
  if (id in fijos) return fijos[id];
  const lista = /^brief-(beneficios|objeciones|incluye)-d+$/.exec(id);
  if (lista) return lista[1];
  const test = /^brief-test-(d+)-/.exec(id);
  if (test) return `pruebaSocial.testimonios.${test[1]}`;
  return null;
}

const VACIO_AL_QUITAR: Record<CampoSugerible, Partial<BorradorBrief>> = {
  categoria: { categoria: "" },
  problema: { problema: "" },
  publico: { publico: "" },
  beneficios: { beneficios: ["", "", ""] },
  objeciones: { objeciones: [] },
  incluye: { incluye: [] },
  nivelConciencia: { nivelConciencia: BORRADOR_VACIO.nivelConciencia },
};

const SELECTOR_EDITAR: Record<CampoSugerible, string> = {
  categoria: "#brief-categoria",
  problema: "#brief-problema",
  publico: "#brief-publico",
  beneficios: "#brief-beneficios-0",
  objeciones: "#brief-objeciones-0",
  incluye: "#brief-incluye-0",
  nivelConciencia: "input[name=nivel]:checked",
};

/** Lo que la persona pone; nunca sale de internet. */
function NotaEsTuyo() {
  return (
    <p className="rounded-md border border-linea bg-papel-hondo px-3 py-2 text-sm text-tinta-suave" data-nota-tuyo>
      Esto lo pones tú: no lo tomamos de internet.
    </p>
  );
}

function Grupo({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-linea pt-6">
      <legend className="float-left mb-1 w-full font-editorial text-xl font-semibold">{titulo}</legend>
      {descripcion && <p className="clear-both mb-4 text-sm text-tinta-suave">{descripcion}</p>}
      <div className="clear-both flex flex-col gap-5">{children}</div>
    </fieldset>
  );
}

export function PasoBrief({ brief, onCambio, onEjemplo, revision = REVISION_VACIA, intentoAvanzar = false, onAplicarBorrador, onAceptarSugerido, onAceptarTodoSugerido, onQuitarSugerido }: Props) {
  const [idEjemplo, setIdEjemplo] = useState<string>(EJEMPLOS[0].id);
  const errores = useMemo(() => erroresDelBrief(brief), [brief]);
  const [tocados, setTocados] = useState<string[]>([]);
  const [cargandoObjeciones, setCargandoObjeciones] = useState(false);
  const [errorObjeciones, setErrorObjeciones] = useState<string | null>(null);

  // Un error se ve solo después de salir del campo (blur) o al intentar avanzar; un borrador pre-llenado no muestra errores.
  const visibles = Object.fromEntries(
    Object.entries(errores).filter(([clave]) => intentoAvanzar || tocados.some((t) => clave === t || clave.startsWith(`${t}.`))),
  );
  const alSalir = (e: React.FocusEvent<HTMLElement>) => {
    const clave = claveDeErrorPorId(e.target.id);
    if (clave) setTocados((t) => (t.includes(clave) ? t : [...t, clave]));
  };
  const alCambiar = onCambio;

  const precio = numeroDeTexto(brief.precio);
  const anterior = numeroDeTexto(brief.precioAnterior);
  const formato = (n: number | undefined) =>
    n !== undefined && Number.isFinite(n) ? formatearDinero(n, brief.moneda) : null;

  const hayInvestigacion = Object.keys(revision.meta).length > 0 || revision.precioReferencia !== null;

  function alResultadoFoto(r: RespuestaInvestigar) {
    const { cambios, meta } = aplicarBorrador(brief, r.borrador);
    onAplicarBorrador?.({ cambios: cambios as Partial<BorradorBrief>, meta, precioReferencia: r.precioReferencia ?? null });
  }

  const barra = (campo: CampoSugerible) => (
    <BarraSugerida
      campo={campo}
      meta={revision.meta[campo]}
      pendiente={revision.pendientes.includes(campo)}
      selector={SELECTOR_EDITAR[campo]}
      onAceptar={(c) => onAceptarSugerido?.(c)}
      onQuitar={(c) => onQuitarSugerido?.(c, VACIO_AL_QUITAR[c])}
    />
  );

  async function proponerObjeciones() {
    setErrorObjeciones(null);
    let base;
    try {
      base = aBrief(brief);
    } catch {
      setErrorObjeciones("Completa el nombre, el problema, el público, los beneficios y el precio para que la IA proponga objeciones.");
      return;
    }
    setCargandoObjeciones(true);
    try {
      const propuestas = await pedirObjeciones(base);
      const actuales = brief.objeciones.filter((o) => o.trim() !== "");
      alCambiar({ objeciones: [...actuales, ...propuestas.filter((p) => !actuales.includes(p))] });
    } catch (e) {
      setErrorObjeciones(e instanceof Error ? e.message : "No pudimos proponer objeciones.");
    } finally {
      setCargandoObjeciones(false);
    }
  }

  return (
    <div className="flex flex-col gap-8" onBlur={alSalir}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className={TITULO_SECCION}>Cuéntanos del producto</h2>
          <p className="mt-2 text-tinta-suave">
            Con estos datos armamos el prompt y la landing. Los campos con <span className="text-error">*</span> son obligatorios.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="brief-ejemplo" className="mb-1 block text-sm font-medium">
              Ejemplo
            </label>
            <select id="brief-ejemplo" className={`${CLASE_CONTROL} w-auto`} value={idEjemplo} onChange={(e) => setIdEjemplo(e.target.value)}>
              {EJEMPLOS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.brief.nombre}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={BOTON_SECUNDARIO}
            onClick={() => {
              const ejemplo = EJEMPLOS.find((x) => x.id === idEjemplo) ?? EJEMPLOS[0];
              onEjemplo(ejemplo);
            }}
          >
            Rellenar ejemplo
          </button>
        </div>
      </header>

      <TarjetaFoto
        nombre={brief.nombre}
        onNombre={(nombre) => alCambiar({ nombre })}
        categoria={brief.categoria}
        coloresActuales={brief.coloresMarca}
        onColores={(coloresMarca) => alCambiar({ coloresMarca })}
        onResultado={alResultadoFoto}
        pendientes={revision.pendientes.length}
        onAceptarTodo={() => onAceptarTodoSugerido?.()}
      />

      <Grupo titulo="El producto">
        <Campo id="brief-nombre" etiqueta="Nombre del producto" obligatorio error={visibles.nombre} ayuda="Por ejemplo: Corrector de postura inteligente">
          {(p) => <input {...p} className={CLASE_CONTROL} value={brief.nombre} onChange={(e) => alCambiar({ nombre: e.target.value })} />}
        </Campo>
        <Campo id="brief-categoria" etiqueta="Categoría" obligatorio error={visibles.categoria}>
          {(p) => (
            <select {...p} className={CLASE_CONTROL} value={brief.categoria} onChange={(e) => alCambiar({ categoria: e.target.value as BorradorBrief["categoria"] })}>
              <option value="">Elige una categoría</option>
              {CATEGORIAS_BRIEF.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIAS[c]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        {barra("categoria")}
        <PanelInvestigar brief={brief} onCambio={alCambiar} />
        <Campo id="brief-problema" etiqueta="Problema que resuelve" obligatorio error={visibles.problema} ayuda="Una o dos frases.">
          {(p) => <textarea {...p} rows={3} className={CLASE_CONTROL} value={brief.problema} onChange={(e) => alCambiar({ problema: e.target.value })} />}
        </Campo>
        {barra("problema")}
        <Campo id="brief-publico" etiqueta="Público objetivo" obligatorio error={visibles.publico} ayuda="Quién es, qué edad tiene y en qué situación está.">
          {(p) => <textarea {...p} rows={2} className={CLASE_CONTROL} value={brief.publico} onChange={(e) => alCambiar({ publico: e.target.value })} />}
        </Campo>
        {barra("publico")}
      </Grupo>

      <Grupo titulo="Beneficios" descripcion={`Entre ${MIN_BENEFICIOS} y ${MAX_BENEFICIOS}. Escribe lo que la persona gana, no la ficha técnica.`}>
        {barra("beneficios")}
        <ListaEditable
          id="brief-beneficios"
          etiquetaElemento="Beneficio"
          valores={brief.beneficios}
          min={MIN_BENEFICIOS}
          max={MAX_BENEFICIOS}
          claveError="beneficios"
          errores={visibles}
          textoAgregar="Agregar beneficio"
          placeholder="Por ejemplo: Se lleva bajo la ropa"
          onChange={(beneficios) => alCambiar({ beneficios })}
        />
        {visibles.beneficios && (
          <p role="alert" className="text-sm text-error">
            {visibles.beneficios}
          </p>
        )}
      </Grupo>

      <Grupo titulo="Precio">
        {hayInvestigacion && <NotaEsTuyo />}
        {revision.precioReferencia && (
          <div className="text-sm text-tinta-suave" data-precio-referencia>
            <p>
              En el mercado se ve entre <strong className="text-tinta">{formatearDinero(revision.precioReferencia.min, revision.precioReferencia.moneda ?? brief.moneda)}</strong> y{" "}
              <strong className="text-tinta">{formatearDinero(revision.precioReferencia.max, revision.precioReferencia.moneda ?? brief.moneda)}</strong>. Es solo una referencia: escribe tu propio precio.
            </p>
            <div className="mt-1">
              <ChipsFuentes fuentes={revision.precioReferencia.fuentes} />
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_8rem]">
          <Campo id="brief-precio" etiqueta="Precio" obligatorio error={visibles["precio.valor"]}>
            {(p) => <input {...p} inputMode="decimal" className={CLASE_CONTROL} value={brief.precio} onChange={(e) => alCambiar({ precio: e.target.value })} />}
          </Campo>
          <Campo id="brief-precio-anterior" etiqueta="Precio anterior" error={visibles["precio.anterior"]}>
            {(p) => <input {...p} inputMode="decimal" className={CLASE_CONTROL} value={brief.precioAnterior} onChange={(e) => alCambiar({ precioAnterior: e.target.value })} />}
          </Campo>
          <Campo id="brief-moneda" etiqueta="Moneda" obligatorio>
            {(p) => (
              <select {...p} className={CLASE_CONTROL} value={brief.moneda} onChange={(e) => alCambiar({ moneda: e.target.value as BorradorBrief["moneda"] })}>
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        </div>
        <p aria-live="polite" className="text-sm text-tinta-suave" data-vista-precio>
          {formato(precio) ? (
            <>
              Se verá como <strong className="text-tinta">{formato(precio)}</strong>
              {formato(anterior) && <> (antes {formato(anterior)})</>}
            </>
          ) : (
            "Escribe el precio para ver cómo se muestra."
          )}
        </p>
      </Grupo>

      <Grupo titulo="Objeciones" descripcion="Las dudas que frenan la compra. La IA propone cinco y tú las editas.">
        {barra("objeciones")}
        <div>
          <button type="button" className={BOTON_SECUNDARIO} disabled={cargandoObjeciones} onClick={proponerObjeciones}>
            {cargandoObjeciones ? "Pensando…" : "Proponer 5 con IA"}
          </button>
          <p role="status" aria-live="polite" className="mt-2 text-sm text-tinta-suave">
            {cargandoObjeciones && "La IA está proponiendo objeciones."}
          </p>
          {errorObjeciones && (
            <p role="alert" className="mt-2 text-sm text-error">
              {errorObjeciones}
            </p>
          )}
        </div>
        <ListaEditable
          id="brief-objeciones"
          etiquetaElemento="Objeción"
          valores={brief.objeciones}
          claveError="objeciones"
          errores={visibles}
          textoAgregar="Agregar objeción"
          placeholder="Por ejemplo: ¿Y si me incomoda?"
          onChange={(objeciones) => alCambiar({ objeciones })}
        />
      </Grupo>

      <Grupo titulo="Nivel de conciencia" descripcion="Qué tanto sabe la persona antes de llegar a la página.">
        {barra("nivelConciencia")}
        <div role="radiogroup" aria-label="Nivel de conciencia" className="flex flex-col gap-2">
          {NIVELES.map((n) => (
            <label key={n.valor} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-linea p-3 has-[:checked]:border-marca has-[:checked]:bg-papel-hondo has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marca">
              <input type="radio" name="nivel" className="mt-1 size-4 accent-marca" checked={brief.nivelConciencia === n.valor} onChange={() => alCambiar({ nivelConciencia: n.valor })} />
              <span>
                <span className="block font-medium">{n.nombre}</span>
                <span className="block text-sm text-tinta-suave">{n.explicacion}</span>
              </span>
            </label>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Prueba social real" descripcion="Si no tienes testimonios reales, déjalo vacío: la landing mostrará [COMPLETAR].">
        {hayInvestigacion && <NotaEsTuyo />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="brief-calificacion" etiqueta="Calificación promedio (0 a 5)" error={visibles["pruebaSocial.calificacion"]}>
            {(p) => <input {...p} inputMode="decimal" className={CLASE_CONTROL} value={brief.calificacion} onChange={(e) => alCambiar({ calificacion: e.target.value })} />}
          </Campo>
          <Campo id="brief-opiniones" etiqueta="Número de opiniones" error={visibles["pruebaSocial.numOpiniones"]}>
            {(p) => <input {...p} inputMode="numeric" className={CLASE_CONTROL} value={brief.numOpiniones} onChange={(e) => alCambiar({ numOpiniones: e.target.value })} />}
          </Campo>
        </div>
        {brief.testimonios.map((t, i) => {
          const cambiar = (c: Partial<typeof t>) =>
            alCambiar({ testimonios: brief.testimonios.map((x, j) => (j === i ? { ...x, ...c } : x)) });
          const aviso = Object.entries(visibles).find(([k]) => k.startsWith(`pruebaSocial.testimonios.${i}.`))?.[1];
          return (
            <div key={i} className="rounded-md border border-linea p-4">
              <p className="mb-3 font-medium">Testimonio {i + 1}</p>
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_8rem]">
                <Campo id={`brief-test-${i}-nombre`} etiqueta="Nombre" obligatorio>
                  {(p) => <input {...p} className={CLASE_CONTROL} value={t.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} />}
                </Campo>
                <Campo id={`brief-test-${i}-ciudad`} etiqueta="Ciudad">
                  {(p) => <input {...p} className={CLASE_CONTROL} value={t.ciudad} onChange={(e) => cambiar({ ciudad: e.target.value })} />}
                </Campo>
                <Campo id={`brief-test-${i}-estrellas`} etiqueta="Estrellas">
                  {(p) => (
                    <select {...p} className={CLASE_CONTROL} value={t.estrellas} onChange={(e) => cambiar({ estrellas: e.target.value })}>
                      <option value="">Sin dato</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
              </div>
              <div className="mt-4">
                <Campo id={`brief-test-${i}-texto`} etiqueta="Testimonio" obligatorio error={aviso}>
                  {(p) => <textarea {...p} rows={2} className={CLASE_CONTROL} value={t.texto} onChange={(e) => cambiar({ texto: e.target.value })} />}
                </Campo>
              </div>
              <button type="button" className={`${BOTON_PEQUENO} mt-3`} onClick={() => alCambiar({ testimonios: brief.testimonios.filter((_, j) => j !== i) })}>
                Quitar testimonio {i + 1}
              </button>
            </div>
          );
        })}
        <div>
          <button
            type="button"
            className={BOTON_SECUNDARIO}
            disabled={brief.testimonios.length >= 6}
            onClick={() => alCambiar({ testimonios: [...brief.testimonios, { nombre: "", ciudad: "", texto: "", estrellas: "" }] })}
          >
            Agregar testimonio real
          </button>
        </div>
      </Grupo>

      <Grupo titulo="Oferta, incluye y garantía" descripcion="Todo esto es opcional y activa secciones extra en la landing.">
        {hayInvestigacion && <NotaEsTuyo />}
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" className="size-5 accent-marca" checked={brief.ofertaActiva} onChange={(e) => alCambiar({ ofertaActiva: e.target.checked })} />
          <span className="font-medium">Tengo una oferta con fecha de fin</span>
        </label>
        {brief.ofertaActiva && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="brief-oferta-descripcion" etiqueta="Qué incluye la oferta" obligatorio error={visibles["oferta.descripcion"]}>
              {(p) => <input {...p} className={CLASE_CONTROL} value={brief.ofertaDescripcion} onChange={(e) => alCambiar({ ofertaDescripcion: e.target.value })} />}
            </Campo>
            <Campo id="brief-oferta-fecha" etiqueta="Fecha y hora de fin" obligatorio ayuda="Activa la cuenta regresiva. Debe ser futura." error={visibles["oferta.fechaFin"]}>
              {(p) => <input {...p} type="datetime-local" className={CLASE_CONTROL} value={brief.ofertaFecha} onChange={(e) => alCambiar({ ofertaFecha: e.target.value })} />}
            </Campo>
          </div>
        )}
        <div>
          <p className="mb-1 text-sm font-medium">Qué incluye la caja <span className="font-normal text-tinta-suave">(opcional)</span></p>
          <div className="mb-2 empty:hidden">{barra("incluye")}</div>
          <ListaEditable id="brief-incluye" etiquetaElemento="Elemento incluido" valores={brief.incluye} max={5} claveError="incluye" errores={visibles} textoAgregar="Agregar elemento" onChange={(incluye) => alCambiar({ incluye })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Campo id="brief-garantia-dias" etiqueta="Días de garantía" error={visibles["garantia.dias"]}>
            {(p) => <input {...p} inputMode="numeric" className={CLASE_CONTROL} value={brief.garantiaDias} onChange={(e) => alCambiar({ garantiaDias: e.target.value })} />}
          </Campo>
          <Campo id="brief-garantia-condiciones" etiqueta="Condiciones de la garantía" error={visibles["garantia.condiciones"]}>
            {(p) => <input {...p} className={CLASE_CONTROL} value={brief.garantiaCondiciones} onChange={(e) => alCambiar({ garantiaCondiciones: e.target.value })} />}
          </Campo>
        </div>
      </Grupo>

      <Grupo titulo="Colores de marca" descripcion={`Hasta ${MAX_COLORES}. Reemplazan los de la semilla.`}>
        <ul className="flex flex-wrap gap-3">
          {brief.coloresMarca.map((color, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md border border-linea p-2">
              <input
                type="color"
                aria-label={`Color de marca ${i + 1}`}
                className="size-11 cursor-pointer rounded border-0 bg-transparent p-0"
                value={color}
                onChange={(e) => alCambiar({ coloresMarca: brief.coloresMarca.map((c, j) => (j === i ? e.target.value : c)) })}
              />
              <code className="text-sm">{color}</code>
              <button type="button" className={BOTON_PEQUENO} aria-label={`Quitar color de marca ${i + 1}`} onClick={() => alCambiar({ coloresMarca: brief.coloresMarca.filter((_, j) => j !== i) })}>
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
        <div>
          <button type="button" className={BOTON_SECUNDARIO} disabled={brief.coloresMarca.length >= MAX_COLORES} onClick={() => alCambiar({ coloresMarca: [...brief.coloresMarca, COLOR_INICIAL] })}>
            Agregar color
          </button>
        </div>
      </Grupo>

      <Grupo titulo="Intensidad visual" descripcion="Cuánto se mueve y se atreve la landing.">
        <div role="radiogroup" aria-label="Intensidad visual" className="grid gap-3 md:grid-cols-3">
          {INTENSIDADES.map((n) => (
            <label key={n.valor} className="flex min-h-11 cursor-pointer flex-col gap-1 rounded-md border border-linea p-4 has-[:checked]:border-marca has-[:checked]:bg-papel-hondo has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marca">
              <span className="flex items-center gap-2">
                <input type="radio" name="intensidad" className="size-4 accent-marca" checked={brief.intensidad === n.valor} onChange={() => alCambiar({ intensidad: n.valor })} />
                <span className="font-editorial text-lg font-semibold">{n.nombre}</span>
              </span>
              <span className="text-sm text-tinta-suave">{n.cambia}</span>
            </label>
          ))}
        </div>
      </Grupo>
    </div>
  );
}
