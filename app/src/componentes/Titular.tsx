import { TextoCinetico } from "@/efectos/TextoCinetico";

type Props = { nivel?: "h1" | "h2"; className?: string; children: string };

/** Encabezado de sección; aplica `titular-cinetico` cuando la sección lo declara. */
export function Titular({ nivel = "h2", className = "", children }: Props) {
  const Etiqueta = nivel;
  return (
    <Etiqueta className={className}>
      <TextoCinetico texto={children} />
    </Etiqueta>
  );
}
