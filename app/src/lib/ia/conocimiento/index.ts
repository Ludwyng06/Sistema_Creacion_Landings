// Base de conocimiento de conversión (docs/sistema-creacion-landings-v2.md §17), destilada y adaptada a las reglas del proyecto.
// Cada constante se inyecta en el bloque CONOCIMIENTO de la etapa que la necesita.

export const COPY_COLOMBIA = `COMPRADOR COLOMBIANO Y CONTRAENTREGA
- El copy pelea primero contra la desconfianza y después contra la indiferencia: gana el más creíble, no el más entusiasta.
- Siete piezas en orden: problema (gancho) → dolor (escena) → deseo → beneficio del resultado → mecanismo único → objeciones → CTA.
- Niveles de consciencia: 1 no sabe del problema (educar) · 2 sabe el problema (iluminar el dolor; el más común en Meta) · 3 sabe la solución (mecanismo y visualización) · 4 conoce el producto (objeciones, comparativa, prueba) · 5 listo (garantía, contraentrega, urgencia real).
- Precio: por debajo de ~$150.000 es decisión impulsiva (copy corto); por encima de ~$250.000 se activa lo racional (más prueba y objeciones). Formato $89.900.
- Contraentrega narrado: «No pagas nada hoy. Te llega, lo revisas y solo ahí le pagas al mensajero». El verbo que trabaja es revisar. Va junto al precio y en el cierre.
- Señales de confianza: precio, envío y tiempo sin rodeos; especificaciones en cm, L o W; admitir una limitación; retracto de 5 días hábiles (Ley 1480) y garantía legal como argumento.
- Alarmas de estafa que se evitan: mayúsculas sostenidas, cadenas de emojis, «últimas unidades» permanente, descuentos imposibles, cero datos concretos.
- Diez objeciones típicas: ¿y si no llega? · ¿es como en la foto? · ¿cuánto vale el envío? · ¿es original? · ¿envían a mi municipio? · ¿garantía y a quién reclamo? · ¿sirve con 110 V? · ¿consume mucha luz? · ¿me cabe? · ¿puedo pagar a cuotas?
- Mecanismo único: «Pensabas que [creencia vieja], pero [mecanismo nuevo]». Sale de datos reales del producto (material, diseño, capacidad, proceso). No confundas especificación con mecanismo.
- Tabla comparativa: contra la solución vieja o contra no tener nada, nunca contra una marca rival, con palabras del cliente.
- Léxico: celular, carro, apartamento, nevera, computador; «toca», «de una», «sin sustos» con cuentagotas. Tuteo neutro.
- Titular de producto: [Nombre técnico] – [Resultado en palabras del cliente] · [Objeción neutralizada]. Gancho pregunta-escena: «¿[escena literal del problema]?» + [verbo] + [resultado] + sin [objeción].
- Auditoría final: ¿suena natural? ¿tiene ritmo? ¿resuelve cada duda donde aparece? ¿se puede decir con la mitad de palabras?`;

export const CRO = `CRO POR ORDEN DE IMPACTO
1. Claridad de la propuesta de valor en 5 segundos (beneficio específico en el idioma del cliente).
2. Titular: resultado + especificidad + coincidencia con el anuncio de origen.
3. CTA: una acción principal, visible sin scroll, con texto de valor («Pedir el mío y pagar al recibir»), repetido en los puntos de decisión.
4. Jerarquía visual y escaneabilidad; espacio en blanco; imágenes que apoyan, no distraen.
5. Señales de confianza cerca de los CTA y después de las promesas.
6. Manejo de objeciones: preguntas frecuentes, garantías, comparativas, transparencia del proceso.
7. Fricción: menos campos, pasos claros, velocidad en móvil.
Formulario contraentrega: pocos campos, celular con validación colombiana, sin correo obligatorio.
Orden global de preguntas del visitante: ¿esto es para mí? → ¿funciona y por qué este? → ¿cuánto y cómo? → ¿y si me equivoco? → ¿cómo lo pido? La prueba social va inmediatamente después del precio.`;

export const OFERTAS = `ECUACIÓN DE VALOR
Valor = (resultado soñado × probabilidad percibida) / (tiempo de espera × esfuerzo y sacrificio).
- Sube la probabilidad con prueba, garantía y mecanismo específico. Baja el tiempo («llega en 2 a 4 días», «listo en 5 minutos») y el esfuerzo («sin taladrar», «sin armar»).
- Oferta completa = entregable + bonos reales + garantía + urgencia real + precio y forma de pago.
- Prohibido: escasez manipulada, garantías imposibles, inflar el valor de bonos, «valorado en $X» sin comparable.`;

export const PSICOLOGIA = `PSICOLOGÍA APLICADA CON ÉTICA
Trabajo por hacer (se vende el hoyo, no el taladro) · aversión a la pérdida (costo acumulado de no resolver) · anclaje contra un precio real verificable · prueba social de personas parecidas · reducción de riesgo (contraentrega, retracto) · coherencia entre anuncio y landing · fluidez cognitiva (lo simple se percibe verdadero) · enmarque por día («menos de $1.000 al día»). Nunca manipulación: sin urgencia falsa ni culpa.`;

export const ANTI_PROMEDIO = `ANTI-PROMEDIO DE IA
- Toda decisión visual se rastrea a la semilla: [tradición visual] + [artefacto de otra industria] + [una prohibición].
- Gasta la audacia en un solo momento memorable; el resto disciplinado. Quita un accesorio antes de salir.
- Evita los defaults de IA: crema + serif + terracota; negro + un acento ácido; tarjetas redondeadas iguales con sombra gris; etiquetas en mayúsculas sobre cada título; «A · B · C»; flecha «→» en cada botón; resaltar una sola palabra del titular en otro color.
- Prueba de sustitución: si el titular le sirve a cualquier competidor, está mal.
- Numeración 01/02/03 solo si el contenido es una secuencia real. Poda: fuera badges e íconos que no cambian la decisión.`;

export const FOTOS = `FIDELIDAD DE IMAGEN
- Cada imagen mata una objeción: 1 problema resuelto · 2 qué es · 3 beneficio y detalle · 4 prueba de calidad (macro) · 5 uso real y escala.
- Errores que causan devoluciones: accesorios inventados, variantes inexistentes, escala equivocada, color corrido, inconsistencia entre imágenes.
- Prueba de miniatura: la imagen se entiende en 1 s a 150 px; el producto ocupa al menos el 45 % del encuadre en el héroe.
- Una ficha común (paleta, luz, lente, estilo y fondo) para que todas las imágenes de una landing parezcan de la misma sesión.`;

/** Fidelidad del proyecto que el crítico debe conocer: alinea su rúbrica con la regla 6, no la relaja. */
export const CONTEXTO_FIDELIDAD = `CONTEXTO DE FIDELIDAD DEL PROYECTO (regla 6)
Esta landing no puede llevar testimonios, calificaciones ni cifras de clientes inventados: por diseño no existen. Por eso la falta de testimonios o calificaciones NO se penaliza en «Confianza» si la confianza se construye con prueba verificable: garantía con días y condiciones del vendedor, pago contraentrega, derecho de retracto de la Ley 1480, especificaciones con su fuente, tiendas donde se vende y datos de fuentes públicas con su crédito. Sí se penaliza: un dato inventado, un [COMPLETAR] visible, una garantía repetida, una imagen que no corresponde al producto o un texto alternativo pobre. La escala y el umbral no cambian: 10 es una landing sin nada que corregir.`;
