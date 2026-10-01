import { Asistente } from "@/componentes/crear/Asistente";
import { CrearRapido } from "@/componentes/crear/CrearRapido";

export const metadata = { title: "Crear una landing" };

type Props = { searchParams: Promise<{ modo?: string }> };

/** `/crear` es el campo único; el asistente de 4 pasos vive en `/crear?modo=experto`. */
export default async function PaginaCrear({ searchParams }: Props) {
  const { modo } = await searchParams;
  return modo === "experto" ? <Asistente /> : <CrearRapido />;
}
