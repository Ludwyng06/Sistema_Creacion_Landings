import type { EntradaFuente } from "./seleccionar";
import datos from "@/datos/fuentes.json";
import { TIPOGRAFIAS } from "@/lib/tecnicas/semillas";

// Catálogo de tipografías para el panel Tema del editor (tarea 10-A). La app no llama a la API de Google Fonts:
// lee `src/datos/fuentes.json` (se actualiza con `npm run fuentes`). La IA NO elige de aquí: sigue con los pares
// curados de la biblioteca de semillas.

export type { CategoriaFuente, EntradaFuente, UsoSugerido } from "./seleccionar";

export const CATALOGO_FUENTES: readonly EntradaFuente[] = datos.fuentes as EntradaFuente[];

const clave = (nombre: string) => nombre.trim().toLowerCase();
const PORNOMBRE = new Map(CATALOGO_FUENTES.map((f) => [clave(f.familia), f]));
const DE_LA_BIBLIOTECA = new Set(TIPOGRAFIAS.flatMap((p) => [clave(p.titulos), clave(p.cuerpo)]));

export const buscarFuente = (nombre: string): EntradaFuente | undefined => PORNOMBRE.get(clave(nombre));

/** ¿Está en el catálogo de 200? */
export const estaEnCatalogo = (nombre: string): boolean => PORNOMBRE.has(clave(nombre));

/** ¿Es una de las familias de los pares curados de la biblioteca de semillas? */
export const estaEnBiblioteca = (nombre: string): boolean => DE_LA_BIBLIOTECA.has(clave(nombre));

/** Una familia es conocida si está en el catálogo o en la biblioteca de semillas; el resto se avisa en amarillo. */
export const esFamiliaConocida = (nombre: string): boolean => estaEnCatalogo(nombre) || estaEnBiblioteca(nombre);
