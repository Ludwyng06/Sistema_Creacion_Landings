# Semilla manual del banco

Sin claves de IA, el banco se siembra con documentos ya generados (modo manual).

La carpeta trae los 5 `LandingDoc` de los ejemplos, creados con Gemini el 29 de septiembre de 2026 con `npm run db:semilla`. Con ellos `npm run db:semilla -- --desde-json` funciona sin claves y las pruebas e2e llenan su base de prueba. Para reemplazarlos, sigue los pasos de abajo.

1. En `/crear` (o con `POST /api/prompt`) genera el prompt de un ejemplo y pégalo en Claude o Grok.
2. Guarda la respuesta JSON (un `LandingDoc`) como `<id>.json` en esta carpeta, con estos ids:
   `corrector-postura`, `colageno`, `cepillo-9en1`, `timbre-camara`, `llavero-3en1`.
3. Ejecuta `npm run db:push` (una vez) y luego `npm run db:semilla -- --desde-json`.

El script valida cada archivo con `LandingDoc` y `validarTodo`, fuerza la variante de héroe del ejemplo,
enlaza los recursos de `public/media/ejemplos/<id>/` y guarda la landing (en el banco si ningún validador queda en rojo).
Los ejemplos que ya existen se saltan; usa `--forzar` para rehacerlos y `--solo <id>` para procesar uno.
