import type { ReactNode } from "react";

/** Banner rojo del validador anti-split (render): explica el problema y ofrece el camino para arreglarlo. */
export function BannerAntiSplit({ accion }: { accion: ReactNode }) {
  return (
    <div role="alert" data-banner-anti-split className="rounded-md border-2 border-error bg-papel p-3 text-error">
      <p className="font-editorial text-lg font-semibold">Héroe split detectado</p>
      <p className="mt-1 text-sm">
        El título y la imagen del primer pantallazo están lado a lado, con el título a la izquierda. Ese diseño está fuera del catálogo: usa una variante de héroe
        aprobada, con el contenido centrado, superpuesto o apilado.
      </p>
      <div className="mt-2">{accion}</div>
    </div>
  );
}
