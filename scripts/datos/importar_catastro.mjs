#!/usr/bin/env node
/**
 * importar_catastro.mjs
 * ==================================================================
 * Importa la cartografia catastral OFICIAL del Area Metropolitana de
 * Cartagena y extrae unicamente el ambito de la isla de Tierra Bomba.
 *
 * FUENTE
 *   Archivo: Cartografia_Catastro_AMB_Cartagena.zip (1,16 GB)
 *   Contenido: geodatabase ESRI + 14 shapefiles del catastro
 *   Entidad productora: catastro municipal / Area Metropolitana de
 *   Cartagena (los datos se autodenominan Catastro AMB Cartagena).
 *
 * DOS PROBLEMAS QUE RESUELVE ESTE SCRIPT
 * ------------------------------------------------------------------
 *   1. SISTEMA DE COORDENADAS
 *      Los shapefiles NO vienen en WGS 84 ni en UTM. Su .prj declara
 *      "MAGNA_SIRGAS_Origen_Nacional": proyeccion Transversa de
 *      Mercator con meridiano central -73, falso este 5.000.000 y
 *      falso norte 2.000.000, que corresponde a EPSG:9377.
 *
 *      Cargar esos datos sin reproyectar los situaria a cientos de
 *      kilometros de su posicion real. Aqui se convierten a WGS 84
 *      (EPSG:4326) con proj4, usando elipsoide GRS80.
 *
 *   2. TAMANO
 *      Los 14 shapefiles suman 701 MB y cubren todo el municipio de
 *      Cartagena. La isla de Tierra Bomba es una fraccion minima.
 *      Este script filtra por caja envolvente ANTES de reproyectar
 *      (en coordenadas nativas, que es mucho mas rapido) y descarta
 *      todo lo que no pertenece al area de estudio.
 *
 * LO QUE APORTA RESPECTO A OPENSTREETMAP
 *   El shapefile Construccion trae `altura_tot` (altura total) y
 *   `total_piso` (numero de pisos) para cada construccion. En
 *   OpenStreetMap solo 1 de las 827 edificaciones de la isla tenia
 *   altura registrada. Esto convierte las extrusiones aproximadas del
 *   visor en volumetrias con dato oficial.
 *
 * USO
 *   node scripts/datos/importar_catastro.mjs
 *   node scripts/datos/importar_catastro.mjs --zip "C:/ruta/otro.zip"
 *   node scripts/datos/importar_catastro.mjs --solo construccion,predios
 *
 * REQUISITOS
 *   npm install shapefile proj4   (ya declarados en package.json)
 * ==================================================================
 */

import shapefile from 'shapefile';
import proj4 from 'proj4';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(__dirname, '..', '..');
const SALIDA = resolve(RAIZ, 'data/oficial');

const RUTA_ZIP_POR_DEFECTO =
  'C:/Users/aleja/OneDrive/Imágenes/Cartografia_Catastro_AMB_Cartagena.zip';

/** Carpeta temporal de extraccion. Fuera de OneDrive a proposito. */
const CACHE = join(process.env.TEMP ?? '/tmp', 'catastro-amb');

// ------------------------------------------------------------------
//  PROYECCION
//  MAGNA-SIRGAS Origen Nacional (EPSG:9377), tal como lo declara el .prj
// ------------------------------------------------------------------
const CRS_ORIGEN =
  '+proj=tmerc +lat_0=4 +lon_0=-73 +k=0.9992 +x_0=5000000 +y_0=2000000 ' +
  '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';
const CRS_DESTINO = 'EPSG:4326';
const CRS_NOMBRE = 'MAGNA-SIRGAS Origen Nacional (EPSG:9377)';

/**
 * Ambito de trabajo: caja que contiene la isla de Tierra Bomba.
 * Es solo un PREFILTRO barato en coordenadas nativas; el recorte real
 * lo hace el poligono de la isla (ver `dentroDeLaIsla`).
 *
 * No ampliar esta caja sin revisar el resultado: el casco urbano de
 * Cartagena (Bocagrande, Centro, Manga) queda a menos de 5 km al norte
 * y una caja generosa lo arrastra consigo. La primera version de este
 * script uso 10.285–10.415 N y capturo 77.284 construcciones de toda la
 * ciudad en lugar de las de la isla.
 */
const AMBITOS = {
  municipal: {
    etiqueta: 'Municipio de Cartagena de Indias (completo)',
    caja: { oeste: -76.35, sur: 10.05, este: -75.35, norte: 10.75 },
    poligono: 'municipio',
    margen: 0,
  },
  isla: {
    etiqueta: 'Isla de Tierra Bomba',
    caja: { oeste: -75.605, sur: 10.31, este: -75.525, norte: 10.39 },
    poligono: 'isla',
    margen: 250,
  },
};

/** Ambito activo. Se sustituye al arrancar segun --ambito. */
let AMBITO = AMBITOS.isla.caja;

/** Margen alrededor del poligono de recorte, en metros. */
let MARGEN_ISLA_M = AMBITOS.isla.margen;

/** Radio de la Tierra para estimar distancias en la validacion. */
const MARGEN_M = 800;

/** Tolerancia por defecto cuando la capa no define la suya. */
const TOLERANCIA_SIMPLIFICACION = 0.00002;

/**
 * Poda de atributos y simplificación por capa.
 *
 * El catastro trae muchos campos de gestión interna que la plataforma
 * no usa. En capas de cientos de miles de elementos, cada campo de 30
 * caracteres cuesta varios megabytes: publicarlos todos hace que el
 * archivo no se pueda cargar en un navegador.
 *
 * `atributos: null` conserva todos los campos (capas pequeñas).
 * `tolerancia` en grados; 0,00005 ≈ 5,5 m.
 */
const AJUSTES_POR_CAPA = {
  // Tolerancia mayor en el ambito municipal: con 180.000 construcciones,
  // cada vertice cuenta. 0,0001 grados ~ 11 m sigue siendo suficiente
  // para leer la forma de una manzana a escala de ciudad.
  construccion: {
    atributos: ['codigo', 'altura_tot', 'total_piso', 'area_total', 'tipo_const'],
    tolerancia: 0.0001,
  },
  // CAPA DESCARTADA. Unidades de construccion: 368.589 elementos y
  // 137 MB. Es un desglose interior de cada construccion (plantas,
  // dominio) que se solapa con `construccion` y no aporta nada al
  // visor 3D ni al panel. A escala de isla si es manejable.
  predios: {
    atributos: ['codigo', 'Manzana', 'condicion'],
    tolerancia: 0.00008,
  },
  manzanas: { atributos: null, tolerancia: 0.00004 },
  barrios: { atributos: null, tolerancia: TOLERANCIA_SIMPLIFICACION },
  veredas: { atributos: null, tolerancia: TOLERANCIA_SIMPLIFICACION },
  'sectores-rurales': { atributos: null, tolerancia: TOLERANCIA_SIMPLIFICACION },
  vias: { atributos: null, tolerancia: 0.00001 },
};

/**
 * Capas que no se importan en el ambito municipal por tamano.
 * Se comprueba al arrancar y se avisa en lugar de generar un archivo
 * que ningun navegador podria cargar.
 */
const EXCLUIDAS_MUNICIPAL = new Set(['unidades-construccion']);

/** Decimales de las coordenadas publicadas. 5 ~ 1,1 m: sobra para catastro. */
const DECIMALES = 5;

// ------------------------------------------------------------------
//  POLIGONO DE RECORTE
//  Para la isla se usa el limite de OpenStreetMap (relation/11226348),
//  ya en WGS 84. Para el municipio completo se usa el propio shapefile
//  oficial Limitemunicipio, reproyectado.
// ------------------------------------------------------------------
function cargarPoligonoIsla() {
  const ruta = resolve(RAIZ, 'data/ligero/limite_isla.geojson');
  if (!existsSync(ruta)) return null;
  try {
    const gj = JSON.parse(readFileSync(ruta, 'utf8'));
    return gj.features?.[0]?.geometry ?? null;
  } catch {
    return null;
  }
}

/**
 * Lee Limitemunicipio.shp y devuelve el poligono de Cartagena en WGS 84.
 * Es el recorte correcto para el ambito municipal: mejor que una caja,
 * porque el termino municipal tiene una forma muy irregular (islas,
 * bahias y enclaves).
 */
async function cargarPoligonoMunicipio(carpetaShp) {
  const shp = join(carpetaShp, 'Limitemunicipio.shp');
  const dbf = join(carpetaShp, 'Limitemunicipio.dbf');
  if (!existsSync(shp)) return null;

  try {
    const fuente = await shapefile.open(shp, dbf, { encoding: 'utf-8' });
    const r = await fuente.read();
    if (r.done || !r.value?.geometry) return null;

    const geom = r.value.geometry;
    reproyectar(geom);

    const municipio = String(r.value.properties?.nombre_mun ?? '');
    log(`poligono municipal cargado: ${municipio || '(sin nombre)'}`);
    return geom;
  } catch (e) {
    log(`AVISO: no se pudo leer Limitemunicipio: ${e.message}`);
    return null;
  }
}

/** Algoritmo de lanzamiento de rayo: ¿el punto esta dentro del anillo? */
function puntoEnAnillo(p, anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const xi = anillo[i][0];
    const yi = anillo[i][1];
    const xj = anillo[j][0];
    const yj = anillo[j][1];

    if (
      yi > p[1] !== yj > p[1] &&
      p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    ) {
      dentro = !dentro;
    }
  }
  return dentro;
}

/** ¿El punto esta dentro del poligono, descontando sus huecos? */
function puntoEnPoligono(p, anillos) {
  if (!puntoEnAnillo(p, anillos[0])) return false;
  for (let i = 1; i < anillos.length; i++) {
    if (puntoEnAnillo(p, anillos[i])) return false;
  }
  return true;
}

function puntoEnGeometria(p, geom) {
  if (!geom) return false;
  if (geom.type === 'Polygon') return puntoEnPoligono(p, geom.coordinates);
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.some((anillos) => puntoEnPoligono(p, anillos));
  }
  return false;
}

/** Centro aproximado de una geometria (media de sus vertices). */
function centroDe(geom) {
  let sx = 0;
  let sy = 0;
  let n = 0;

  const recorrer = (c) => {
    if (typeof c[0] === 'number') {
      sx += c[0];
      sy += c[1];
      n++;
    } else {
      for (const sub of c) recorrer(sub);
    }
  };

  if (geom?.coordinates) recorrer(geom.coordinates);
  return n ? [sx / n, sy / n] : null;
}

/** Metros a grados en la latitud de Cartagena. */
function metrosAGrados(metros, lat) {
  const dLat = metros / 111320;
  const dLon = metros / (111320 * Math.cos((lat * Math.PI) / 180));
  return [dLon, dLat];
}

/**
 * ¿El elemento pertenece al ámbito de recorte?
 *
 * Se comprueba el centro y ocho puntos separados `MARGEN_ISLA_M` a su
 * alrededor. Así un predio costero cuyo centro cae en el mar pero que
 * toca el ámbito sigue contando: es un margen efectivo, no una simple
 * prueba de punto.
 *
 * Si no hay polígono de recorte se devuelve `true` (no se filtra): la
 * caja de prefiltro ya habrá hecho su trabajo.
 */
function dentroDelAmbito(geom, poligonoRecorte) {
  if (!poligonoRecorte) return true;

  const centro = centroDe(geom);
  if (!centro) return false;

  if (puntoEnGeometria(centro, poligonoRecorte)) return true;

  const [dLon, dLat] = metrosAGrados(MARGEN_ISLA_M, centro[1]);
  const radios = [
    [dLon, 0], [-dLon, 0], [0, dLat], [0, -dLat],
    [dLon, dLat], [dLon, -dLat], [-dLon, dLat], [-dLon, -dLat],
  ];

  return radios.some(([dx, dy]) =>
    puntoEnGeometria([centro[0] + dx, centro[1] + dy], poligonoRecorte)
  );
}

// ------------------------------------------------------------------
//  CAPAS A IMPORTAR
//  `archivo` es el nombre del shapefile; `campos` documenta los
//  atributos que interesan (el resto se conserva igualmente).
// ------------------------------------------------------------------
const CAPAS = {
  construccion: {
    archivo: 'Construccion',
    titulo: 'Construcciones (catastro oficial)',
    descripcion:
      'Huellas de construccion del catastro oficial, con numero de pisos, altura total y area construida registrados por la entidad catastral.',
    color: '#39B8B0',
    geometria: 'poligono',
    camposClave: ['altura_tot', 'total_piso', 'area_total', 'tipo_const'],
  },
  predios: {
    archivo: 'Terreno',
    titulo: 'Predios (catastro oficial)',
    descripcion:
      'Terrenos o lotes del catastro oficial, con su codigo catastral y la manzana a la que pertenecen.',
    color: '#D9C6A3',
    geometria: 'poligono',
    camposClave: ['codigo', 'Manzana', 'condicion'],
  },
  manzanas: {
    archivo: 'Manzana',
    titulo: 'Manzanas catastrales',
    descripcion: 'Division por manzanas del catastro oficial, con su codigo y nombre.',
    color: '#6B9A80',
    geometria: 'poligono',
    camposClave: ['codigo', 'nombre'],
  },
  barrios: {
    archivo: 'Barrio',
    titulo: 'Barrios',
    descripcion: 'Delimitacion de barrios segun el catastro oficial.',
    color: '#E4D7BD',
    geometria: 'poligono',
    camposClave: ['codigo', 'nombre'],
  },
  veredas: {
    archivo: 'Vereda',
    titulo: 'Veredas',
    descripcion: 'Delimitacion de veredas (division rural) segun el catastro oficial.',
    color: '#527F68',
    geometria: 'poligono',
    camposClave: ['codigo', 'nombre'],
  },
  'sectores-rurales': {
    archivo: 'Sectorrural',
    titulo: 'Sectores rurales',
    descripcion: 'Sectores rurales del catastro oficial.',
    color: '#3D6350',
    geometria: 'poligono',
    camposClave: ['codigo'],
  },
  vias: {
    archivo: 'Nomenclaturavial',
    titulo: 'Vías oficiales (nomenclatura vial)',
    descripcion:
      'Red vial oficial del catastro: cada tramo con su tipo de vía y su nombre. Es la cartografía de referencia para la movilidad, distinta de la de OpenStreetMap.',
    color: '#F6F4EF',
    geometria: 'linea',
    camposClave: ['tipo_via', 'numero_via'],
  },
  'unidades-construccion': {
    archivo: 'Unidad_construccion',
    titulo: 'Unidades de construccion',
    descripcion:
      'Unidades de construccion del catastro: tipo de planta, tipo de construccion y tipo de dominio.',
    color: '#5FCBC4',
    geometria: 'poligono',
    camposClave: ['tipo_plant', 'tipo_const', 'tipo_domin', 'etiqueta'],
  },
};

// ------------------------------------------------------------------
//  Utilidades
// ------------------------------------------------------------------
const log = (m) => console.log(`[catastro] ${m}`);
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/** Proyecta la caja WGS 84 al CRS nativo, con margen. */
function calcularCajaNativa() {
  const { oeste, sur, este, norte } = AMBITO;
  const puntos = [
    [oeste, sur], [este, sur], [este, norte], [oeste, norte],
    [(oeste + este) / 2, (sur + norte) / 2],
    [oeste, (sur + norte) / 2], [este, (sur + norte) / 2],
    [(oeste + este) / 2, sur], [(oeste + este) / 2, norte],
  ];

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of puntos) {
    const [x, y] = proj4(CRS_DESTINO, CRS_ORIGEN, p);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }

  return {
    minX: minX - MARGEN_M,
    maxX: maxX + MARGEN_M,
    minY: minY - MARGEN_M,
    maxY: maxY + MARGEN_M,
  };
}

/** Caja envolvente de una geometria GeoJSON, o null si esta vacia. */
function cajaDe(geometria) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  const recorrer = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[1] > maxY) maxY = c[1];
    } else {
      for (const sub of c) recorrer(sub);
    }
  };

  if (geometria?.coordinates) recorrer(geometria.coordinates);
  if (!Number.isFinite(minX)) return null;
  return { minX, maxX, minY, maxY };
}

/** ¿La caja de la geometria toca el ambito de trabajo? */
function intersecta(caja, nativa) {
  if (!caja) return false;
  return !(
    caja.maxX < nativa.minX ||
    caja.minX > nativa.maxX ||
    caja.maxY < nativa.minY ||
    caja.minY > nativa.maxY
  );
}

/** Reproyecta todas las coordenadas de una geometria, in situ. */
function reproyectar(geometria) {
  const factor = 10 ** DECIMALES;

  const transformar = (c) => {
    if (typeof c[0] === 'number') {
      const [lng, lat] = proj4(CRS_ORIGEN, CRS_DESTINO, [c[0], c[1]]);
      c[0] = Math.round(lng * factor) / factor;
      c[1] = Math.round(lat * factor) / factor;
      return c;
    }
    return c.map(transformar);
  };

  if (geometria?.coordinates) geometria.coordinates = transformar(geometria.coordinates);
  return geometria;
}

/**
 * Simplifica un anillo con Douglas-Peucker.
 *
 * Con 185.000 construcciones en el ambito municipal, cada vertice
 * cuenta: quitar los redundantes reduce el archivo a la mitad sin
 * que se note a escala urbana.
 */
function simplificarAnillo(anillo, tolerancia) {
  if (!Array.isArray(anillo) || anillo.length < 4) return anillo;

  const distancia = (p, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(
      0,
      Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))
    );
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };

  const dp = (puntos) => {
    if (puntos.length <= 2) return puntos;
    let maxD = 0;
    let idx = 0;
    const primero = puntos[0];
    const ultimo = puntos[puntos.length - 1];

    for (let i = 1; i < puntos.length - 1; i++) {
      const d = distancia(puntos[i], primero, ultimo);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }

    if (maxD > tolerancia) {
      const izq = dp(puntos.slice(0, idx + 1));
      const der = dp(puntos.slice(idx));
      return izq.slice(0, -1).concat(der);
    }
    return [primero, ultimo];
  };

  // Un anillo cerrado tiene el primer y el ultimo punto iguales: se
  // simplifica el interior y se vuelve a cerrar.
  const cerrado =
    anillo[0][0] === anillo[anillo.length - 1][0] &&
    anillo[0][1] === anillo[anillo.length - 1][1];

  const cuerpo = cerrado ? anillo.slice(0, -1) : anillo;
  const simplificado = dp(cuerpo);

  if (simplificado.length < 4) return anillo; // demasiado agresivo: se descarta
  return cerrado ? [...simplificado, simplificado[0]] : simplificado;
}

/** Aplica la simplificacion a todos los anillos de una geometria. */
function simplificar(geometria, tolerancia = TOLERANCIA_SIMPLIFICACION) {
  if (!geometria?.coordinates) return geometria;

  if (geometria.type === 'Polygon') {
    geometria.coordinates = geometria.coordinates.map((a) => simplificarAnillo(a, tolerancia));
  } else if (geometria.type === 'MultiPolygon') {
    geometria.coordinates = geometria.coordinates.map((poli) =>
      poli.map((a) => simplificarAnillo(a, tolerancia))
    );
  }
  return geometria;
}

/**
 * Limpia valores nulos o vacios de las propiedades.
 *
 * @param props      Propiedades originales del shapefile.
 * @param permitidos Lista blanca de campos. `null` conserva todos.
 *
 * Ademas convierte a numero los valores que lo son: en un archivo de
 * cientos de miles de elementos, quitar las comillas de un campo
 * numerico ahorra megabytes.
 */
function limpiarProps(props, permitidos = null) {
  const salida = {};
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === null || v === undefined || v === '') continue;
    const clave = String(k).trim();
    if (permitidos && !permitidos.includes(clave)) continue;

    if (typeof v === 'string') {
      const t = v.trim();
      if (!t) continue;
      // Numero puro: se guarda como numero
      if (/^-?\d+(\.\d+)?$/.test(t)) {
        const n = Number(t);
        salida[clave] = Number.isFinite(n) ? n : t;
      } else {
        salida[clave] = t;
      }
      continue;
    }
    salida[clave] = v;
  }
  return salida;
}

// ------------------------------------------------------------------
//  Extraccion del ZIP
// ------------------------------------------------------------------
async function asegurarShapefiles(rutaZip) {
  const carpetaShp = join(CACHE, 'SHP_Catastro_AMB_Cartagena');
  if (existsSync(carpetaShp)) {
    const shp = readdirSync(carpetaShp).filter((f) => f.endsWith('.shp'));
    if (shp.length) {
      log(`shapefiles ya extraidos (${shp.length} archivos) en ${carpetaShp}`);
      return carpetaShp;
    }
  }

  if (!existsSync(rutaZip)) {
    console.error(`\n  ERROR: no existe el archivo ZIP:\n  ${rutaZip}\n`);
    console.error('  Pasa la ruta correcta con:  --zip "C:/ruta/archivo.zip"\n');
    process.exit(1);
  }

  log(`extrayendo shapefiles de ${basename(rutaZip)} …`);
  log(`esto ocurre una sola vez; se guardan en ${CACHE}`);

  const { execFileSync } = await import('node:child_process');
  // Se usa PowerShell para extraer solo la carpeta SHP y evitar los
  // 3 GB de la geodatabase, que no se necesitan.
  const script = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead('${rutaZip.replace(/'/g, "''")}')
    foreach ($e in $zip.Entries) {
      if ($e.FullName -like 'SHP_Catastro_AMB_Cartagena/*' -and $e.Length -gt 0) {
        $destino = Join-Path '${CACHE.replace(/'/g, "''")}' $e.FullName
        New-Item -ItemType Directory -Force -Path (Split-Path $destino -Parent) | Out-Null
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $destino, $true)
      }
    }
    $zip.Dispose()
  `;

  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    stdio: 'inherit',
  });

  log('extraccion completada');
  return carpetaShp;
}

// ------------------------------------------------------------------
//  Importacion de una capa
// ------------------------------------------------------------------
async function importarCapa(clave, definicion, carpetaShp, cajaNativa, nombreZip, poligonoRecorte) {
  const shp = join(carpetaShp, `${definicion.archivo}.shp`);
  const dbf = join(carpetaShp, `${definicion.archivo}.dbf`);

  if (!existsSync(shp)) {
    log(`  ${clave}: no existe ${definicion.archivo}.shp`);
    return null;
  }

  const t0 = Date.now();
  const fuente = await shapefile.open(shp, dbf, { encoding: 'utf-8' });

  // Poda de atributos y tolerancia de simplificacion de esta capa
  const ajustes = AJUSTES_POR_CAPA[clave] ?? {
    atributos: null,
    tolerancia: TOLERANCIA_SIMPLIFICACION,
  };

  const features = [];
  let leidos = 0;
  let fueraDeCaja = 0;
  let fueraDeIsla = 0;

  while (true) {
    const r = await fuente.read();
    if (r.done) break;
    leidos++;

    const geom = r.value.geometry;
    if (!geom) continue;

    // 1) Prefiltro barato en coordenadas NATIVAS: descarta la mayor
    //    parte del municipio sin reproyectar vertice a vertice.
    const caja = cajaDe(geom);
    if (!intersecta(caja, cajaNativa)) {
      fueraDeCaja++;
      continue;
    }

    // 2) Recorte real contra el poligono de recorte. Hace falta
    //    reproyectar para poder comparar en WGS 84.
    reproyectar(geom);

    if (!dentroDelAmbito(geom, poligonoRecorte)) {
      fueraDeIsla++;
      continue;
    }

    // 3) Simplificacion: quita vertices redundantes. En el ambito
    //    municipal esto reduce el archivo a la mitad o mas.
    simplificar(geom, ajustes.tolerancia);

    features.push({
      type: 'Feature',
      // Identificador catastral si existe; si no, el indice de lectura
      id: r.value.properties?.codigo ?? `${clave}-${leidos}`,
      properties: limpiarProps(r.value.properties, ajustes.atributos),
      geometry: geom,
    });
  }

  const segundos = ((Date.now() - t0) / 1000).toFixed(1);
  const kb = Math.round(JSON.stringify(features).length / 1024);

  log(
    `  ${clave.padEnd(22)} ${String(features.length).padStart(6)} de ${String(leidos).padStart(7)} ` +
      `(${fueraDeCaja} fuera de caja, ${fueraDeIsla} fuera de la isla)  ${String(kb).padStart(7)} KB  ${segundos}s`
  );

  if (!features.length) return null;

  const geojson = {
    type: 'FeatureCollection',
    name: clave,
    metadata: {
      titulo: definicion.titulo,
      descripcion: definicion.descripcion,
      categoria: 'construccion',
      color: definicion.color,
      fuente: 'Catastro oficial - Area Metropolitana de Cartagena',
      fuente_archivo: nombreZip,
      fuente_capa: `${definicion.archivo}.shp`,
      attribution: 'Catastro municipal de Cartagena de Indias',
      licencia: 'Uso institucional - verificar condiciones con la entidad productora',
      crs_original: CRS_NOMBRE,
      crs_publicado: 'EPSG:4326 (WGS 84)',
      metodo: 'Importacion desde shapefile y reproyeccion con proj4',
      fecha_importacion: new Date().toISOString().slice(0, 10),
      estado_validacion: 'oficial',
      total_entidades: features.length,
      entidades_totales_en_origen: leidos,
      ambito: AMBITO,
      campos_clave: definicion.camposClave,
      limitaciones:
        'Subconjunto del catastro limitado al ambito de la isla de Tierra Bomba. ' +
        'Los valores de altura y numero de pisos son los registrados por la entidad ' +
        'catastral y pueden no reflejar el estado construido actual.',
    },
    features,
  };

  mkdirSync(SALIDA, { recursive: true });
  const destino = join(SALIDA, `${clave}.geojson`);
  writeFileSync(destino, JSON.stringify(geojson), 'utf8');

  return {
    clave,
    titulo: definicion.titulo,
    descripcion: definicion.descripcion,
    color: definicion.color,
    archivo: `data/oficial/${clave}.geojson`,
    entidades: features.length,
    entidades_en_origen: leidos,
    pesoKb: kb,
    fechaImportacion: geojson.metadata.fecha_importacion,
    estadoValidacion: 'oficial',
    camposClave: definicion.camposClave,
    fuenteCapa: `${definicion.archivo}.shp`,
  };
}

// ------------------------------------------------------------------
//  Principal
// ------------------------------------------------------------------
const argAmbito = process.argv.indexOf('--ambito');
const ambitoId = argAmbito !== -1 ? process.argv[argAmbito + 1] : 'municipal';

if (!AMBITOS[ambitoId]) {
  console.error(`\n  ERROR: ambito desconocido: ${ambitoId}`);
  console.error(`  Disponibles: ${Object.keys(AMBITOS).join(', ')}\n`);
  process.exit(1);
}

const ambito = AMBITOS[ambitoId];
AMBITO = ambito.caja;
MARGEN_ISLA_M = ambito.margen;

const argZip = process.argv.indexOf('--zip');
const rutaZip = argZip !== -1 ? process.argv[argZip + 1] : RUTA_ZIP_POR_DEFECTO;

const argSolo = process.argv.indexOf('--solo');
const seleccionBase =
  argSolo !== -1 && process.argv[argSolo + 1]
    ? process.argv[argSolo + 1].split(',').map((s) => s.trim())
    : Object.keys(CAPAS);

// Excluir las capas inviables en el ambito municipal (ver EXCLUIDAS_MUNICIPAL)
const seleccion = seleccionBase.filter((c) => {
  if (ambitoId === 'municipal' && EXCLUIDAS_MUNICIPAL.has(c) && argSolo === -1) {
    return false;
  }
  return true;
});

const excluidas = seleccionBase.filter((c) => !seleccion.includes(c));
if (excluidas.length) {
  console.log(
    `  AVISO: ${excluidas.join(', ')} no se importa en el ambito municipal ` +
      `(demasiado grande para un navegador).`
  );
}

const invalidas = seleccion.filter((c) => !CAPAS[c]);
if (invalidas.length) {
  console.error(`\n  ERROR: capas desconocidas: ${invalidas.join(', ')}`);
  console.error(`  Disponibles: ${Object.keys(CAPAS).join(', ')}\n`);
  process.exit(1);
}

console.log('\n  Importacion del catastro oficial de Cartagena');
console.log('  ' + '='.repeat(68));
console.log(`  Origen   : ${rutaZip}`);
console.log(`  CRS      : ${CRS_NOMBRE}  ->  WGS 84`);
console.log(`  Ambito   : ${ambito.etiqueta}`);
console.log(`  Capas    : ${seleccion.join(', ')}\n`);

const carpetaShp = await asegurarShapefiles(rutaZip);
const cajaNativa = calcularCajaNativa();

// Poligono de recorte: el municipio oficial o el limite insular
const poligonoRecorte =
  ambito.poligono === 'municipio'
    ? await cargarPoligonoMunicipio(carpetaShp)
    : cargarPoligonoIsla();

if (!poligonoRecorte) {
  log('AVISO: no se pudo cargar el poligono de recorte.');
  log('       Se filtrara solo por caja envolvente, lo que incluira');
  log('       elementos de fuera del ambito de estudio.');
}

log(
  `caja nativa calculada: X ${cajaNativa.minX.toFixed(0)}…${cajaNativa.maxX.toFixed(0)}  ` +
    `Y ${cajaNativa.minY.toFixed(0)}…${cajaNativa.maxY.toFixed(0)}`
);
log(`simplificacion: ${TOLERANCIA_SIMPLIFICACION} grados  |  precision: ${DECIMALES} decimales`);
console.log();

const manifiesto = {
  fuente: 'Catastro oficial - Area Metropolitana de Cartagena',
  archivoOrigen: basename(rutaZip),
  crsOriginal: CRS_NOMBRE,
  crsPublicado: 'EPSG:4326',
  ambito: ambito.etiqueta,
  ambitoId,
  cajaTrabajo: AMBITO,
  simplificacionGrados: TOLERANCIA_SIMPLIFICACION,
  precisionDecimales: DECIMALES,
  fechaImportacion: new Date().toISOString().slice(0, 10),
  capas: {},
};

for (const clave of seleccion) {
  try {
    const entrada = await importarCapa(
      clave,
      CAPAS[clave],
      carpetaShp,
      cajaNativa,
      basename(rutaZip),
      poligonoRecorte
    );
    if (entrada) manifiesto.capas[clave] = entrada;
  } catch (e) {
    log(`  ${clave}: ERROR ${e.message}`);
  }
}

manifiesto.totalEntidades = Object.values(manifiesto.capas).reduce(
  (n, c) => n + c.entidades,
  0
);
manifiesto.nota =
  'Manifiesto generado por scripts/datos/importar_catastro.mjs. ' +
  'Datos oficiales del catastro, recortados al ambito de Tierra Bomba y ' +
  'reproyectados a WGS 84. No editar a mano.';

mkdirSync(SALIDA, { recursive: true });
writeFileSync(join(SALIDA, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2), 'utf8');

console.log('\n  ' + '='.repeat(68));
log(`capas importadas: ${Object.keys(manifiesto.capas).length} de ${seleccion.length}`);
log(`entidades oficiales: ${manifiesto.totalEntidades.toLocaleString('es-CO')}`);
log(`manifiesto: data/oficial/manifiesto.json`);

const sinDatos = seleccion.filter((c) => !manifiesto.capas[c]);
if (sinDatos.length) {
  log(`SIN DATOS en el ambito de la isla: ${sinDatos.join(', ')}`);
  log('(la isla puede no estar cubierta por esa capa del catastro)');
}
console.log();
