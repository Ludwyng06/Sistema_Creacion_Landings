import { NavegacionApp } from "@/componentes/ajustes/Cabecera";
import { Asistente } from "@/componentes/crear/Asistente";
import { CrearRapido } from "@/componentes/crear/CrearRapido";

export const metadata = { title: "Crear una landing" };

type Props = { searchParams: Promise<{ modo?: string }> };

/** `/crear` es el campo único; el asistente de 4 pasos vive en `/crear?modo=experto`. */
export default async function PaginaCrear({ searchParams }: Props) {
  const { modo } = await searchParams;
  return (
    <>
      <div className={`mx-auto w-full px-4 pt-4 sm:px-6 ${modo === "experto" ? "max-w-5xl md:px-8" : "max-w-3xl"}`}>
        <NavegacionApp actual="/crear" />
      </div>
      {modo === "experto" ? <Asistente /> : <CrearRapido />}
    </>
  );
}
