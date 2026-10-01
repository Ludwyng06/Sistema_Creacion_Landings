import Link from "next/link";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from "@/componentes/crear/estilos";

export const metadata = { title: "No encontramos esta página" };

/** 404 en español y con salida: cualquier ruta que no existe (una landing borrada, un enlace viejo) cae aquí. */
export default function NoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-5 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-tinta-suave">Error 404</p>
      <h1 className="font-editorial text-4xl font-semibold tracking-tight sm:text-5xl">No encontramos esta página</h1>
      <p className="text-lg text-tinta-suave">La dirección no existe o la landing se borró. Vuelve al inicio o revisa el banco: ahí están todas las que guardaste.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={BOTON_PRIMARIO}>
          Ir al inicio
        </Link>
        <Link href="/banco" className={BOTON_SECUNDARIO}>
          Abrir el banco
        </Link>
      </div>
    </main>
  );
}
