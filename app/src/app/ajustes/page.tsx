import { Cabecera } from "@/componentes/ajustes/Cabecera";
import { PanelAjustes } from "@/componentes/ajustes/PanelAjustes";

export const metadata = { title: "Ajustes de la IA" };

export default function PaginaAjustes() {
  return (
    <>
      <Cabecera actual="/ajustes" titulo="Ajustes de la IA" resumen="Revisa qué proveedores responden, cuánto llevas usado y cómo se reparte el trabajo entre ellos." />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <PanelAjustes />
      </main>
    </>
  );
}
