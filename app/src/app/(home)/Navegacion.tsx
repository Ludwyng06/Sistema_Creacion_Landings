import Link from "next/link";
import { TEXTOS } from "./textos";

/** Navegación mínima fija: siempre visible, sin depender de JavaScript. */
export function Navegacion() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-linea/60 bg-papel/80 backdrop-blur">
      <nav aria-label="Principal" className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-1">
        <Link href="/" className="font-editorial text-base font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca sm:text-lg">
          <span className="sm:hidden">{TEXTOS.marcaCorta}</span>
          <span className="hidden sm:inline">{TEXTOS.marca}</span>
        </Link>
        <ul className="flex items-center gap-0.5 text-sm">
          {TEXTOS.enlaces.map((e) => (
            <li key={e.href}>
              <Link
                href={e.href}
                className="inline-flex min-h-11 items-center rounded-md px-2 text-tinta hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca sm:px-3"
              >
                {e.etiqueta}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
