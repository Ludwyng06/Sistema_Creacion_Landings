import { Cabecera } from "@/componentes/ajustes/Cabecera";
import { Galeria } from "@/componentes/banco/Galeria";
import { aTarjeta } from "@/lib/banco";
import { listarLandingsCompletas } from "@/lib/landings";

export const metadata = { title: "Banco de landings" };
// El banco cambia cada vez que se guarda una landing: se lee de la base en cada visita.
export const dynamic = "force-dynamic";

export default async function PaginaBanco() {
  const tarjetas = (await listarLandingsCompletas({ estado: "en-banco" })).map(aTarjeta);
  return (
    <>
      <Cabecera
        actual="/banco"
        ancho="max-w-6xl"
        titulo="Banco de landings"
        resumen="Cada landing guardada junto al prompt que la creó. Voltea una tarjeta para leer el prompt o ábrela para verla al lado de su prompt."
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <Galeria tarjetas={tarjetas} />
      </main>
    </>
  );
}
