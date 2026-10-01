import { consultarSuave, type OpcionesEjecucion } from "@/lib/fuentes/ejecutar";
import { widgetDeVariante } from "./plan";
import { crearFuentes, type Fuentes } from "@/lib/fuentes/registro";
import { obtenerDatoVivo } from "@/lib/vivo";
import type { EntradaVitrina, EstadoFuente, FuenteInvestigacion, InvestigacionVitrina } from "./tipos";

// Etapa 1 de la vitrina: investiga con las fuentes que le tocan a cada producto (tabla de plan-v2.md).
// Toda fuente que falla o está apagada queda anotada y la construcción sigue sin ella.

export interface DepsInvestigar {
  fuentes?: Fuentes;
  ejecucion?: OpcionesEjecucion;
  ahora?: () => Date;
}

const MAX_PREGUNTAS = 3;

export async function investigarEntrada(e: EntradaVitrina, d: DepsInvestigar = {}): Promise<InvestigacionVitrina> {
  const f = d.fuentes ?? crearFuentes();
  const ahora = d.ahora ?? (() => new Date());
  const ctx = d.ejecucion ?? {};
  const salida: InvestigacionVitrina = { consultadoEn: ahora().toISOString(), fuentes: [], preguntas: [], preciosReferencia: [], composicionReferencia: [] };
  const anota = (fuente: FuenteInvestigacion, estado: EstadoFuente["estado"], detalle?: string) => salida.fuentes.push({ fuente, estado, ...(detalle ? { detalle } : {}) });

  for (const fuente of e.fuentes) {
    try {
      switch (fuente) {
        case "nasa-images":
          anota(fuente, "ok", `bancos ${e.bancos.join(", ")}`); // los medios ya están en los bancos (npm run bancos)
          break;
        case "wikimedia":
          anota(fuente, "ok", `bancos ${e.bancos.join(", ")}`);
          break;
        case "noaa-kp":
        case "usno-luna":
        case "iss":
        case "lanzamientos":
        case "neows": {
          const widget = e.widget ? widgetDeVariante(e.widget.variante) : undefined;
          const dato = widget ? await obtenerDatoVivo(widget, { fuentes: f, ahora }) : null;
          anota(fuente, dato ? "ok" : "fallo", dato ? `${widget}: responde` : "no respondió; la sección de dato en vivo se oculta sola");
          if (e.widget) salida.widget = { variante: e.widget.variante, responde: dato !== null };
          break;
        }
        case "open-food-facts": {
          const q = e.consultas.openFoodFacts;
          const r = q ? await consultarSuave(f.openFoodFacts, { q, max: 5 }, ctx) : null;
          for (const p of r?.datos ?? []) if (p.ingredientes) salida.composicionReferencia.push({ fuente: "Open Food Facts", nombre: p.nombre, ingredientes: p.ingredientes.slice(0, 200) });
          anota(fuente, r ? "ok" : "fallo", r ? `${r.datos.length} productos de referencia` : "sin respuesta");
          break;
        }
        case "open-beauty-facts": {
          const q = e.consultas.openBeautyFacts;
          const r = q ? await consultarSuave(f.openBeautyFacts, { q, max: 5 }, ctx) : null;
          for (const p of r?.datos ?? []) if (p.ingredientes) salida.composicionReferencia.push({ fuente: "Open Beauty Facts", nombre: p.nombre, ingredientes: p.ingredientes.slice(0, 200) });
          anota(fuente, r ? "ok" : "fallo", r ? `${r.datos.length} productos de referencia` : "sin respuesta");
          break;
        }
        case "serpapi": {
          if (!f.serpapiShopping.habilitada()) {
            anota(fuente, "omitida", "falta SERPAPI_API_KEY");
            break;
          }
          if (e.consultas.shopping) {
            const r = await consultarSuave(f.serpapiShopping, { q: e.consultas.shopping, max: 8 }, ctx);
            for (const p of r?.datos ?? []) salida.preciosReferencia.push({ titulo: p.titulo.slice(0, 80), precio: p.precio, tienda: p.tienda });
          }
          if (e.consultas.preguntas) {
            const r = await consultarSuave(f.serpapiPreguntas, { q: e.consultas.preguntas, max: MAX_PREGUNTAS }, ctx);
            salida.preguntas.push(...(r?.datos ?? []));
          }
          anota(fuente, salida.preciosReferencia.length + salida.preguntas.length > 0 ? "ok" : "fallo", `${salida.preciosReferencia.length} precios de referencia, ${salida.preguntas.length} preguntas`);
          break;
        }
      }
    } catch (err) {
      anota(fuente, "fallo", err instanceof Error ? err.message.split("\n")[0] : String(err));
    }
  }
  return salida;
}
