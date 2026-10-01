import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, Instrument_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

// App: una tipografía editorial (títulos) y una de interfaz.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

// Familias de las semillas de las landings (se resuelven desde `doc.tokens.tipografia`). No se precargan: solo se
// descargan cuando una landing las usa, así las pantallas de la app no cargan fuentes que no muestran.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Sistema Creador de Landings",
  description: "Convierte el brief de un producto físico en una landing única y editable.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fuentes = [fraunces, instrumentSans, spaceGrotesk, ibmPlexSans]
    .map((fuente) => fuente.variable)
    .join(" ");

  return (
    <html lang="es" className={`${fuentes} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
