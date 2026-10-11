#!/usr/bin/env node
/**
 * servir.mjs
 * ------------------------------------------------------------------
 * Servidor HTTP minimo para previsualizar el visor three.js en local.
 *
 * Es necesario un servidor (y no abrir el HTML con doble clic) porque
 * los navegadores bloquean la carga de assets por file:// mediante
 * CORS, y el GLB nunca se cargaria.
 *
 * Uso:
 *   npm run dev
 *   -> http://localhost:5180
 * ------------------------------------------------------------------
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(__dirname, '..', '..');
const PUERTO = Number(process.env.PORT ?? 5180);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.geojson': 'application/geo+json',
  '.csv': 'text/csv; charset=utf-8',
  '.qml': 'text/plain; charset=utf-8',
  '.rvt': 'application/octet-stream',
  '.gpkg': 'application/octet-stream',
};

const humano = (n) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;

const servidor = createServer(async (req, res) => {
  const t0 = Date.now();

  try {
    const url = new URL(req.url, `http://localhost:${PUERTO}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/scripts/web/viewer.html';

    // Defensa contra path traversal: normalizar y confirmar que el
    // destino siga dentro de la raiz del repositorio.
    const destino = normalize(join(RAIZ, rel));
    if (!destino.startsWith(RAIZ + sep)) {
      res.writeHead(403).end('403 Prohibido');
      console.log(`  403  ${rel}`);
      return;
    }

    const info = await stat(destino);
    if (info.isDirectory()) {
      res.writeHead(404).end('404 No encontrado');
      return;
    }

    const contenido = await readFile(destino);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(destino).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
    });
    res.end(contenido);

    console.log(
      `  200  ${humano(info.size).padStart(9)}  ${((Date.now() - t0) / 1000).toFixed(2)}s  ${rel}`
    );
  } catch (err) {
    const codigo = err.code === 'ENOENT' ? 404 : 500;
    res.writeHead(codigo).end(`${codigo} ${err.code ?? 'Error'}`);
    console.log(`  ${codigo}  ${req.url}`);
  }
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log('\n  Servidor local de tierrabomba-3d');
  console.log('  ' + '-'.repeat(58));
  console.log(`  Visor   : http://localhost:${PUERTO}/`);
  console.log(`  Ruta    : ${RAIZ}`);
  console.log('\n  Ctrl+C para detener.\n');
});
