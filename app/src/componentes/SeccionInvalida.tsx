/** Aviso discreto (solo en desarrollo) cuando los ajustes de una sección no cumplen su esquema. */
export function SeccionInvalida({ tipo }: { tipo: string }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <p className="borde-token m-4 rounded-token p-3 text-center text-sm text-suave">
      Los ajustes de la sección «{tipo}» no cumplen su esquema.
    </p>
  );
}
