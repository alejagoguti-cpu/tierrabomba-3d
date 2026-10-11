#!/usr/bin/env node
/**
 * previsualizar.mjs
 * ------------------------------------------------------------------
 * Sirve la compilacion estatica (carpeta out/) para comprobar
 * exactamente el artefacto que se publica en GitHub Pages.
 *
 * POR QUE NO `next dev`
 *   `next dev` compila bajo demanda y su resultado no siempre coincide
 *   con el sitio exportado. Para validar el despliegue hay que servir
 *   `out/` tal cual.
 *
 * Uso:
 *   npm run build && node scripts/web/previsualizar.mjs
 *   -> http://localhost:5190
 * ------------------------------------------------------------------
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(__dirname, '..', '..');
const PUBLICADO = join(RAIZ, 'out');
const PUERTO = Number(process.env.PORT ?? 5190);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const humano = (n) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PUERTO}`);
    let rel = decodeURIComponent(url.pathname);

    // Defensa contra path traversal
    const destino = normalize(join(PUBLICADO, rel));
    if (!destino.startsWith(PUBLICADO + sep) && destino !== PUBLICADO) {
      res.writeHead(403).end('403 Prohibido');
      return;
    }

    let info;
    try {
      info = await stat(destino);
    } catch {
      // Un 404 de Next es un index.html dentro de su carpeta
      try {
        info = await stat(join(PUBLICADO, '404.html'));
        const html = await readFile(join(PUBLICADO, '404.html'));
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        console.log(`  404  ${rel}`);
        return;
      } catch {
        res.writeHead(404).end('404 No encontrado');
        console.log(`  404  ${rel}`);
        return;
      }
    }

    const archivo = info.isDirectory() ? join(destino, 'index.html') : destino;
    const contenido = await readFile(archivo);
    const est = await stat(archivo);

    res.writeHead(200, {
      'Content-Type': TIPOS[extname(archivo).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': est.size,
      'Cache-Control': 'no-store',
    });
    res.end(contenido);

    console.log(`  200  ${humano(est.size).padStart(9)}  ${rel}`);
  } catch (err) {
    res.writeHead(500).end(`500 ${err.code ?? 'Error'}`);
    console.log(`  500  ${req.url}  ${err.message}`);
  }
});

servidor.listen(PUERTO, '127.0.0.1', async () => {
  console.log('\n  Previsualizacion del sitio compilado');
  console.log('  ' + '-'.repeat(58));

  try {
    await stat(PUBLICADO);
  } catch {
    console.error(`  ERROR: no existe ${PUBLICADO}`);
    console.error('  Ejecuta primero:  npm run build\n');
    process.exit(1);
  }

  console.log(`  Origen : ${PUBLICADO}`);
  console.log(`  URL    : http://localhost:${PUERTO}/`);
  console.log('\n  Ctrl+C para detener.\n');
});
