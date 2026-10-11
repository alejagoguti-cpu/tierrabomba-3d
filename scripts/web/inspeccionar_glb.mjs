#!/usr/bin/env node
/**
 * inspeccionar_glb.mjs
 * ------------------------------------------------------------------
 * Lee la cabecera y el bloque JSON de un archivo .glb SIN cargarlo
 * entero en memoria, y reporta su contenido: mallas, materiales,
 * primitivas, accesos y extensiones glTF utilizadas.
 *
 * Sirve para verificar que una conversion salio bien sin necesidad
 * de abrir un visor 3D.
 *
 * Uso:
 *   npm run inspector
 *   node scripts/web/inspeccionar_glb.mjs "ruta/al/modelo.glb"
 * ------------------------------------------------------------------
 */

import { openSync, readSync, closeSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ruta = resolve(process.argv[2] ?? 'assets/modelos/TIERRABOMBA.glb');

if (!existsSync(ruta)) {
  console.error(`\n  ERROR: no existe el archivo ${ruta}\n`);
  process.exit(1);
}

const MAGIC_GLTF = 0x46546c67; // "glTF" en little-endian
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942;  // "BIN\0"

const fd = openSync(ruta, 'r');
const cabecera = Buffer.alloc(12);
readSync(fd, cabecera, 0, 12, 0);

const magic = cabecera.readUInt32LE(0);
const version = cabecera.readUInt32LE(4);
const longitud = cabecera.readUInt32LE(8);

const mb = (n) => (n / 1024 / 1024).toFixed(2);

console.log('\n  Inspector de GLB');
console.log('  ' + '-'.repeat(58));
console.log(`  Archivo   : ${ruta}`);
console.log(`  Peso real : ${mb(statSync(ruta).size)} MB`);
console.log(`  Longitud declarada en cabecera : ${mb(longitud)} MB`);

if (magic !== MAGIC_GLTF) {
  closeSync(fd);
  console.error(
    `\n  ERROR: el archivo no es un GLB valido (falta la firma "glTF").\n` +
      `         Primeros bytes: ${cabecera.toString('hex')}\n`
  );
  process.exit(1);
}
console.log(`  Firma     : glTF valida (version ${version})`);

// Recorrer los bloques hasta encontrar el JSON.
let offset = 12;
let json = null;
const bloques = [];

while (offset + 8 <= longitud) {
  const cabBloque = Buffer.alloc(8);
  readSync(fd, cabBloque, 0, 8, offset);
  const largo = cabBloque.readUInt32LE(0);
  const tipo = cabBloque.readUInt32LE(4);

  bloques.push({
    tipo,
    nombre: tipo === CHUNK_JSON ? 'JSON' : tipo === CHUNK_BIN ? 'BIN' : 'desconocido',
    bytes: largo,
  });

  if (tipo === CHUNK_JSON && json === null) {
    const datos = Buffer.alloc(largo);
    readSync(fd, datos, 0, largo, offset + 8);
    json = JSON.parse(datos.toString('utf8'));
  }
  offset += 8 + largo;
}
closeSync(fd);

console.log('\n  Bloques:');
for (const b of bloques) {
  console.log(`    - ${b.nombre.padEnd(12)} ${mb(b.bytes).padStart(9)} MB`);
}

if (!json) {
  console.error('\n  ERROR: no se encontro el bloque JSON dentro del GLB.\n');
  process.exit(1);
}

// ---------------------------------------------------------------
//  Resumen del contenido
// ---------------------------------------------------------------
const mallas = json.meshes ?? [];
const primitivas = mallas.reduce((n, m) => n + (m.primitives?.length ?? 0), 0);
const materiales = json.materials ?? [];
const nodos = json.nodes ?? [];
const accesos = json.accessors ?? [];
const extensiones = json.extensionsUsed ?? [];

console.log('\n  Contenido:');
console.log(`    Mallas         : ${mallas.length}`);
console.log(`    Primitivas     : ${primitivas}`);
console.log(`    Materiales     : ${materiales.length}`);
console.log(`    Nodos          : ${nodos.length}`);
console.log(`    Accesos (buffers de atributos): ${accesos.length}`);

// Total de vertices y triangulos declarados en los accesos POSITION / indices
let vertices = 0;
let triangulos = 0;
for (const malla of mallas) {
  for (const prim of malla.primitives ?? []) {
    const pos = prim.attributes?.POSITION;
    if (pos !== undefined && accesos[pos]) vertices += accesos[pos].count;
    if (prim.indices !== undefined && accesos[prim.indices]) {
      triangulos += Math.floor(accesos[prim.indices].count / 3);
    }
  }
}

console.log(`\n    Vertices       : ${vertices.toLocaleString('es-CO')}`);
console.log(`    Triangulos     : ${triangulos.toLocaleString('es-CO')}`);

if (materiales.length) {
  console.log('\n  Materiales (primeros 12):');
  for (const m of materiales.slice(0, 12)) {
    const c = m.pbrMetallicRoughness?.baseColorFactor;
    const color = c
      ? '#' + c.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
      : '(sin color)';
    console.log(`    - ${(m.name ?? '(sin nombre)').slice(0, 48).padEnd(50)} ${color}`);
  }
  if (materiales.length > 12) {
    console.log(`    ... y ${materiales.length - 12} mas`);
  }
}

console.log('\n  Extensiones usadas:');
if (extensiones.length === 0) {
  console.log('    (ninguna) -> compatible con cualquier visor glTF 2.0');
} else {
  for (const e of extensiones) console.log(`    - ${e}`);
}

console.log('\n  ' + '-'.repeat(58));
console.log('  El archivo es un GLB valido y legible.\n');
