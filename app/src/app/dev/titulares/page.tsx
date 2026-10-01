import { notFound } from "next/navigation";
import { Titular } from "@/componentes/Titular";
import { ProveedorEfectos } from "@/efectos/contexto-efectos";
import { TitularCinetico } from "../../(home)/TitularCinetico";

export const metadata = { title: "Titulares · desarrollo" };

const FRASE = "Píldoras que ayudan yogur";

/** Banco de pruebas de glifos: titulares con máscara y de interlineado apretado. `tests/e2e/dia8-glifos.ts` mide que ningún glifo salga de su máscara. */
export default function PaginaTitulares() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10">
      <TitularCinetico
        texto={FRASE}
        className="text-balance font-editorial text-[clamp(2.5rem,11vw,6.5rem)] font-semibold leading-[0.95] tracking-tight"
      />
      <TitularCinetico texto={FRASE} como="h2" className="text-balance font-editorial text-[clamp(1.75rem,6vw,3.5rem)] font-semibold leading-none tracking-tight" />
      <ProveedorEfectos value={["titular-cinetico"]}>
        <Titular nivel="h2" className="font-editorial text-4xl font-semibold leading-none">
          {FRASE}
        </Titular>
      </ProveedorEfectos>
    </main>
  );
}
