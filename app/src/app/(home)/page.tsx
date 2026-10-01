import { EJEMPLOS } from "@/datos/ejemplos";
import { listarLandings, obtenerLanding } from "@/lib/landings";
import { aTexto, combinar, moduloPorId } from "@/lib/tecnicas";
import type { TarjetaBanco } from "./banco-tarjetas";
import { tarjetasDelBanco } from "./banco-tarjetas";
import { BriefCap } from "./capitulos/Brief";
import { Portada } from "./capitulos/Portada";
import { Problema } from "./capitulos/Problema";
import { BancoDiferido, CierreDiferido, CriticoDiferido, EnsamblajeDiferido, SemillaDiferido, TecnicasDiferido } from "./Diferido";
import { Indicador } from "./Indicador";
import { Navegacion } from "./Navegacion";
import { Suavizado } from "./Suavizado";

// El capítulo del banco lee la base de datos en cada visita.
export const dynamic = "force-dynamic";

type Entrada = Omit<TarjetaBanco, "esEjemplo">;

async function entradasReales(): Promise<Entrada[]> {
  try {
    const resumenes = (await listarLandings({ estado: "en-banco" })).slice(0, 6);
    return await Promise.all(
      resumenes.map(async (r) => {
        const completa = await obtenerLanding(r.id);
        return {
          id: r.id,
          nombre: r.nombre,
          puntaje: r.puntaje,
          tecnicas: r.tecnicas.map((t) => moduloPorId(t).nombre),
          prompt: completa.prompt,
          href: `/l/${r.slug}`,
        };
      }),
    );
  } catch {
    return []; // sin base de datos el home sigue funcionando con los ejemplos
  }
}

/** Los tres primeros ejemplos del banco de ejemplos, con el prompt que armaría el sistema para cada brief. */
function entradasDeEjemplo(): Entrada[] {
  return EJEMPLOS.slice(0, 3).map((e) => ({
    id: `ejemplo-${e.id}`,
    nombre: e.brief.nombre,
    puntaje: null,
    tecnicas: e.tecnicas.map((t) => moduloPorId(t).nombre),
    prompt: aTexto(combinar(e.brief, e.tecnicas)),
    href: null,
  }));
}

export default async function PaginaInicio() {
  const tarjetas = tarjetasDelBanco(await entradasReales(), entradasDeEjemplo());
  return (
    <>
      <Navegacion />
      <Suavizado />
      <Indicador />
      <main>
        <Portada />
        <Problema />
        <BriefCap />
        <TecnicasDiferido />
        <EnsamblajeDiferido />
        <SemillaDiferido />
        <CriticoDiferido />
        <BancoDiferido tarjetas={tarjetas} />
        <CierreDiferido />
      </main>
    </>
  );
}
