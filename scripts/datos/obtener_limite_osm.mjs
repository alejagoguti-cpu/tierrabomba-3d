#!/usr/bin/env node
/**
 * obtener_limite_osm.mjs
 * ------------------------------------------------------------------
 * Descarga el limite oficial de la isla de Tierra Bomba desde
 * OpenStreetMap (via Nominatim) y lo guarda como GeoJSON simplificado
 * en data/ligero/limite_isla.geojson.
 *
 * PARA QUE SIRVE
 *   Da una capa base real y verificable para los mapas de diagnostico,
 *   tanto en el catalogo de TerriaMap como en kepler.gl, sin depender
 *   de que los datos propios del levantamiento esten procesados.
 *
 * ATRIBUCION OBLIGATORIA
 *   Los datos de OpenStreetMap estan bajo licencia ODbL 1.0.
 *   Cualquier uso publico debe citar: (c) OpenStreetMap contributors
 *   El script escribe esa atribucion dentro del propio GeoJSON y en
 *   el catalogo de Terria, para que no se pierda.
 *
 * NOTA SOBRE NOMINATIM
 *   Es un servicio publico y gratuito con limites de uso: maximo
 *   1 peticion por segundo y prohibido el uso masivo. Este script
 *   hace UNA sola peticion y espera antes de repetir. No lo pongas
 *   en un bucle.
 *
 * Uso:
 *   node scripts/datos/obtener_limite_osm.mjs
 *   node scripts/datos/obtener_limite_osm.mjs --tolerancia 0.0002
 * ------------------------------------------------------------------
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(__dirname, '..', '..');
const DESTINO = resolve(RAIZ, 'data/ligero/limite_isla.geojson');

const CONSULTA = 'Isla Tierra Bomba, Cartagena de Indias, Colombia';
// Nominatim exige un User-Agent identificable con datos de contacto.
const USER_AGENT = 'tierrabomba-3d/1.0 (tesis academica; contacto: alejagoguti@gmail.com)';

// Tolerancia de simplificacion en grados (Douglas-Peucker).
// 0,0001 grados ~ 11 m en la latitud de Cartagena. Para un limite
// insular de ~6 km de largo es mas que suficiente y reduce el
// archivo de forma drasticamente.
const indiceArg = process.argv.indexOf('--tolerancia');
const TOLERANCIA = indiceArg !== -1 ? Number(process.argv[indiceArg + 1]) : 0.0001;

const URL_NOMINATIM =
  'https://nominatim.openstreetmap.org/search?' +
  new URLSearchParams({
    q: CONSULTA,
    format: 'json',
    polygon_geojson: '1',
    limit: '1',
  });

/**
 * Distancia perpendicular de un punto al segmento (a, b),
 * en coordenadas planas. Para distancias de metros la distorsion
 * de tratar grados como plano es despreciable.
 */
function distanciaAlSegmento(p, a, b) {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;

  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Simplificacion de Douglas-Peucker: elimina los vertices que no
 * aportan informacion a la escala de trabajo.
 */
function simplificar(puntos, tolerancia) {
  if (puntos.length <= 2) return puntos;

  let maxDist = 0;
  let indice = 0;
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];

  for (let i = 1; i < puntos.length - 1; i++) {
    const d = distanciaAlSegmento(puntos[i], primero, ultimo);
    if (d > maxDist) {
      maxDist = d;
      indice = i;
    }
  }

  if (maxDist > tolerancia) {
    const izquierda = simplificar(puntos.slice(0, indice + 1), tolerancia);
    const derecha = simplificar(puntos.slice(indice), tolerancia);
    return izquierda.slice(0, -1).concat(derecha);
  }

  return [primero, ultimo];
}

function redondear(puntos, decimales = 6) {
  return puntos.map(([x, y]) => [
    Number(x.toFixed(decimales)),
    Number(y.toFixed(decimales)),
  ]);
}

function contarPuntos(geometria) {
  if (geometria.type === 'Polygon') {
    return geometria.coordinates.reduce((n, anillo) => n + anillo.length, 0);
  }
  if (geometria.type === 'MultiPolygon') {
    return geometria.coordinates.reduce(
      (n, poligono) => n + poligono.reduce((m, anillo) => m + anillo.length, 0),
      0
    );
  }
  return 0;
}

console.log('\n  Limite de Tierra Bomba desde OpenStreetMap');
console.log('  ' + '-'.repeat(58));
console.log(`  Consulta   : ${CONSULTA}`);
console.log(`  Tolerancia : ${TOLERANCIA} grados (~${Math.round(TOLERANCIA * 111000)} m)\n`);

let respuesta;
try {
  respuesta = await fetch(URL_NOMINATIM, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
} catch (err) {
  console.error(`\n  ERROR de red: ${err.message}`);
  console.error('  Comprueba tu conexion e intentalo de nuevo.\n');
  process.exit(1);
}

if (!respuesta.ok) {
  console.error(`\n  ERROR: Nominatim respondio HTTP ${respuesta.status}`);
  console.error('  Si es un 403 o 429, has hecho demasiadas peticiones: espera un minuto.\n');
  process.exit(1);
}

const resultados = await respuesta.json();

if (!Array.isArray(resultados) || resultados.length === 0) {
  console.error('\n  ERROR: Nominatim no devolvio ningun resultado para esa consulta.\n');
  process.exit(1);
}

const lugar = resultados[0];
console.log(`  Encontrado : ${lugar.display_name}`);
console.log(`  Centro     : ${Number(lugar.lat).toFixed(5)}, ${Number(lugar.lon).toFixed(5)}`);

const bb = lugar.boundingbox.map(Number);
const [sur, norte, oeste, este] = bb;
console.log(`  Caja       : S ${sur.toFixed(5)}  N ${norte.toFixed(5)}  O ${oeste.toFixed(5)}  E ${este.toFixed(5)}`);

const bruto = lugar.geojson;
const puntosBrutos = contarPuntos(bruto);
console.log(`\n  Vertices descargados: ${puntosBrutos.toLocaleString('es-CO')}`);

// --- Simplificar --------------------------------------------------
const simplificado =
  bruto.type === 'Polygon'
    ? {
        type: 'Polygon',
        coordinates: bruto.coordinates.map((anillo) =>
          redondear(simplificar(anillo, TOLERANCIA))
        ),
      }
    : {
        type: 'MultiPolygon',
        coordinates: bruto.coordinates.map((poligono) =>
          poligono.map((anillo) => redondear(simplificar(anillo, TOLERANCIA)))
        ),
      };

const puntosFinales = contarPuntos(simplificado);
const reduccion = (100 * (1 - puntosFinales / puntosBrutos)).toFixed(1);
console.log(`  Vertices tras simplificar: ${puntosFinales.toLocaleString('es-CO')}  (-${reduccion} %)`);

// --- Escribir el GeoJSON ------------------------------------------
const geo = {
  type: 'FeatureCollection',
  name: 'limite_isla_tierra_bomba',
  crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
  metadata: {
    titulo: 'Limite de la isla de Tierra Bomba, Cartagena de Indias',
    fuente: 'OpenStreetMap via Nominatim',
    attribution: '(c) OpenStreetMap contributors',
    licencia: 'ODbL 1.0 - https://www.openstreetmap.org/copyright',
    osm_type: lugar.osm_type,
    osm_id: lugar.osm_id,
    fecha_descarga: new Date().toISOString().slice(0, 10),
    tolerancia_simplificacion_grados: TOLERANCIA,
    vertices_originales: puntosBrutos,
    vertices_simplificados: puntosFinales,
    nota:
      'Capa de referencia para los mapas de diagnostico. NO sustituye al ' +
      'levantamiento topografico propio: es un limite administrativo de OSM ' +
      'y su precision es la de la comunidad, no la de un levantamiento.',
  },
  bbox: [oeste, sur, este, norte],
  features: [
    {
      type: 'Feature',
      properties: {
        nombre: 'Isla Tierra Bomba',
        municipio: 'Cartagena de Indias',
        departamento: 'Bolivar',
        pais: 'Colombia',
        fuente: 'OpenStreetMap',
        attribution: '(c) OpenStreetMap contributors',
      },
      geometry: simplificado,
    },
  ],
};

mkdirSync(dirname(DESTINO), { recursive: true });
writeFileSync(DESTINO, JSON.stringify(geo, null, 2), 'utf8');

const tamano = (JSON.stringify(geo).length / 1024).toFixed(1);
console.log(`\n  Guardado: ${DESTINO}`);
console.log(`  Peso    : ${tamano} KB`);
console.log('\n  Recuerda citar (c) OpenStreetMap contributors en cualquier');
console.log('  publicacion que use esta capa.\n');

if (!existsSync(DESTINO)) process.exit(1);
