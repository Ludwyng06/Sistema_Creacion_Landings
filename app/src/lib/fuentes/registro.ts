import { crearApod } from "./apod";
import { crearIss } from "./iss";
import { crearLanzamientos } from "./lanzamientos";
import { crearNasaImagenes } from "./nasa-imagenes";
import { crearNeoWs } from "./neows";
import { crearNoaaKp } from "./noaa-kp";
import { crearOpenBeautyFacts, crearOpenFoodFacts } from "./open-facts";
import { crearOpenverse } from "./openverse";
import { crearPexels } from "./pexels";
import { crearPixabay } from "./pixabay";
import { crearSerpApiPreguntas, crearSerpApiShopping } from "./serpapi-shopping";
import type { OpcionesFuente } from "./tipos";
import { crearUsnoLuna } from "./usno-luna";
import { crearWikimedia } from "./wikimedia";

/** Todos los adaptadores, con el entorno y el `fetch` reales (o los que se inyecten en los tests). */
export function crearFuentes(op: OpcionesFuente = {}) {
  return {
    nasaImagenes: crearNasaImagenes(op),
    apod: crearApod(op),
    neows: crearNeoWs(op),
    noaaKp: crearNoaaKp(op),
    usnoLuna: crearUsnoLuna(op),
    iss: crearIss(op),
    lanzamientos: crearLanzamientos(op),
    openFoodFacts: crearOpenFoodFacts(op),
    openBeautyFacts: crearOpenBeautyFacts(op),
    wikimedia: crearWikimedia(op),
    pexels: crearPexels(op),
    openverse: crearOpenverse(op),
    pixabay: crearPixabay(op),
    serpapiShopping: crearSerpApiShopping(op),
    serpapiPreguntas: crearSerpApiPreguntas(op),
  };
}

export type Fuentes = ReturnType<typeof crearFuentes>;
