import type { Fragmento } from "./fragmentos";
import type { PrecioReferencia } from "@/lib/contratos";

// Dato informativo: en el mercado se ve entre X y Y. Nunca entra al brief (la persona escribe su propio precio).

type Moneda = PrecioReferencia["moneda"];

const MONEDA_POR_PAIS: Record<string, Moneda> = { co: "COP", mx: "MXN", es: "EUR", us: "USD" };
const MONTO = /(US\$|USD|COP|MXN|EUR|\$|€)\s?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)|(\d{1,3}(?:[.,]\d{3})+|\d+)\s?(USD|COP|MXN|EUR)\b/gi;

/** «99.000», «1.299.900» y «99,000» son miles; «29.99» y «29,9» son decimales. */
export function leerMonto(texto: string): number | null {
  const t = texto.trim();
  let n: number;
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(t)) n = Number(t.replace(/[.,]/g, ""));
  else if (/^\d{1,3}(?:[.,]\d{3})+[.,]\d{1,2}$/.test(t)) n = Number(t.slice(0, -3).replace(/[.,]/g, "") + "." + t.slice(-2).replace(/\D/g, "").padEnd(1, "0"));
  else if (/^\d+[.,]\d{1,2}$/.test(t)) n = Number(t.replace(",", "."));
  else if (/^\d+$/.test(t)) n = Number(t);
  else return null;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Rango de precios que aparece en los fragmentos, con las fuentes de donde salió; `null` si no aparece ninguno. */
export function precioReferencia(fragmentos: Fragmento[], pais = "co"): PrecioReferencia | null {
  const montos: { valor: number; moneda?: Moneda; fragmento: Fragmento }[] = [];
  for (const f of fragmentos) {
    for (const m of `${f.titulo} ${f.texto}`.matchAll(MONTO)) {
      const marca = (m[1] ?? m[4] ?? "").toUpperCase();
      const valor = leerMonto(m[2] ?? m[3]);
      if (valor === null) continue;
      const moneda: Moneda | undefined = marca === "COP" ? "COP" : marca === "MXN" ? "MXN" : marca === "EUR" || marca === "€" ? "EUR" : marca === "USD" || marca === "US$" ? "USD" : undefined;
      montos.push({ valor, moneda, fragmento: f });
    }
  }
  if (montos.length === 0) return null;
  const moneda = montos.find((m) => m.moneda)?.moneda ?? MONEDA_POR_PAIS[pais.toLowerCase()] ?? "USD";
  const validos = montos.filter((m) => !m.moneda || m.moneda === moneda);
  if (validos.length === 0) return null;
  const valores = validos.map((m) => m.valor);
  const fuentes = new Map<string, PrecioReferencia["fuentes"][number]>();
  for (const m of validos) fuentes.set(m.fragmento.fuente.url, m.fragmento.fuente);
  return { min: Math.min(...valores), max: Math.max(...valores), moneda, fuentes: [...fuentes.values()] };
}
