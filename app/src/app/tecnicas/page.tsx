import { Cabecera } from "@/componentes/ajustes/Cabecera";
import { ContenidoTecnicas } from "@/componentes/tecnicas/ContenidoTecnicas";

export const metadata = { title: "Las 8 técnicas" };

export default function PaginaTecnicas() {
  return (
    <>
      <Cabecera actual="/tecnicas" titulo="Las 8 técnicas" resumen="Cómo el sistema convierte el conocimiento de diseño en prompts que puedes leer, combinar y comprobar." />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <ContenidoTecnicas />
      </main>
    </>
  );
}
