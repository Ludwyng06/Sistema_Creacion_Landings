import { Fragment } from "react";
import { COMPLETAR } from "./dinero";

/** Muestra un texto; si trae la marca `[COMPLETAR]` la deja visible pero discreta. */
export function Dato({ children }: { children: string | number }) {
  const partes = String(children).split(COMPLETAR);
  return (
    <>
      {partes.map((parte, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span
              title="Falta este dato del brief"
              className="border-b border-dashed border-suave text-[0.8em] font-normal tracking-normal text-suave"
            >
              {COMPLETAR}
            </span>
          )}
          {parte}
        </Fragment>
      ))}
    </>
  );
}
