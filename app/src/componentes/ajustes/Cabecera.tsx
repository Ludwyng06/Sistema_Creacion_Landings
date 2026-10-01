import Link from "next/link";

const ENLACES = [
  { href: "/crear", texto: "Crear" },
  { href: "/banco", texto: "Banco" },
  { href: "/tecnicas", texto: "Técnicas" },
  { href: "/ajustes", texto: "Ajustes" },
];

type Seccion = "/crear" | "/ajustes" | "/tecnicas" | "/banco";

/** Enlaces entre las pantallas de la app; `/crear` los usa solos, sin título. */
export function NavegacionApp({ actual }: { actual: Seccion }) {
  return (
        <nav aria-label="Secciones de la app" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <Link href="/" className="font-editorial text-base font-semibold hover:underline">
            <span className="max-sm:hidden">Sistema Creador de Landings</span>
            <span className="sm:hidden" aria-label="Sistema Creador de Landings">
              Landings
            </span>
          </Link>
          {ENLACES.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              aria-current={e.href === actual ? "page" : undefined}
              className={`inline-flex min-h-11 items-center hover:underline ${e.href === actual ? "font-medium text-marca underline" : "text-tinta-suave"}`}
            >
              {e.texto}
            </Link>
          ))}
        </nav>
  );
}

/** Cabecera común de /ajustes, /tecnicas y /banco: mismo estilo sobrio del asistente. */
export function Cabecera({ actual, titulo, resumen, ancho = "max-w-5xl" }: { actual: Seccion; titulo: string; resumen?: string; ancho?: "max-w-5xl" | "max-w-6xl" | "max-w-7xl" }) {
  return (
    <header className="border-b border-linea">
      <div className={`mx-auto flex w-full ${ancho} flex-col gap-4 px-4 py-6 sm:px-6`}>
        <NavegacionApp actual={actual} />
        <div className="flex flex-col gap-2">
          <h1 className="font-editorial text-4xl font-semibold tracking-tight sm:text-5xl">{titulo}</h1>
          {resumen && <p className="max-w-2xl text-lg text-tinta-suave">{resumen}</p>}
        </div>
      </div>
    </header>
  );
}
