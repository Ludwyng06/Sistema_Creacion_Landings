import { correr, docBase, manejadorBase } from "./ayudas";

/** Landing del ejemplo con el héroe sin `variante`, como la devolvió Groq. */
export const corrida = () =>
  correr(
    ["groq"],
    manejadorBase({
      landing: () => {
        const doc = docBase() as unknown as { secciones: Record<string, unknown>[] };
        delete doc.secciones[0].variante;
        return doc;
      },
    }),
  );
