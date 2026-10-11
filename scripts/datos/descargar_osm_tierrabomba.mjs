#!/usr/bin/env node
/**
 * descargar_osm_tierrabomba.mjs
 * ------------------------------------------------------------------
 * Descarga datos territoriales REALES de la isla de Tierra Bomba
 * desde OpenStreetMap (Overpass API) y los convierte a GeoJSON
 * listo para consumir en la plataforma web.
 *
 * PRINCIPIO DE ESTE PROYECTO
 *   No se inventa ningun dato. Todo lo que sale de aqui es
 *   verificable en OpenStreetMap, lleva su atribucion ODbL y su
 *   fecha de descarga. Lo que no existe, no se genera.
 *
 * QUE DESCARGA
 *   edificaciones   building=*                          (~827)
 *   equipamientos   amenity/shop/leisure/healthcare/... (~16+)
 *   vias            highway=*                           (~304)
 *   usos_suelo      landuse=*
 *   natural         natural=*
 *   hidrografia     waterway=* / natural=water
 *
 * SALIDA
 *   data/osm/<capa>.geojson     Geometrias en WGS 84 (EPSG:4326)
 *   data/osm/manifiesto.json    Metadatos: fuente, fecha, licencia, conteos
 *
 * USO
 *   node scripts/datos/descargar_osm_tierrabomba.mjs
 *   node scripts/datos/descargar_osm_tierrabomba.mjs --solo edificaciones,vias
 *
 * NOTA TECNICA IMPORTANTE (por que se usa el patron recursivo)
 * ------------------------------------------------------------
 *   El patron moderno `out geom;` devuelve las coordenadas de los
 *   ways en la misma respuesta, pero varios espejos de Overpass
 *   fallan con el: kumi.systems responde HTTP 500 (error interno de
 *   Apache, no de sintaxis) y overpass-api.de devuelve 504.
 *
 *   Por eso se usa el patron clasico y universalmente soportado:
 *
 *       out body;     -> elementos con sus etiquetas y listas de nodos
 *       >>;           -> recursion completa hasta los nodos
 *       out skel qt;  -> los nodos con sus coordenadas
 *
 *   La geometria se reconstruye despues con un indice de nodos.
 *
 * NOTA SOBRE LOS SERVIDORES
 *   Overpass es un servicio publico y gratuito. Se prueban varios
 *   espejos en orden y se espera entre peticiones. No lo pongas en
 *   un bucle.
 * ------------------------------------------------------------------
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(__dirname, '..', '..');
const SALIDA = resolve(RAIZ, 'data/osm');

/** Relacion OSM de la isla de Tierra Bomba (verificada con Nominatim). */
const OSM_RELACION = 11226348;

const USER_AGENT = 'tierrabomba-3d/1.0 (tesis academica; alejagoguti@gmail.com)';

/**
 * Espejos de Overpass en orden de preferencia.
 * overpass-api.de va primero porque es el unico que responde bien al
 * patron recursivo con la relacion de esta isla.
 */
const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

/** Pausa entre peticiones para respetar el servicio publico (ms). */
const PAUSA = 4000;

/** Reintentos por capa antes de darse por vencido. */
const REINTENTOS = 2;

// ------------------------------------------------------------------
//  Definicion de capas
//
//  `consultas` es una lista de peticiones independientes a Overpass.
//  Cuando una capa necesita varias etiquetas, se reparten en peticiones
//  separadas y luego se fusionan: una sola peticion con seis filtros
//  hace que el servidor devuelva 504 (demasiado trabajo en una llamada).
// ------------------------------------------------------------------
const CAPAS = {
  edificaciones: {
    titulo: 'Edificaciones',
    descripcion: 'Volumetrias construidas registradas en OpenStreetMap.',
    consultas: [['nwr["building"](area.isla)']],
    categoria: 'construccion',
    color: '#D9C6A3',
  },
  equipamientos: {
    titulo: 'Equipamientos y servicios',
    descripcion:
      'Equipamientos comunitarios y servicios: educacion, salud, culto, ' +
      'deporte, comercio y servicios. Solo los documentados en OpenStreetMap.',
    // Una peticion por etiqueta: juntas superan el tiempo limite del servidor.
    consultas: [
      ['nwr["amenity"](area.isla)'],
      ['nwr["shop"](area.isla)'],
      ['nwr["leisure"](area.isla)'],
      ['nwr["healthcare"](area.isla)'],
      ['nwr["tourism"](area.isla)'],
      ['nwr["office"](area.isla)'],
    ],
    categoria: 'equipamientos',
    color: '#39B8B0',
  },
  vias: {
    titulo: 'Movilidad',
    descripcion: 'Vias, senderos, accesos y conexiones peatonales.',
    consultas: [['way["highway"](area.isla)']],
    categoria: 'movilidad',
    color: '#F6F4EF',
  },
  usos_suelo: {
    titulo: 'Usos del suelo',
    descripcion: 'Clasificacion del suelo segun OpenStreetMap.',
    consultas: [['nwr["landuse"](area.isla)']],
    categoria: 'territorio',
    color: '#527F68',
  },
  natural: {
    titulo: 'Elementos naturales',
    descripcion:
      'Vegetacion, playas, humedales y otros elementos naturales. Los ' +
      'manglares solo aparecen si estan documentados en OpenStreetMap.',
    consultas: [['nwr["natural"](area.isla)']],
    categoria: 'ambiente',
    color: '#527F68',
  },
  hidrografia: {
    titulo: 'Hidrografia',
    descripcion: 'Cursos de agua, canos y cuerpos de agua.',
    consultas: [['nwr["waterway"](area.isla)'], ['nwr["natural"="water"](area.isla)']],
    categoria: 'ambiente',
    color: '#102C3B',
  },
};

// ------------------------------------------------------------------
//  Utilidades
// ------------------------------------------------------------------
const log = (m) => console.log(`[tierrabomba-3d] ${m}`);
const esperar = (ms) => new Promise((s) => setTimeout(s, ms));

/**
 * Construye la consulta con el patron recursivo.
 * Devuelve elementos con etiquetas Y los nodos con coordenadas.
 */
function consultaOverpass(filtros) {
  const cuerpo = filtros.map((f) => `  ${f};`).join('\n');
  return `[out:json][timeout:180];
rel(${OSM_RELACION});
map_to_area->.isla;
(
${cuerpo}
);
out body;
>;
out skel qt;`;
}

async function pedirOverpass(q) {
  let ultimoError = null;

  for (const servidor of SERVIDORES) {
    const host = new URL(servidor).host;
    try {
      const t0 = Date.now();
      const r = await fetch(servidor, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(180000),
      });

      if (!r.ok) {
        ultimoError = `HTTP ${r.status}`;
        log(`      ${host}: ${ultimoError} (${((Date.now() - t0) / 1000).toFixed(1)}s) -> siguiente espejo`);
        continue;
      }

      const j = await r.json();
      log(`      ${host}: OK en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      return j;
    } catch (e) {
      ultimoError = e.name === 'TimeoutError' ? 'timeout' : e.message;
      log(`      ${host}: ${ultimoError} -> siguiente espejo`);
    }
  }

  throw new Error(`todos los espejos fallaron (ultimo: ${ultimoError})`);
}

/**
 * Descarga una capa completa ejecutando todas sus consultas y
 * fusionando los resultados.
 *
 * Se deduplica por `tipo/id` porque un mismo elemento puede aparecer
 * en varias consultas (por ejemplo, un edificio que tambien es
 * comercio). Los identificadores de OSM son globales, asi que
 * fusionar respuestas distintas es seguro.
 */
async function pedirElementosCapa(capa) {
  const vistos = new Map();
  const total = capa.consultas.length;

  for (let i = 0; i < total; i++) {
    if (total > 1) log(`      consulta ${i + 1}/${total}`);
    const datos = await pedirOverpass(consultaOverpass(capa.consultas[i]));
    for (const el of datos.elements ?? []) {
      vistos.set(`${el.type}/${el.id}`, el);
    }
    if (i < total - 1) await esperar(1500);
  }

  return [...vistos.values()];
}

/** Redondea a 6 decimales (~11 cm) para no inflar los archivos. */
const r6 = (n) => Math.round(n * 1e6) / 1e6;

const igualPunto = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

/**
 * Une secuencias de ids de nodo en anillos cerrados.
 * Es la unica forma de reconstruir el contorno de una relacion
 * multipolygon, cuyos bordes estan repartidos en varias vias.
 */
function unirAnillos(secuencias) {
  const pendientes = secuencias.filter((s) => s.length >= 2).map((s) => s.slice());
  const anillos = [];

  while (pendientes.length) {
    let actual = pendientes.shift();
    let unido = true;

    while (unido) {
      unido = false;
      const fin = actual[actual.length - 1];
      const inicio = actual[0];

      for (let i = 0; i < pendientes.length; i++) {
        const cand = pendientes[i];
        const cIni = cand[0];
        const cFin = cand[cand.length - 1];

        if (fin === cIni) actual = actual.concat(cand.slice(1));
        else if (fin === cFin) actual = actual.concat(cand.slice(0, -1).reverse());
        else if (inicio === cFin) actual = cand.slice(0, -1).concat(actual);
        else if (inicio === cIni) actual = cand.slice(1).reverse().concat(actual);
        else continue;

        pendientes.splice(i, 1);
        unido = true;
        break;
      }
    }

    if (actual.length >= 4) anillos.push(actual);
  }

  return anillos;
}

/**
 * Convierte la respuesta de Overpass a GeoJSON.
 *
 * Estrategia:
 *   1. Indexar todos los nodos con coordenadas.
 *   2. Indexar los ways por id (para las relaciones).
 *   3. Recorrer solo los elementos CON etiquetas: son las entidades
 *      reales; el resto son dependencias geometricas de la recursion.
 */
function aGeoJSON(elementos) {
  const coords = new Map();
  for (const el of elementos) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      coords.set(el.id, [r6(el.lon), r6(el.lat)]);
    }
  }

  const ways = new Map();
  for (const el of elementos) {
    if (el.type === 'way') ways.set(el.id, el);
  }

  /** Convierte ids de nodo a coordenadas, descartando los inexistentes. */
  const aPuntos = (ids) =>
    (ids ?? []).map((id) => coords.get(id)).filter((c) => c !== undefined);

  const features = [];
  const estadisticas = {
    puntos: 0,
    lineas: 0,
    poligonos: 0,
    relaciones: 0,
    sinGeometria: 0,
  };

  for (const el of elementos) {
    // La recursion devuelve nodos y ways sin etiquetas: son andamiaje.
    if (!el.tags || Object.keys(el.tags).length === 0) continue;

    const props = { ...el.tags, osm_tipo: el.type, osm_id: el.id };

    // --- Nodos con etiquetas: puntos ---------------------------
    if (el.type === 'node') {
      const c = coords.get(el.id);
      if (!c) {
        estadisticas.sinGeometria++;
        continue;
      }
      features.push({
        type: 'Feature',
        id: `node/${el.id}`,
        properties: props,
        geometry: { type: 'Point', coordinates: c },
      });
      estadisticas.puntos++;
      continue;
    }

    // --- Ways: linea o poligono --------------------------------
    if (el.type === 'way') {
      const pts = aPuntos(el.nodes);
      if (pts.length < 2) {
        estadisticas.sinGeometria++;
        continue;
      }

      // Una via es poligono si su primer y ultimo nodo coinciden.
      const cerrada =
        el.nodes.length >= 4 && el.nodes[0] === el.nodes[el.nodes.length - 1];

      if (cerrada) {
        features.push({
          type: 'Feature',
          id: `way/${el.id}`,
          properties: props,
          geometry: { type: 'Polygon', coordinates: [pts] },
        });
        estadisticas.poligonos++;
      } else {
        features.push({
          type: 'Feature',
          id: `way/${el.id}`,
          properties: props,
          geometry: { type: 'LineString', coordinates: pts },
        });
        estadisticas.lineas++;
      }
      continue;
    }

    // --- Relaciones: multipolygon ------------------------------
    if (el.type === 'relation') {
      const miembros = el.members ?? [];
      const tomar = (rol) =>
        miembros
          .filter((m) => m.role === rol && m.type === 'way' && ways.has(m.ref))
          .map((m) => ways.get(m.ref).nodes ?? []);

      const anillosExt = unirAnillos(tomar('outer'));
      const anillosInt = unirAnillos(tomar('inner'));

      const aCoords = (anillo) => anillo.map((id) => coords.get(id)).filter(Boolean);

      const exteriores = anillosExt.map(aCoords).filter((a) => a.length >= 4);
      const interiores = anillosInt.map(aCoords).filter((a) => a.length >= 4);

      if (!exteriores.length) {
        estadisticas.sinGeometria++;
        continue;
      }

      const coordinates = exteriores.map((a) => [a]);
      // Simplificacion declarada: los huecos se asignan al primer
      // anillo exterior en lugar de calcular su contencion exacta.
      for (const hueco of interiores) coordinates[0].push(hueco);

      features.push({
        type: 'Feature',
        id: `relation/${el.id}`,
        properties: props,
        geometry:
          coordinates.length === 1
            ? { type: 'Polygon', coordinates: coordinates[0] }
            : { type: 'MultiPolygon', coordinates },
      });
      estadisticas.relaciones++;
      estadisticas.poligonos++;
      continue;
    }

    estadisticas.sinGeometria++;
  }

  return { features, estadisticas };
}

// ------------------------------------------------------------------
//  Principal
// ------------------------------------------------------------------
const soloArg = process.argv.indexOf('--solo');
const seleccion =
  soloArg !== -1 && process.argv[soloArg + 1]
    ? process.argv[soloArg + 1].split(',').map((s) => s.trim())
    : Object.keys(CAPAS);

const invalidas = seleccion.filter((c) => !CAPAS[c]);
if (invalidas.length) {
  console.error(`\n  ERROR: capas desconocidas: ${invalidas.join(', ')}`);
  console.error(`  Disponibles: ${Object.keys(CAPAS).join(', ')}\n`);
  process.exit(1);
}

console.log('\n  Descarga de datos reales de Tierra Bomba');
console.log('  ' + '='.repeat(62));
console.log('  Fuente     : OpenStreetMap (Overpass API)');
console.log(`  Isla       : relation/${OSM_RELACION}`);
console.log(`  Capas      : ${seleccion.join(', ')}`);
console.log(`  Destino    : ${SALIDA}`);
console.log('  Patron     : out body; >; out skel qt;  (compatible con todos los espejos)\n');

const rutaManifiesto = join(SALIDA, 'manifiesto.json');
let manifiesto = { actualizado: null, fuente: 'OpenStreetMap', capas: {} };
if (existsSync(rutaManifiesto)) {
  try {
    manifiesto = JSON.parse(readFileSync(rutaManifiesto, 'utf8'));
  } catch {
    log('  AVISO: manifiesto previo ilegible; se regenera');
  }
}

mkdirSync(SALIDA, { recursive: true });

const hoy = new Date().toISOString().slice(0, 10);
const fallidas = [];

for (const nombre of seleccion) {
  const capa = CAPAS[nombre];
  log(`\n  ${capa.titulo}`);

  let elementos = null;
  for (let intento = 1; intento <= REINTENTOS && !elementos; intento++) {
    if (intento > 1) {
      log(`      reintento ${intento}/${REINTENTOS} tras esperar...`);
      await esperar(PAUSA * 2);
    }
    try {
      elementos = await pedirElementosCapa(capa);
    } catch (e) {
      log(`      ${e.message}`);
    }
  }

  if (!elementos) {
    log('    FALLIDA: se conserva el archivo anterior si existia');
    fallidas.push(nombre);
    await esperar(PAUSA);
    continue;
  }

  const { features, estadisticas } = aGeoJSON(elementos);

  if (!features.length) {
    log('    sin entidades con geometria utilizable: se omite');
    await esperar(PAUSA);
    continue;
  }

  const geojson = {
    type: 'FeatureCollection',
    name: nombre,
    metadata: {
      titulo: capa.titulo,
      descripcion: capa.descripcion,
      categoria: capa.categoria,
      color: capa.color,
      fuente: 'OpenStreetMap',
      fuente_url: 'https://www.openstreetmap.org/',
      attribution: '(c) OpenStreetMap contributors',
      licencia: 'ODbL 1.0',
      licencia_url: 'https://www.openstreetmap.org/copyright',
      metodo: 'Descarga directa via Overpass API (patron recursivo)',
      fecha_descarga: hoy,
      estado_validacion: 'colaborativo-verificado',
      osm_relacion_isla: OSM_RELACION,
      total_entidades: features.length,
      geometrias: estadisticas,
      limitaciones:
        'Datos generados por la comunidad OpenStreetMap. Su cobertura y ' +
        'precision son heterogeneas y no equivalen a un levantamiento ' +
        'oficial. Verificar antes de usos normativos.',
    },
    features,
  };

  const serializado = JSON.stringify(geojson);
  writeFileSync(join(SALIDA, `${nombre}.geojson`), serializado, 'utf8');

  const kb = serializado.length / 1024;
  log(`    ${features.length} entidades  ->  ${nombre}.geojson  (${kb.toFixed(0)} KB)`);
  log(
    `    puntos ${estadisticas.puntos} | lineas ${estadisticas.lineas} | ` +
      `poligonos ${estadisticas.poligonos} | sin geometria ${estadisticas.sinGeometria}`
  );

  manifiesto.capas[nombre] = {
    titulo: capa.titulo,
    descripcion: capa.descripcion,
    categoria: capa.categoria,
    color: capa.color,
    archivo: `data/osm/${nombre}.geojson`,
    entidades: features.length,
    geometrias: estadisticas,
    fecha_descarga: hoy,
    fuente: 'OpenStreetMap',
    attribution: '(c) OpenStreetMap contributors',
    licencia: 'ODbL 1.0',
    estado_validacion: 'colaborativo-verificado',
    peso_kb: Math.round(kb),
  };

  await esperar(PAUSA);
}

manifiesto.actualizado = hoy;
manifiesto.osm_relacion_isla = OSM_RELACION;
manifiesto.total_entidades = Object.values(manifiesto.capas).reduce(
  (n, c) => n + (c.entidades ?? 0),
  0
);
manifiesto.nota =
  'Manifiesto de procedencia. Generado automaticamente por ' +
  'scripts/datos/descargar_osm_tierrabomba.mjs. No editar a mano.';

writeFileSync(rutaManifiesto, JSON.stringify(manifiesto, null, 2), 'utf8');

console.log('\n  ' + '='.repeat(62));
log('Manifiesto: data/osm/manifiesto.json');
log(`Total de entidades reales: ${manifiesto.total_entidades.toLocaleString('es-CO')}`);

if (fallidas.length) {
  log(`CAPAS FALLIDAS: ${fallidas.join(', ')}`);
  log(`Vuelve a ejecutar solo esas:  --solo ${fallidas.join(',')}`);
}

console.log();
log('ATRIBUCION OBLIGATORIA en cualquier publicacion:');
log('  (c) OpenStreetMap contributors - ODbL 1.0');
console.log();
