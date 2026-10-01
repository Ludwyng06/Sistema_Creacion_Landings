import type { DatoEnVivo } from "@/lib/contratos";

const ZONA = "America/Bogota";

const num = (n: number, decimales = 0) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: decimales }).format(n);

/** «Actualizado a las 3:45 p. m.» (hora de Colombia). Vacío si la fecha no es válida. */
export function horaActualizacion(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const hora = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: ZONA }).format(fecha);
  return `Actualizado a las ${hora}`;
}

function fechaLarga(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: ZONA }).format(fecha);
}

const NIVEL_AURORAS = { baja: "baja", moderada: "moderada", alta: "alta", "muy-alta": "muy alta" } as const;

/** Frase humana del dato, lista para mostrar. */
export function frase(dato: DatoEnVivo): string {
  switch (dato.widget) {
    case "auroras":
      return `Actividad de auroras hoy: ${NIVEL_AURORAS[dato.nivel]} (Kp ${num(dato.kp, 1)} de 9).`;
    case "fase-lunar": {
      const iluminada = dato.iluminacion === null ? "" : `, con ${num(dato.iluminacion)} % iluminada`;
      const lunaLlena = dato.proximaLlena ? ` La próxima luna llena es el ${fechaLarga(dato.proximaLlena)}.` : "";
      return `Hoy la Luna está en ${dato.fase.toLowerCase()}${iluminada}.${lunaLlena}`;
    }
    case "iss":
      return `La Estación Espacial Internacional pasa ahora sobre latitud ${num(dato.latitud, 1)}° y longitud ${num(dato.longitud, 1)}°.`;
    case "lanzamiento":
      return `Próximo lanzamiento: ${dato.mision}, en un ${dato.cohete}.`;
    case "asteroides":
      return dato.cantidad === 0
        ? "Hoy no pasa ningún asteroide cerca de la Tierra."
        : dato.cantidad === 1
          ? "Hoy pasa 1 asteroide cerca de la Tierra."
          : `Hoy pasan ${num(dato.cantidad)} asteroides cerca de la Tierra.`;
  }
}

/** Cuenta regresiva hasta el despegue; `null` si ya pasó. */
export function cuentaRegresiva(fechaLanzamiento: string, ahora: number): { dias: number; horas: number; minutos: number; segundos: number } | null {
  const falta = Date.parse(fechaLanzamiento) - ahora;
  if (!Number.isFinite(falta) || falta <= 0) return null;
  const total = Math.floor(falta / 1000);
  return { dias: Math.floor(total / 86400), horas: Math.floor((total % 86400) / 3600), minutos: Math.floor((total % 3600) / 60), segundos: total % 60 };
}
