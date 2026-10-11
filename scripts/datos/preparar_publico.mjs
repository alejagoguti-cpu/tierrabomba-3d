#!/usr/bin/env node
/**
 * preparar_publico.mjs
 * ------------------------------------------------------------------
 * Copia los datos geoespaciales y los modelos 3D a public/ para que
 * Next.js los sirva como archivos estaticos.
 *
 * POR QUE HACE FALTA
 *   Next.js solo sirve por HTTP lo que esta dentro de public/. Los
 *   datos viven en data/ (versionados en Git con su historial) y los
 *   modelos en assets/. Este script los publica sin duplicarlos en el
 *   repositorio: public/datos y public/modelos estan en .gitignore.
 *
 * CUANDO SE EJECUTA
 *   Automaticamente antes de `npm run dev` y `npm run build`
 *   (scripts predev y prebuild de package.json).
 *
 * QUE COPIA
 *   data/osm/*.geojson        -> public/datos/osm/
 *   data/ligero/*.geojson     -> public/datos/ligero/
 *   data/osm/manifiesto.json  -> public/datos/
 *   assets/modelos/*.glb      -> public/modelos/
 *
 * Uso manual:
 *   node scripts/datos/preparar_publico.mjs
 * ------------------------------------------------------------------
 */

import {
  cpSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
  rmSync,
} from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(__dirname, '..', '..');
const PUBLICO = resolve(RAIZ, 'public');

const log = (m) => console.log(`  ${m}`);
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const peso = (n) => (n > 1024 * 1024 ? mb(n) : kb(n));

function pesoCarpeta(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    total += e.isDirectory() ? pesoCarpeta(p) : statSync(p).size;
  }
  return total;
}

console.log('\n  Preparando archivos publicos');
console.log('  ' + '-'.repeat(58));

// Limpiar para no dejar archivos obsoletos de ejecuciones anteriores
for (const d of ['datos', 'modelos']) {
  rmSync(join(PUBLICO, d), { recursive: true, force: true });
}
mkdirSync(PUBLICO, { recursive: true });

// ------------------------------------------------------------------
//  1. Datos geoespaciales
// ------------------------------------------------------------------
const destinos = [
  { origen: resolve(RAIZ, 'data/osm'), destino: join(PUBLICO, 'datos/osm'), etiqueta: 'OpenStreetMap' },
  { origen: resolve(RAIZ, 'data/oficial'), destino: join(PUBLICO, 'datos/oficial'), etiqueta: 'catastro oficial' },
  { origen: resolve(RAIZ, 'data/ligero'), destino: join(PUBLICO, 'datos/ligero'), etiqueta: 'capas propias' },
];

let totalDatos = 0;
let archivosDatos = 0;

for (const { origen, destino, etiqueta } of destinos) {
  if (!existsSync(origen)) {
    log(`SIN DATOS: ${etiqueta} (${origen} no existe)`);
    continue;
  }

  // Se publican los GeoJSON y tambien el manifiesto de procedencia de
  // cada origen: es la prueba de trazabilidad que el usuario debe poder
  // descargar desde la pagina de datos.
  const archivos = readdirSync(origen).filter(
    (f) => f.endsWith('.geojson') || f === 'manifiesto.json'
  );

  if (!archivos.length) {
    log(`SIN DATOS: ${etiqueta} (no hay archivos)`);
    continue;
  }

  mkdirSync(destino, { recursive: true });
  for (const f of archivos) {
    cpSync(join(origen, f), join(destino, f));
  }

  const bytes = pesoCarpeta(destino);
  const capas = archivos.filter((f) => f.endsWith('.geojson')).length;
  totalDatos += bytes;
  archivosDatos += capas;
  log(`${etiqueta.padEnd(18)} ${String(capas).padStart(2)} capas  ${peso(bytes).padStart(9)}`);
}

// ------------------------------------------------------------------
//  2. web-ifc: el binario wasm del lector de IFC
//     El módulo BIM analiza los IFC en el navegador, así que el wasm
//     tiene que ser accesible por HTTP. Se copia desde node_modules y
//     no se versiona: es un artefacto de compilación.
// ------------------------------------------------------------------
const wasmOrigen = resolve(RAIZ, 'node_modules/web-ifc/web-ifc.wasm');
if (existsSync(wasmOrigen)) {
  mkdirSync(join(PUBLICO, 'ifc'), { recursive: true });
  cpSync(wasmOrigen, join(PUBLICO, 'ifc/web-ifc.wasm'));
  const kb = statSync(join(PUBLICO, 'ifc/web-ifc.wasm')).size / 1024;
  log(`web-ifc${' '.repeat(11)} wasm  ${kb.toFixed(0)} KB -> public/ifc/`);
} else {
  log('AVISO: no se encontro node_modules/web-ifc/web-ifc.wasm');
  log('       el modulo BIM no podra leer archivos IFC');
}

// ------------------------------------------------------------------
//  3. Modelos 3D
// ------------------------------------------------------------------
const modelosOrigen = resolve(RAIZ, 'assets/modelos');
let totalModelos = 0;

if (existsSync(modelosOrigen)) {
  const modelos = readdirSync(modelosOrigen).filter((f) => f.endsWith('.glb'));
  if (modelos.length) {
    mkdirSync(join(PUBLICO, 'modelos'), { recursive: true });
    for (const f of modelos) {
      cpSync(join(modelosOrigen, f), join(PUBLICO, 'modelos', f));
    }
    totalModelos = pesoCarpeta(join(PUBLICO, 'modelos'));
    log(`modelos 3D     ${String(modelos.length).padStart(2)} archivos  ${mb(totalModelos).padStart(9)}`);
  }
} else {
  log('SIN MODELOS: assets/modelos no existe');
}

// ------------------------------------------------------------------
//  Resumen
// ------------------------------------------------------------------
console.log('  ' + '-'.repeat(58));
log(`Total publicado: ${peso(totalDatos + totalModelos)}  (${archivosDatos} capas GeoJSON)`);

if (archivosDatos === 0) {
  console.log();
  log('ATENCION: no se publico ningun dato. El visor aparecera vacio.');
  log('Descarga los datos reales con:  npm run datos:osm && npm run datos:limite');
}

console.log();
