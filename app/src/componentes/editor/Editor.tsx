"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { LandingCompleta } from "@/lib/landings";
import { ErrorApi } from "../crear/api";
import { BOTON_PEQUENO, BOTON_SECUNDARIO } from "../crear/estilos";
import { Icono } from "@/componentes/Icono";
import { useMedia } from "@/efectos/movimiento";
import { ASSETS_POR_TIPO } from "@/secciones/ejemplos-por-tipo";
import { conPresentacion, leerPresentacion } from "@/secciones/presentacion";
import {
  cargarLanding,
  corregirInfracciones,
  guardarDoc,
  guardarEnBanco,
  guardarVersion,
  listarVersiones,
  regenerarSeccion,
  renombrar,
  restaurarVersion,
  subirArchivo,
  type MotivoBanco,
} from "./api-editor";
import { crearAutoguardador, type EstadoGuardado } from "./autoguardado";
import { BannerAntiSplit } from "@/componentes/anti-split/BannerAntiSplit";
import { MedidorAntiSplit } from "@/componentes/anti-split/MedidorAntiSplit";
import type { ResultadoAntiSplit } from "@/lib/validadores/anti-split-render";
import { traducirAtajo, esCampoDeTexto, type AtajoEditor } from "./atajos";
import { AyudaAtajos } from "./AyudaAtajos";
import { assetDeMedio } from "./bancos";
import { BarraSuperior } from "./BarraSuperior";
import type { ContextoSlots } from "./ControlCampo";
import { conValorEnRuta } from "./edicion-en-linea";
import { ModalRevision } from "../entrega/ModalRevision";
import { listaDeRevision } from "@/lib/entrega/revision";
import { destinoEnGrupo } from "./grupos";
import { estadoInicial, marcaDeTiempo, motivoNoDuplicar, motivoNoEliminar, reducirEditor } from "./estado-editor";
import { MarcoEditor } from "./MarcoEditor";
import { MSG_LISTA, type AccionRapida, type DispositivoVista, type MensajeDeVista } from "./mensajes";
import { PanelSecciones } from "./PanelSecciones";

// Paneles que no se ven al abrir: su código llega cuando hacen falta.
const Inspector = dynamic(() => import("./Inspector").then((m) => m.Inspector));
const Versiones = dynamic(() => import("./Versiones").then((m) => m.Versiones));
const ModalAgregarSeccion = dynamic(() => import("./ModalAgregarSeccion").then((m) => m.ModalAgregarSeccion));

type Pestana = "secciones" | "vista" | "ajustes";
const PESTANAS: { id: Pestana; nombre: string }[] = [
  { id: "secciones", nombre: "Secciones" },
  { id: "vista", nombre: "Vista" },
  { id: "ajustes", nombre: "Ajustes" },
];

/** Recibe la landing del servidor; si no llegó, la carga con `GET /api/landings/[id]` y muestra un 404 legible si no existe. */
export function Editor({ id, inicial = null, seccionInicial }: { id: string; inicial?: LandingCompleta | null; seccionInicial?: string }) {
  const [landing, setLanding] = useState<LandingCompleta | null>(inicial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inicial) return;
    let vigente = true;
    cargarLanding(id)
      .then((l) => vigente && setLanding(l))
      .catch((e: unknown) => vigente && setError(e instanceof Error ? e.message : "No pudimos abrir la landing."));
    return () => {
      vigente = false;
    };
  }, [id, inicial]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 px-6">
        <h1 className="font-editorial text-3xl font-semibold">No pudimos abrir el editor</h1>
        <p role="alert" className="text-error">
          {error}
        </p>
        <a href="/crear" className={BOTON_SECUNDARIO}>
          Crear una landing nueva
        </a>
      </main>
    );
  }
  if (!landing) {
    return (
      <p role="status" className="p-8 text-center text-tinta-suave">
        Abriendo el editor…
      </p>
    );
  }
  return <EditorLanding landing={landing} seccionInicial={seccionInicial} />;
}

export function EditorLanding({ landing, seccionInicial }: { landing: LandingCompleta; seccionInicial?: string }) {
  const id = landing.id;
  const router = useRouter();
  // `?seccion=<id>` (enlaces de «Datos por completar» y de la lista de revisión) abre el editor con esa sección seleccionada.
  const [estado, despachar] = useReducer(reducirEditor, landing.doc, (doc) => {
    const base = estadoInicial(doc);
    return seccionInicial && doc.secciones.some((x) => x.id === seccionInicial) ? { ...base, seleccion: seccionInicial } : base;
  });
  // Tres modos (§11.2): ≥ 1200 px tres columnas; de 900 a 1199 px la configuración es un cajón; menos de 900 px, una pestaña a la vez y solo textos.
  const ancho1200 = useMedia("(min-width: 1200px)");
  const ancho900 = useMedia("(min-width: 900px)");
  const modo: "completo" | "cajon" | "movil" = ancho1200 ? "completo" : ancho900 ? "cajon" : "movil";
  const [pestana, setPestana] = useState<Pestana>("secciones");
  const [cajonAbierto, setCajonAbierto] = useState(false);
  const [dispositivo, setDispositivo] = useState<DispositivoVista>("desktop");
  const [bloqueSel, setBloqueSel] = useState<string | null>(null);
  const [hoverLista, setHoverLista] = useState<string | null>(null);
  const [hoverVista, setHoverVista] = useState<string | null>(null);
  const [desplazar, setDesplazar] = useState(false);
  const [modalAgregar, setModalAgregar] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  // Slot cuyo buscador de bancos debe abrirse en el inspector (viene de «Buscar en bancos» del marcador).
  const [abrirBancos, setAbrirBancos] = useState<string | null>(null);
  // El medidor del héroe es una segunda página completa dentro de esta: arranca cuando el editor ya está usable.
  const [medir, setMedir] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMedir(true), 2500);
    return () => clearTimeout(t);
  }, []);
  const [nombre, setNombre] = useState(landing.nombre);
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<{ estado: EstadoGuardado; detalle?: string }>({ estado: "guardado" });
  const [versiones, setVersiones] = useState(false);
  const [estadoBanco, setEstadoBanco] = useState(landing.estado);
  const [antiSplit, setAntiSplit] = useState<ResultadoAntiSplit | null>(null);
  const [guardandoBanco, setGuardandoBanco] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [motivosBanco, setMotivosBanco] = useState<MotivoBanco[] | null>(null);
  const [mensajeBanco, setMensajeBanco] = useState<string | null>(null);
  const [errorBanco, setErrorBanco] = useState<string | null>(null);
  const [regenerando, setRegenerando] = useState(false);
  const [errorRegenerar, setErrorRegenerar] = useState<string | null>(null);
  const [regenerandoEtiqueta, setRegenerandoEtiqueta] = useState<string | null>(null);
  // El aviso pertenece a la sección donde se hizo: al elegir otra deja de verse.
  const [avisoIA, setAvisoIA] = useState<{ seccionId: string; texto: string } | null>(null);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [mensajeCorreccion, setMensajeCorreccion] = useState<string | null>(null);
  const [errorCorreccion, setErrorCorreccion] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [errorSubida, setErrorSubida] = useState<ContextoSlots["errorSubida"]>(null);

  // ── Autoguardado: 800 ms después del último cambio de la persona ──
  const guardador = useMemo(
    () =>
      crearAutoguardador({
        guardar: async (doc) => {
          const guardada = await guardarDoc(id, doc);
          despachar({ tipo: "sincronizar-marcas", doc: guardada.doc });
        },
        alEstado: (e, detalle) => setGuardado({ estado: e, detalle }),
      }),
    [id],
  );
  // Solo lo que viene de una acción de la persona se guarda. Deshacer hasta el documento con el que se abrió el editor también
  // cuenta: antes se comparaba con el documento inicial y ese último paso nunca se guardaba.
  useEffect(() => {
    if (estado.origen === "servidor") return;
    guardador.programar(estado.doc);
  }, [estado.doc, estado.origen, guardador]);
  useEffect(() => () => guardador.cancelar(), [guardador]);

  // Avisa si se cierra la pestaña con cambios sin guardar.
  useEffect(() => {
    const alSalir = (e: BeforeUnloadEvent) => {
      if (guardado.estado !== "guardado") e.preventDefault();
    };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [guardado.estado]);

  const seccion = estado.doc.secciones.find((s) => s.id === estado.seleccion) ?? null;
  // La lista de revisión se calcula sobre lo que hay ahora en el editor (incluye lo que aún no se ha guardado).
  const revision = useMemo(() => listaDeRevision(estado.doc), [estado.doc]);
  const seleccionRef = useRef(seccion);
  useEffect(() => {
    seleccionRef.current = seccion;
  });

  async function conGuardadoPrevio<T>(accion: () => Promise<T>): Promise<T> {
    await guardador.vaciar();
    return accion();
  }

  const verCompleta = useCallback(async () => {
    await guardador.vaciar().catch(() => {});
    router.push(`/ver/${id}`);
  }, [guardador, id, router]);

  // ── Selección: desde la lista (la vista se desplaza) o desde la vista (ya está a la vista) ──
  const seleccionarDesdeLista = useCallback(
    (sid: string) => {
      despachar({ tipo: "seleccionar", id: sid });
      setBloqueSel(null);
      setDesplazar(true);
      setCajonAbierto(true);
    },
    [],
  );
  const seleccionarBloque = useCallback((sid: string, bloque: string) => {
    despachar({ tipo: "seleccionar", id: sid });
    setBloqueSel(bloque);
    setDesplazar(true);
    setCajonAbierto(true);
  }, []);
  const verTema = useCallback(() => {
    despachar({ tipo: "seleccionar", id: null });
    setBloqueSel(null);
    setCajonAbierto(true);
  }, []);

  // ── Acciones sobre la sección seleccionada (barra rápida y atajos) ──
  const hacerAtajo = useCallback(
    (a: AtajoEditor) => {
      const actual = seleccionRef.current;
      switch (a) {
        case "deshacer":
          despachar({ tipo: "deshacer" });
          break;
        case "rehacer":
          despachar({ tipo: "rehacer" });
          break;
        case "eliminar":
          if (actual) despachar({ tipo: "eliminar", id: actual.id });
          break;
        case "duplicar":
          if (actual) despachar({ tipo: "duplicar", id: actual.id });
          break;
        case "subir":
          if (actual) despachar({ tipo: "mover-en-grupo", id: actual.id, paso: -1 });
          break;
        case "bajar":
          if (actual) despachar({ tipo: "mover-en-grupo", id: actual.id, paso: 1 });
          break;
        case "deseleccionar":
          despachar({ tipo: "seleccionar", id: null });
          setBloqueSel(null);
          setCajonAbierto(false);
          break;
        case "ver-completa":
          void verCompleta();
          break;
        case "ayuda":
          setAyuda(true);
          break;
      }
    },
    [verCompleta],
  );

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      // Con un modal abierto solo funcionan deshacer y rehacer; lo demás es del modal.
      const a = traducirAtajo({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey, enCampo: esCampoDeTexto(e.target) });
      if (!a) return;
      if ((modalAgregar || ayuda) && a !== "deshacer" && a !== "rehacer") return;
      e.preventDefault();
      hacerAtajo(a);
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [hacerAtajo, modalAgregar, ayuda]);

  const estadoRef = useRef(estado);
  useEffect(() => {
    estadoRef.current = estado;
  });

  // ── Mensajes de la vista previa ──
  const alMensajeDeVista = useCallback(
    (m: MensajeDeVista) => {
      switch (m.type) {
        case "CLICK_SECTION":
          despachar({ tipo: "seleccionar", id: m.id });
          setBloqueSel(m.blockId ?? null);
          setDesplazar(false);
          setCajonAbierto(true);
          break;
        case "HOVER_SECTION":
          setHoverVista(m.id);
          break;
        case "INLINE_EDIT": {
          const objetivo = estadoRef.current.doc.secciones.find((s) => s.id === m.id);
          const nueva = objetivo ? conValorEnRuta(objetivo, m.path, m.value) : null;
          if (nueva) despachar({ tipo: "editar-seccion", id: m.id, seccion: nueva, clave: m.path, t: marcaDeTiempo() });
          break;
        }
        case "INLINE_SIZE": {
          const objetivo = estadoRef.current.doc.secciones.find((x) => x.id === m.id);
          if (objetivo) {
            const tamanos = { ...leerPresentacion(objetivo.ajustes).tamanos };
            if (m.step === 0) delete tamanos[m.path];
            else tamanos[m.path] = m.step;
            despachar({ tipo: "editar-seccion", id: m.id, seccion: conPresentacion(objetivo, { tamanos }), clave: `tam:${m.path}`, t: marcaDeTiempo() });
          }
          break;
        }
        case "SECTION_ACTION":
          if (m.action === "ocultar") despachar({ tipo: "alternar-visible", id: m.id });
          else if (m.action === "eliminar") despachar({ tipo: "eliminar", id: m.id });
          else if (m.action === "duplicar") despachar({ tipo: "duplicar", id: m.id });
          else despachar({ tipo: "mover-en-grupo", id: m.id, paso: m.action === "subir" ? -1 : 1 });
          break;
        case "BUSCAR_BANCOS": {
          const dueno = estadoRef.current.doc.secciones.find((s) => JSON.stringify([s.ajustes, s.bloques]).includes(`"${m.slot}"`));
          if (dueno) despachar({ tipo: "seleccionar", id: dueno.id });
          setBloqueSel(null);
          setAbrirBancos(m.slot);
          setCajonAbierto(true);
          break;
        }
        case "KEY": {
          const a = traducirAtajo({ ...m, enCampo: false });
          if (a && !modalAgregar && !ayuda) hacerAtajo(a);
          break;
        }
      }
    },
    [hacerAtajo, modalAgregar, ayuda],
  );

  const permitidas = useMemo<Record<AccionRapida, boolean>>(
    () =>
      seccion
        ? {
            subir: destinoEnGrupo(estado.doc, seccion.id, -1) !== null,
            bajar: destinoEnGrupo(estado.doc, seccion.id, 1) !== null,
            duplicar: motivoNoDuplicar(estado.doc, seccion) === null,
            ocultar: true,
            eliminar: motivoNoEliminar(estado.doc, seccion) === null,
          }
        : { subir: false, bajar: false, duplicar: false, ocultar: false, eliminar: false },
    [estado.doc, seccion],
  );

  async function alRegenerar(instruccion: string, etiqueta = "Regenerar") {
    if (!seccion) return;
    setRegenerando(true);
    setRegenerandoEtiqueta(etiqueta);
    setErrorRegenerar(null);
    setAvisoIA(null);
    try {
      // `regenerar-seccion` conserva los campos que se editaron a mano (`editadoPorHumano`) y guarda antes una versión.
      const l = await conGuardadoPrevio(() => regenerarSeccion(id, seccion.id, instruccion));
      despachar({ tipo: "reemplazar-doc", doc: l.doc });
      setAvisoIA({ seccionId: seccion.id, texto: `${etiqueta === "Instrucción" ? "Instrucción aplicada" : etiqueta === "Regenerar" ? "Sección regenerada" : `«${etiqueta}» aplicado`}.` });
    } catch (e) {
      setErrorRegenerar(e instanceof Error ? e.message : "No pudimos regenerar la sección.");
    } finally {
      setRegenerando(false);
      setRegenerandoEtiqueta(null);
    }
  }

  async function alCorregir() {
    setCorrigiendo(true);
    setErrorCorreccion(null);
    setMensajeCorreccion(null);
    try {
      const r = await conGuardadoPrevio(() => corregirInfracciones(id));
      despachar({ tipo: "reemplazar-doc", doc: r.doc });
      setMensajeCorreccion(
        r.corregidas === 0 && r.pendientes.length === 0
          ? "No había textos que corregir."
          : `Se corrigieron ${r.corregidas} textos${r.pendientes.length > 0 ? ` y quedan ${r.pendientes.length} por revisar a mano` : ""}.`,
      );
    } catch (e) {
      setErrorCorreccion(e instanceof Error ? e.message : "No pudimos corregir las infracciones.");
    } finally {
      setCorrigiendo(false);
    }
  }

  async function alSubir(slot: string, archivo: File) {
    setSubiendo(slot);
    setErrorSubida(null);
    try {
      const r = await subirArchivo(id, slot, archivo);
      const tipoSeccion = seccion?.tipo;
      const conocido = (tipoSeccion ? ASSETS_POR_TIPO[tipoSeccion] : undefined)?.find((a) => a.slot === slot);
      despachar({
        tipo: "asset-subido",
        slot,
        ruta: r.ruta,
        asset: conocido ?? { slot, tipo: r.tipo, relacion: "4:5", promptGrok: "", alt: slot },
      });
    } catch (e) {
      setErrorSubida({ slot, mensaje: e instanceof Error ? e.message : "No pudimos subir el archivo." });
    } finally {
      setSubiendo(null);
    }
  }

  async function alBanco() {
    if (antiSplit?.split) return;
    setGuardandoBanco(true);
    setMotivosBanco(null);
    setMensajeBanco(null);
    setErrorBanco(null);
    try {
      const l = await conGuardadoPrevio(() => guardarEnBanco(id));
      setEstadoBanco(l.estado);
      setMensajeBanco("Guardada en el banco.");
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 409) setMotivosBanco((e.datos?.motivos as MotivoBanco[] | undefined) ?? []);
      else setErrorBanco(e instanceof Error ? e.message : "No pudimos guardar en el banco.");
    } finally {
      setGuardandoBanco(false);
    }
  }

  async function alRenombrar(nuevo: string) {
    setErrorNombre(null);
    try {
      const l = await renombrar(id, nuevo);
      setNombre(l.nombre);
    } catch (e) {
      setErrorNombre(e instanceof Error ? e.message : "No pudimos cambiar el nombre.");
    }
  }

  const cargarVersiones = useCallback(() => listarVersiones(id), [id]);
  const cerrarVersiones = useCallback(() => setVersiones(false), []);
  const cerrarModal = useCallback(() => setModalAgregar(false), []);
  const cerrarAyuda = useCallback(() => setAyuda(false), []);

  const focos = seccion ? leerPresentacion(seccion.ajustes).focos : {};
  const slots: ContextoSlots = {
    assets: estado.doc.assets,
    landingId: id,
    subiendo,
    errorSubida,
    onSubir: alSubir,
    focos,
    abrirBancos,
    onFoco: (slot, foco) => {
      if (!seccion) return;
      const nuevos = { ...focos };
      if (foco === null) delete nuevos[slot];
      else nuevos[slot] = foco;
      despachar({ tipo: "editar-seccion", id: seccion.id, seccion: conPresentacion(seccion, { focos: nuevos }), clave: `foco:${slot}`, t: marcaDeTiempo() });
    },
    onMedio: (slot, medio) => despachar({ tipo: "asset-de-banco", asset: assetDeMedio(slot, medio, estado.doc.assets.find((a) => a.slot === slot)) }),
  };

  const cambiarSeccion = (nueva: NonNullable<typeof seccion>, clave: string) =>
    despachar({ tipo: "editar-seccion", id: nueva.id, seccion: nueva, clave: clave || undefined, t: marcaDeTiempo() });

  const inspector = (
    <Inspector
      doc={estado.doc}
      brief={landing.brief}
      seccion={seccion}
      slots={slots}
      bloqueSeleccionado={bloqueSel}
      soloTextos={modo === "movil"}
      onAccion={despachar}
      onCambioSeccion={cambiarSeccion}
      onRegenerar={alRegenerar}
      regenerando={regenerando}
      errorRegenerar={errorRegenerar}
      regenerandoEtiqueta={regenerandoEtiqueta}
      mensajeRegenerar={avisoIA && avisoIA.seccionId === seccion?.id ? avisoIA.texto : null}
      onDeshacerIA={() => {
        despachar({ tipo: "deshacer" });
        setAvisoIA(null);
      }}
      onCorregir={alCorregir}
      corrigiendo={corrigiendo}
      mensajeCorreccion={mensajeCorreccion}
      errorCorreccion={errorCorreccion}
    />
  );

  const arbol = (
    <PanelSecciones
      doc={estado.doc}
      seleccion={estado.seleccion}
      bloqueSeleccionado={bloqueSel}
      onAccion={(a) => (a.tipo === "seleccionar" && a.id ? seleccionarDesdeLista(a.id) : despachar(a))}
      onSeleccionarBloque={seleccionarBloque}
      onCambioSeccion={cambiarSeccion}
      onAgregarSeccion={() => setModalAgregar(true)}
      onTema={verTema}
      temaActivo={estado.seleccion === null}
      resaltada={hoverVista}
      onResaltar={setHoverLista}
    />
  );

  const lienzo = (
    <MarcoEditor
      id={id}
      doc={estado.doc}
      seleccion={estado.seleccion}
      desplazar={desplazar}
      dispositivo={modo === "movil" && dispositivo === "desktop" ? "mobile" : dispositivo}
      resaltada={hoverLista}
      permitidas={permitidas}
      onMensaje={alMensajeDeVista}
    />
  );

  const panel = "min-h-0 overflow-y-auto overscroll-contain";

  return (
    <div className="flex h-dvh flex-col overflow-hidden" data-editor={id} data-modo={modo} data-anti-split={antiSplit ? (antiSplit.split ? "split" : "ok") : "pendiente"}>
      <BarraSuperior
        id={id}
        nombre={nombre}
        onRenombrar={alRenombrar}
        puedeDeshacer={estado.pasado.length > 0}
        puedeRehacer={estado.futuro.length > 0}
        onDeshacer={() => despachar({ tipo: "deshacer" })}
        onRehacer={() => despachar({ tipo: "rehacer" })}
        guardado={guardado.estado}
        detalleGuardado={guardado.detalle}
        slug={landing.slug}
        estadoBanco={estadoBanco}
        onVersiones={() => setVersiones(true)}
        onBanco={() => setRevisando(true)}
        onAtajos={() => setAyuda(true)}
        dispositivo={dispositivo}
        onDispositivo={setDispositivo}
        bloqueoBanco={antiSplit?.split ? "Guardar en banco está bloqueado: el héroe está partido en dos columnas (título y imagen lado a lado)." : null}
        guardandoBanco={guardandoBanco}
        motivosBanco={motivosBanco}
        mensajeBanco={mensajeBanco}
        errorBanco={errorBanco}
        errorNombre={errorNombre}
      />

      {medir && (
        <MedidorAntiSplit
          src={`/editor/${id}/vista`}
          mensajeLista={MSG_LISTA}
          clave={estado.doc}
          enviar={(ventana) => ventana.postMessage({ type: "LANDING_UPDATE", landing: estado.doc }, window.location.origin)}
          onResultado={setAntiSplit}
        />
      )}
      {antiSplit?.split && (
        <div className="shrink-0 border-b border-linea px-4 py-2">
          <BannerAntiSplit
            accion={
              <button
                type="button"
                className={BOTON_SECUNDARIO}
                onClick={() => {
                  const heroe = estado.doc.secciones.find((s) => s.tipo === "heroe");
                  if (heroe) seleccionarDesdeLista(heroe.id);
                  setPestana("ajustes");
                }}
              >
                Cambiar a una variante aprobada
              </button>
            }
          />
        </div>
      )}

      {modo === "movil" && (
        <>
          <p role="note" data-aviso-computador className="shrink-0 border-b border-linea bg-papel-hondo px-4 py-2 text-sm text-tinta-suave">
            El editor funciona mejor en computador. Aquí puedes editar los textos.
          </p>
          <div role="tablist" aria-label="Paneles del editor" className="grid shrink-0 grid-cols-3 gap-1 border-b border-linea p-1">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                id={`pestana-${p.id}`}
                aria-selected={pestana === p.id}
                aria-controls={`panel-${p.id}`}
                onClick={() => setPestana(p.id)}
                className="min-h-11 rounded-md text-sm font-medium aria-selected:bg-marca aria-selected:text-marca-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
              >
                {p.nombre}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            <div id="panel-secciones" role="tabpanel" aria-labelledby="pestana-secciones" hidden={pestana !== "secciones"} className={`${panel} h-full p-3`}>
              {arbol}
            </div>
            <div id="panel-vista" role="tabpanel" aria-labelledby="pestana-vista" hidden={pestana !== "vista"} className="h-full p-2">
              {pestana === "vista" && lienzo}
            </div>
            <div id="panel-ajustes" role="tabpanel" aria-labelledby="pestana-ajustes" hidden={pestana !== "ajustes"} className={`${panel} h-full p-3`}>
              {pestana === "ajustes" && inspector}
            </div>
          </div>
        </>
      )}

      {modo !== "movil" && (
        <div className={`relative grid min-h-0 flex-1 ${modo === "completo" ? "grid-cols-[280px_minmax(0,1fr)_320px]" : "grid-cols-[280px_minmax(0,1fr)]"}`} data-cuerpo-editor>
          <aside id="panel-secciones" aria-label="Secciones" className={`${panel} border-r border-linea p-3`} data-panel="secciones">
            {arbol}
          </aside>
          <main id="panel-vista" aria-label="Vista previa" className="min-h-0 p-3" data-panel="vista">
            {lienzo}
          </main>
          {modo === "completo" && (
            <aside id="panel-ajustes" aria-label="Configuración" className={`${panel} border-l border-linea p-3`} data-panel="ajustes">
              {inspector}
            </aside>
          )}
          {modo === "cajon" && cajonAbierto && (
            <aside id="panel-ajustes" aria-label="Configuración" data-panel="ajustes" data-cajon className={`${panel} absolute inset-y-0 right-0 z-20 w-80 border-l border-linea bg-papel p-3 shadow-xl`}>
              <div className="mb-2 flex justify-end">
                <button type="button" className={BOTON_PEQUENO} onClick={() => setCajonAbierto(false)} aria-label="Cerrar la configuración">
                  <Icono nombre="cerrar" className="size-4" />
                </button>
              </div>
              {inspector}
            </aside>
          )}
          {modo === "cajon" && !cajonAbierto && (
            <button type="button" data-abrir-cajon className={`${BOTON_PEQUENO} absolute right-3 top-3 z-10 gap-1.5 bg-papel`} onClick={() => setCajonAbierto(true)}>
              <Icono nombre="editar" className="size-4" />
              Configuración
            </button>
          )}
        </div>
      )}

      {modalAgregar && (
        <ModalAgregarSeccion
          doc={estado.doc}
          onCerrar={cerrarModal}
          onElegir={(tipo, variante) => {
            despachar({ tipo: "agregar", seccionTipo: tipo, variante });
            setBloqueSel(null);
            setDesplazar(true);
            setCajonAbierto(true);
            setModalAgregar(false);
          }}
        />
      )}
      {ayuda && <AyudaAtajos onCerrar={cerrarAyuda} />}
      {revisando && (
        <ModalRevision
          revision={revision}
          accion={estadoBanco === "en-banco" ? "Actualizar en el banco" : "Guardar en el banco"}
          guardando={guardandoBanco}
          onConfirmar={() => {
            setRevisando(false);
            void alBanco();
          }}
          onCerrar={() => setRevisando(false)}
          alIrASeccion={(id) => {
            setRevisando(false);
            seleccionarDesdeLista(id);
          }}
        />
      )}

      {versiones && (
        <Versiones
          abierto={versiones}
          onCerrar={cerrarVersiones}
          cargar={cargarVersiones}
          guardar={async (nota) => {
            await conGuardadoPrevio(() => guardarVersion(id, nota || undefined));
          }}
          restaurar={async (versionId) => {
            const l = await conGuardadoPrevio(() => restaurarVersion(id, versionId));
            despachar({ tipo: "reemplazar-doc", doc: l.doc });
          }}
        />
      )}
    </div>
  );
}
