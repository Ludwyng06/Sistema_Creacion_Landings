# Sistema Creador de Landings

Proyecto de **Sistemas Expertos** (Prof. Jhoni Cerón) · Jenser Ordoñez · 9.º semestre.

Una app que convierte los datos de un producto físico en una landing "de otro mundo", editable como en Shopify. Aplica las 8 técnicas avanzadas de diseño con IA y guarda cada landing junto al prompt que la creó.

## Instalar y correr desde cero (Windows)

**Requisitos:** Node 22 o superior (`node -v`), npm y Git. Todo se ejecuta dentro de `app/`.

```powershell
cd app
npm install                     # también corre `prisma generate`
copy .env.example .env.local    # luego abre .env.local y pega tus claves
npm run db:push                 # crea la base SQLite (dev.db)
npm run dev                     # http://localhost:3000
npx playwright install chromium # solo para `npm run capturas` y `npm run e2e`
```

### Claves de IA

Las claves viven **solo** en `app/.env.local` (nunca se suben a git). Con una sola basta; con varias, la app las reparte según el modo (cascada, simultáneo o duelo). Dónde crearlas: los enlaces están en `app/.env.example`.

| Variable | Proveedor | Consola |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini | aistudio.google.com/apikey |
| `GROQ_API_KEY` | Groq | console.groq.com/keys |
| `CEREBRAS_API_KEY` | Cerebras | cloud.cerebras.ai |
| `OPENROUTER_API_KEY` | OpenRouter | openrouter.ai/keys |
| `SERPAPI_API_KEY` | SerpAPI (opcional: investigar el producto antes del brief; plan gratuito de 250 búsquedas al mes) | serpapi.com/manage-api-key |
| `GOOGLE_FONTS_API_KEY` | Google Fonts (opcional: solo para `npm run fuentes`, que actualiza el catálogo `src/datos/fuentes.json`) | console.cloud.google.com, API «Web Fonts Developer» |
| `NASA_API_KEY` | NASA (opcional: activa APOD; NeoWs usa `DEMO_KEY` si falta) | api.nasa.gov |
| `PEXELS_API_KEY` | Pexels (opcional: fotos de ambiente para los bancos de producto; sin ella se usa solo Wikimedia) | pexels.com/api |
| `UNSPLASH_ACCESS_KEY` | Unsplash (opcional; todavía no la usa el sistema) | unsplash.com/developers |

**Obligatorio solo Gemini** (o cualquier proveedor de la tabla; con una basta). **Opcionales:** Cerebras es de pago, así que sin clave no entra a la cascada; y no se usa ninguna clave de OpenAI: Groq, Cerebras y OpenRouter hablan con una API *compatible* con OpenAI, pero no la necesitan. `SERPAPI_API_KEY` habilita «Empieza con una foto» e «Investigar el producto» (sin ella, esas tarjetas avisan que la investigación es opcional y el resto de `/crear` funciona igual). `GOOGLE_FONTS_API_KEY` solo se usa al correr `npm run fuentes`: la app lee el catálogo ya generado.

Comprueba que responden con `npm run ia:probar` (imprime una tabla por proveedor y construye una landing real) o desde `/ajustes` con «Probar todos». Sin claves la app sigue funcionando en **modo manual**: copia el prompt, pégalo en cualquier chat y pega el JSON de vuelta.

### Recursos visuales y banco de ejemplos

```powershell
npm run media                    # convierte imágenes a WebP y genera pósteres
npm run media -- --comprimir     # además recomprime los videos de public/media/home/ a su presupuesto
npm run fotogramas -- public/media/home/home-loop.mp4   # fotogramas para el scroll del home
npm run db:semilla               # siembra los 5 ejemplos del banco con la IA
npm run db:semilla -- --desde-json   # sin claves: usa datos/semilla-manual/
npm run capturas                 # miniaturas del banco (necesita Chromium)
```

Los videos originales de Grok van en `referencias/grok/` (no se suben a git); en `public/media/home/` solo quedan los optimizados.

### Bancos de medios, datos en vivo y la vitrina

Las 8 landings de la vitrina (4 de temática espacial y 4 de producto) usan imágenes reales con su crédito y licencia. Los bancos se descargan de NASA Images y Wikimedia Commons (y de Pexels si hay clave) y no se suben a git: se regeneran con un comando.

```powershell
npm run db:push                      # crea también las tablas de la caché de APIs y de los bancos
npm run bancos                       # llena los bancos b1, b3, b4, b5, b7 y p-belleza, p-bienestar, p-tecnologia, p-hogar en public/media/bancos/
npm run bancos -- --banco b3 --n 20  # un solo banco, con otra cantidad de imágenes
npm run bancos -- --solo-ia          # completa las descripciones en español que quedaron pendientes por falta de cuota
npm run bancos -- --curiosos         # rehace los datos curiosos (b8) en src/datos/datos-curiosos.json
npm run vitrina                      # construye las 8 landings con IA real y las deja en el banco (--solo <slug>, --forzar, --espera <min>)
npm run db:semilla -- --vitrina      # sin claves de IA: siembra las 8 desde datos/vitrina/*.json
```

- **Fuentes** (`src/lib/fuentes/`): NASA Images, APOD, NeoWs, NOAA Kp, USNO, ISS, Launch Library 2, Open Food Facts, Open Beauty Facts, Wikimedia, Pexels y SerpAPI (Google Shopping y preguntas). Todas responden con un tope de 8 s y un reintento en 429 o 5xx, guardan la respuesta en la tabla `CacheApi` y cuentan su uso mensual; una fuente sin clave se omite sin error.
- **Datos en vivo:** `GET /api/vivo/<widget>` con `auroras`, `fase-lunar`, `iss`, `lanzamiento` o `asteroides` responde un dato normalizado desde la caché del servidor, o 204 si la fuente falla (el widget se oculta).
- **Buscar medios:** `GET /api/medios/buscar?banco=&q=&orientacion=`. Un medio con `usoComercial` falso nunca se ofrece.
- **Créditos:** las imágenes de los bancos llevan `credito` y `licencia`; la sección `creditos` de cada landing sale sola de ellas. No se usan logos de NASA ni se sugiere respaldo de ninguna agencia.
- **Vitrina:** las imágenes que usa se copian a `public/media/vitrina/<slug>/` (tope de 25 MB) y sí se suben a git.
- **Cuotas:** si la IA agota su cuota, `npm run vitrina` espera y sigue; si aun así no alcanza, deja lo pendiente y se retoma con el mismo comando (lo que ya está en el banco se salta).

### Medios en producción (`npm run build` + `npm start`)

Next solo sirve de `public/` lo que existía al compilar. Por eso `/media/**` lo atiende un route handler (`src/app/media/[...ruta]/route.ts`) que lee del disco en cada petición (`MEDIA_DIR` o `public/media`), con `Content-Type`, `ETag`, `Last-Modified`, `Range` para video y protección contra `..`: miniaturas, fotos subidas, imágenes generadas con FLUX y medios de la vitrina aparecen sin recompilar. Se comprueba con `npx tsx tests/e2e/dia18-media.ts` contra `next start`.

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run verificar` | Tipos, lint y pruebas unitarias. Obligatorio antes de cada commit. |
| `npm run e2e` | Pruebas de punta a punta con Playwright (no entra en `verificar`). `E2E_CANAL=msedge` usa el Edge instalado. |
| `npm run db:push` | Crea o actualiza las tablas. |
| `npm run db:semilla` | Siembra el banco (`--forzar`, `--desde-json`, `--vitrina`). |
| `npm run bancos` | Llena los bancos de medios y los datos curiosos (`--banco`, `--n`, `--solo-ia`, `--curiosos`). |
| `npm run vitrina` | Construye las 8 landings de la vitrina con IA real (`--solo`, `--forzar`, `--espera`). |
| `npm run ia:probar` | Prueba cada proveedor y construye una landing real. |
| `npm run fuentes` | Regenera `src/datos/fuentes.json`, el catálogo de las 200 mejores tipografías de Google Fonts para español (necesita `GOOGLE_FONTS_API_KEY`; la app no llama a la API en ejecución). |
| `PUERTO=3120 npx tsx tests/e2e/demo.ts` | Ensayo real de la demo con las claves de `.env.local` (mide cada paso). |
| `npm run media` / `npm run fotogramas` / `npm run capturas` | Recursos y miniaturas. |

### Solución de problemas

- **Cuota agotada (429) o alta demanda (503):** la app reintenta una vez y pasa al siguiente proveedor. Revisa el uso en `/ajustes`; los límites se renuevan cada día.
- **Puerto ocupado:** `npm run dev -- -p 3001`.
- **`prisma generate` falla o falta el cliente:** cierra el servidor y ejecuta `npx prisma generate`; luego `npm run db:push`.
- **`no such table: Ajuste`:** falta `npm run db:push`.
- **Chromium no se descarga:** `E2E_CANAL=msedge npm run e2e` y `E2E_CANAL=msedge npm run capturas` usan Edge.

## Requisitos de la actividad → dónde se cumplen

| Requisito | Pantalla |
|---|---|
| 1. Tema y datos básicos | `/crear` · paso 1 (Brief) |
| 2. Un prompt por técnica | `/crear` · pasos 2 y 3 |
| 3. Combinar 2 o más técnicas | `/crear` · paso 2 (multiselección + motor de combinación) |
| 4. Banco de landings con su prompt | `/banco/[id]` (landing y prompt lado a lado) |
| 5. Ejecutar el prompt y construir | `/crear` · paso 4 → `/editor/[id]` |
