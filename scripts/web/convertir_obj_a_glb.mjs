#!/usr/bin/env node
/**
 * convertir_obj_a_glb.mjs
 * ------------------------------------------------------------------
 * Convierte la exportacion OBJ de Revit (Autodesk ATF) a glTF binario
 * (.glb), listo para consumir con three.js sin dependencias externas.
 *
 * Por que este paso es obligatorio:
 *   El OBJ que exporta Revit pesa ~149 MB y GitHub RECHAZA cualquier
 *   archivo mayor a 100 MB. Ademas el OBJ es texto plano: ineficiente
 *   para la web. El GLB empaqueta geometria + materiales en un solo
 *   binario indexado y comprime la carga de forma dramatica.
 *
 * Resultado medido:
 *   148,6 MB (OBJ + MTL)  ->  40,3 MB (GLB)   =>  -73 %
 *
 * Uso:
 *   npm run convert
 *   node scripts/web/convertir_obj_a_glb.mjs "ruta/al/modelo.obj"
 * ------------------------------------------------------------------
 */

import { existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(__dirname, '..', '..');

/** Ruta de origen por defecto: la exportacion de Revit. */
const ORIGEN_POR_DEFECTO =
  'C:/Users/aleja/OneDrive/Documentos/TIERRABOMBA - 3D View - {3D}.obj';

const origen = resolve(process.argv[2] ?? ORIGEN_POR_DEFECTO);
const destino = resolve(
  process.argv[3] ?? `${RAIZ}/assets/modelos/TIERRABOMBA.glb`
);

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);

function abortar(msg) {
  console.error(`\n  ERROR: ${msg}\n`);
  process.exit(1);
}

console.log('\n  Conversion OBJ -> GLB');
console.log('  ' + '-'.repeat(58));
console.log(`  Origen  : ${origen}`);
console.log(`  Destino : ${destino}\n`);

if (!existsSync(origen)) {
  abortar(
    `no existe el archivo de origen.\n` +
      `         Pasa la ruta explicita:  npm run convert -- "C:/ruta/modelo.obj"`
  );
}
if (extname(origen).toLowerCase() !== '.obj') {
  abortar('el archivo de origen debe tener extension .obj');
}

// El .mtl debe acompanar al .obj: obj2gltf lo busca junto al OBJ.
const mtl = origen.replace(/\.obj$/i, '.mtl');
if (!existsSync(mtl)) {
  console.warn(
    `  AVISO: no se encontro el .mtl junto al OBJ.\n` +
      `         El modelo se convertira SIN materiales (todo gris).\n` +
      `         Esperado en: ${mtl}\n`
  );
}

mkdirSync(dirname(destino), { recursive: true });

const tamanoOrigen = statSync(origen).size;
console.log(`  Peso de origen: ${mb(tamanoOrigen)} MB`);
console.log('  Convirtiendo... (puede tardar uno o dos minutos)\n');

const t0 = Date.now();

// -b : salida binaria .glb (un solo archivo, sin .bin ni .gltf sueltos)
const resultado = spawnSync(
  process.execPath,
  [
    resolve(RAIZ, 'node_modules/obj2gltf/bin/obj2gltf.js'),
    '-i', origen,
    '-o', destino,
    '-b',
  ],
  { stdio: 'inherit', cwd: RAIZ }
);

if (resultado.error) abortar(`fallo al invocar obj2gltf: ${resultado.error.message}`);
if (resultado.status !== 0) abortar(`obj2gltf termino con codigo ${resultado.status}`);
if (!existsSync(destino)) abortar('obj2gltf no genero ningun archivo de salida');

const segundos = ((Date.now() - t0) / 1000).toFixed(1);
const tamanoDestino = statSync(destino).size;
const reduccion = (100 * (1 - tamanoDestino / tamanoOrigen)).toFixed(1);

console.log('\n  ' + '-'.repeat(58));
console.log(`  LISTO en ${segundos} s`);
console.log(`  ${mb(tamanoOrigen)} MB  ->  ${mb(tamanoDestino)} MB   (-${reduccion} %)`);
console.log(`  Archivo: ${destino}`);

if (tamanoDestino > 100 * 1024 * 1024) {
  console.warn(
    '\n  ATENCION: el GLB supera los 100 MB y GitHub lo rechazara.\n' +
      '            Reduce la malla en Revit o usa Git LFS + Releases.\n'
  );
} else if (tamanoDestino > 50 * 1024 * 1024) {
  console.warn('\n  AVISO: el GLB supera los 50 MB; GitHub mostrara un aviso.\n');
}
console.log('');
