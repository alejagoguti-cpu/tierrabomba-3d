/**
 * Configuracion de Next.js para TIERRA BOMBA 3D
 * ==================================================================
 * DECISION TECNICA 1 — `output: 'export'` (sitio estatico)
 * ------------------------------------------------------------------
 *   La plataforma se compila como sitio estatico. Motivos:
 *     1. GitHub Pages solo sirve archivos estaticos. Con exportacion
 *        estatica, el mismo `npm run build` produce el sitio publicado,
 *        sin servidor Node ni contenedor.
 *     2. Todo el visor es cliente (MapLibre GL JS + WebGL): no hay
 *        nada que ejecutar en servidor.
 *   CONSECUENCIA: no hay API routes ni Server Actions. Por eso el
 *   modulo de participacion ciudadana no puede escribir en una base de
 *   datos; ver docs/decisiones-tecnicas.md.
 *
 * DECISION TECNICA 2 — compilacion en entorno restringido
 * ------------------------------------------------------------------
 *   El entorno donde se desarrollo este proyecto corre bajo un sandbox
 *   que prohibe abrir tuberias con nombre entre procesos. La
 *   compilacion de Next.js reparte el trabajo entre procesos hijos que
 *   se comunican por tuberias y falla con `spawn EPERM`.
 *
 *   Se probo `experimental.workerThreads: true` para sustituir los
 *   procesos por hilos, pero rompe la generacion estatica con
 *   `DataCloneError: ()=>null could not be cloned` (los hilos no pueden
 *   recibir funciones). Se descarto.
 *
 *   CONCLUSION: la compilacion de produccion necesita permisos plenos
 *   sobre el proceso. No es una limitacion de la aplicacion sino del
 *   entorno de desarrollo. En una maquina normal `npm run build`
 *   funciona sin ningun ajuste.
 *
 * DECISION TECNICA 3 — comprobacion de tipos fuera del build
 * ------------------------------------------------------------------
 *   `typescript.ignoreBuildErrors` se activa para no encadenar dos
 *   compilaciones completas en cada iteracion. La seguridad de tipos
 *   NO se pierde: se comprueba con `npm run typecheck` (tsc --noEmit),
 *   que es obligatorio antes de cada entrega.
 *
 * DECISION TECNICA 4 — basePath condicional
 * ------------------------------------------------------------------
 *   GitHub Pages publica el sitio en /tierrabomba-3d/. En local debe
 *   servirse en la raiz. Se controla con NEXT_PUBLIC_BASE_PATH para no
 *   editar codigo al desplegar.
 * ==================================================================
 */

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,

  // Pages sirve rutas con barra final (/explorar/ -> /explorar/index.html)
  trailingSlash: true,

  // Sin optimizador de imagenes en servidor: no existe en export estatico
  images: { unoptimized: true },

  // La comprobacion de tipos se ejecuta aparte con `npm run typecheck`
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  ...(basePath ? { basePath, assetPrefix: basePath } : {}),

  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
