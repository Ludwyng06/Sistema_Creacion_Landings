import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Visor } from "@/componentes/banco/Visor";
import { LandingNoEncontrada, listarLandingsCompletas, obtenerLanding, type LandingCompleta } from "@/lib/landings";
import { aItemVisor, dispositivoDe } from "@/lib/visor";

// El visor lee la base en cada visita: muestra lo último que se guardó.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ dispositivo?: string; detalles?: string; entrega?: string}> };

async function cargar(id: string): Promise<LandingCompleta | null> {
  try {
    return await obtenerLanding(id);
  } catch (e) {
    if (e instanceof LandingNoEncontrada) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const landing = await cargar((await params).id);
  return { title: landing ? `${landing.nombre} · Visor` : "Landing no encontrada" };
}

export default async function PaginaVisor({ params, searchParams }: Props) {
  const { id } = await params;
  const consulta = await searchParams;
  const actual = await cargar(id);
  if (!actual) notFound();

  // Las landings del banco, de la más reciente a la más antigua (el mismo orden que /banco). Si la que se abre es un
  // borrador, va primero para poder verla y luego recorrer el banco con ← →.
  const banco = (await listarLandingsCompletas({ estado: "en-banco" })).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  const lista = banco.some((l) => l.id === id) ? banco : [actual, ...banco];

  return <Visor items={lista.map(aItemVisor)} inicialId={id} dispositivoInicial={dispositivoDe(consulta.dispositivo)} detallesInicial={consulta.detalles === "1"} entregaInicial={consulta.entrega === "1"} />;
}
