import type { ModuloTecnica, TecnicaId } from "@/lib/contratos";
import { tecnicaAmbicioso } from "./ambicioso";
import { tecnicaCritico } from "./critico";
import { tecnicaHumana } from "./humana";
import { tecnicaImagenes } from "./imagenes";
import { tecnicaNegativas } from "./negativas";
import { tecnicaSemilla } from "./semilla";
import { tecnicaSustractivo } from "./sustractivo";
import { tecnicaVideo } from "./video";

/** Los 8 módulos ordenados por número de técnica (1 a 8). */
export const modulos: ModuloTecnica[] = [
  tecnicaSemilla,
  tecnicaAmbicioso,
  tecnicaCritico,
  tecnicaImagenes,
  tecnicaVideo,
  tecnicaSustractivo,
  tecnicaNegativas,
  tecnicaHumana,
].sort((a, b) => a.numero - b.numero);

export function moduloPorId(id: TecnicaId): ModuloTecnica {
  const modulo = modulos.find((m) => m.id === id);
  if (!modulo) throw new Error(`Técnica desconocida: ${id}`);
  return modulo;
}
