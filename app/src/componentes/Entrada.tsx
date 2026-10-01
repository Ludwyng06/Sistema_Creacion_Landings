import type { CSSProperties, ReactNode } from "react";
import type { Seccion } from "@/lib/contratos";

type Props = { animacion?: Seccion["animacion"]; children: ReactNode };

/**
 * Entrada suave de una sección, en CSS puro (`globals.css`, `.entrada-*`): corre en cuanto el navegador pinta el HTML,
 * sin esperar a la hidratación ni cargar una librería de animación. Con `prefers-reduced-motion` (o `reducirMovimiento`
 * en `LandingRender`) la sección aparece quieta.
 */
export function Entrada({ animacion, children }: Props) {
  const entrada = animacion?.entrada ?? "aparecer";
  if (entrada === "ninguna") return <>{children}</>;
  const estilo = animacion?.retraso ? ({ "--retraso-entrada": `${animacion.retraso}s` } as CSSProperties) : undefined;
  return (
    <div className={`entrada-${entrada}`} style={estilo}>
      {children}
    </div>
  );
}
