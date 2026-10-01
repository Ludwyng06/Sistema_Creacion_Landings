import { notFound } from "next/navigation";
import { PaginaEfectos } from "./PaginaEfectos";

export const metadata = { title: "Efectos · desarrollo" };

export default function PaginaEfectosDev() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PaginaEfectos />;
}
