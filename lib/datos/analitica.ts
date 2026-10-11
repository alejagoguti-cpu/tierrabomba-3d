/**
 * Analítica territorial calculada en tiempo de compilación.
 * ==================================================================
 * TODOS los indicadores de la plataforma se calculan aquí a partir de
 * los GeoJSON reales. No hay ninguna cifra escrita a mano.
 *
 * Cuando un indicador NO se puede calcular con los datos disponibles,
 * la función devuelve `null` y la interfaz muestra "Sin datos" con la
 * fuente que haría falta. Nunca se rellena con una estimación.
 *
 * Se ejecuta una sola vez, durante `npm run build`, así que el coste de
 * Turf (áreas y longitudes de miles de polígonos) no afecta al usuario.
 * ==================================================================
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { area as areaTurf } from '@turf/area';
import { length as longitudTurf } from '@turf/length';
import { featureCollection, lineString } from '@turf/helpers';
import { union as unir } from '@turf/union';
import { difference as diferencia } from '@turf/difference';

const RAIZ = process.cwd();

// ------------------------------------------------------------------
//  Lectura de capas
// ------------------------------------------------------------------
type Geometria = { type: string; coordinates: unknown };
interface Entidad {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: Geometria;
}
interface Coleccion {
  type: 'FeatureCollection';
  features: Entidad[];
  metadata?: Record<string, unknown>;
}

function leerCapa(ruta: string): Coleccion | null {
  const abs = resolve(RAIZ, ruta);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, 'utf8')) as Coleccion;
  } catch {
    return null;
  }
}

/** Superficie de una entidad en m². Devuelve 0 si la geometría no es polígono. */
function superficie(f: Entidad): number {
  const t = f.geometry?.type;
  if (t !== 'Polygon' && t !== 'MultiPolygon') return 0;
  try {
    return areaTurf(f as never);
  } catch {
    return 0;
  }
}

/** Suma de superficies de una colección, en m². */
function superficieTotal(c: Coleccion | null): number {
  if (!c) return 0;
  return c.features.reduce((n, f) => n + superficie(f), 0);
}

/** Perímetro de la isla en metros, sumando los anillos exteriores. */
function perimetroIsla(c: Coleccion | null): number | null {
  const g = c?.features?.[0]?.geometry;
  if (!g) return null;

  const anillos: number[][][] =
    g.type === 'Polygon'
      ? (g.coordinates as number[][][])
      : g.type === 'MultiPolygon'
        ? (g.coordinates as number[][][][]).flat()
        : [];

  let total = 0;
  for (const anillo of anillos) {
    if (anillo.length < 2) continue;
    try {
      total += longitudTurf(lineString(anillo), { units: 'kilometers' }) * 1000;
    } catch {
      // Anillo inválido: se ignora
    }
  }
  return total || null;
}

/**
 * Une un conjunto de polígonos en una sola geometría.
 *
 * POR QUÉ HACE FALTA
 *   Los polígonos de OpenStreetMap se solapan entre sí y entre capas.
 *   Sumar sus superficies por separado infla el resultado y produce
 *   porcentajes imposibles (el primer cálculo daba un 91,9 % de
 *   vegetación porque contaba varias veces las mismas hectáreas).
 *
 *   Unir en ÁRBOL reduce el número de operaciones costosas de O(n) a
 *   O(log n) niveles.
 */
function unirTodo(entidades: Entidad[]): Entidad | null {
  let nivel = entidades.filter(
    (f) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
  );
  if (!nivel.length) return null;
  // Un polígono sin área real (menos de 1 m²) solo añade coste
  nivel = nivel.filter((f) => {
    try {
      return areaTurf(f as never) > 1;
    } catch {
      return false;
    }
  });
  if (!nivel.length) return null;

  while (nivel.length > 1) {
    const siguiente: Entidad[] = [];
    for (let i = 0; i < nivel.length; i += 2) {
      if (i + 1 >= nivel.length) {
        siguiente.push(nivel[i]);
        continue;
      }
      try {
        // Turf exige un FeatureCollection, no un array suelto: pasarle
        // un array devuelve geometrias corruptas sin lanzar error.
        const r = unir(featureCollection([nivel[i], nivel[i + 1]] as never) as never);
        siguiente.push((r as Entidad) ?? nivel[i]);
      } catch {
        // Geometría problemática (habitual en datos de OSM): se conserva
        // la primera en lugar de abortar todo el cálculo.
        siguiente.push(nivel[i]);
      }
    }
    nivel = siguiente;
  }

  return nivel[0];
}

/** Resta una lista de geometrías a una base, en cadena. */
function restar(base: Entidad | null, restas: Array<Entidad | null>): Entidad | null {
  let actual = base;
  for (const r of restas) {
    if (!actual || !r) continue;
    try {
      const d = diferencia(featureCollection([actual, r] as never) as never);
      if (d) actual = d as Entidad;
    } catch {
      // Si la diferencia falla se conserva el estado anterior
    }
  }
  return actual;
}

/** Superficie en m² de una geometría suelta. */
function areaDe(g: Entidad | null): number {
  if (!g) return 0;
  try {
    return areaTurf(g as never);
  } catch {
    return 0;
  }
}

/** Selecciona entidades cuyas claves estén en un conjunto de valores. */
function porClaves(c: Coleccion | null, claves: string[], valores: Set<string>): Entidad[] {
  if (!c) return [];
  return c.features.filter((f) =>
    claves.some((k) => {
      const v = f.properties?.[k];
      return typeof v === 'string' && valores.has(v);
    })
  );
}

// ------------------------------------------------------------------
//  Indicadores
// ------------------------------------------------------------------
export interface Indicador {
  id: string;
  etiqueta: string;
  /** Valor ya formateado para mostrar. "Sin datos" si no es calculable. */
  valor: string;
  /** Descripción corta de qué mide. */
  nota: string;
  /** Fuente del dato. */
  fuente: string;
  /** false cuando el indicador no se puede calcular todavía. */
  disponible: boolean;
  /** Qué haría falta para calcularlo, si no está disponible. */
  requiere?: string;
}

export interface RepartoUsoSuelo {
  clave: string;
  m2: number;
  porcentaje: number;
  color: string;
}

export interface Analitica {
  indicadores: Indicador[];
  usoDelSuelo: RepartoUsoSuelo[];
  superficies: {
    islaM2: number | null;
    vegetacionM2: number;
    sueloConstruidoM2: number;
    aguaM2: number;
    /** Suma de las huellas de construcción del catastro, aparte. */
    huellaConstruidaCatastroM2: number;
  };
  estadisticasConstruccion: {
    total: number;
    conAltura: number;
    alturaMedia: number | null;
    alturaMaxima: number | null;
    pisosMediana: number | null;
    porcentajeUnaPlanta: number | null;
    areaConstruidaTotalM2: number;
    areaConstruidaMediaM2: number | null;
  } | null;
  densidad: {
    construccionesPorKm2: number | null;
    prediosPorKm2: number | null;
  };
}

/** Colores por categoría de uso del suelo, coherentes con la paleta. */
const COLORES_USO: Record<string, string> = {
  Construido: '#D9C6A3',
  Vegetación: '#527F68',
  'Suelo desnudo': '#B8A077',
  Infraestructura: '#6B7A83',
  'Cuerpos de agua': '#39B8B0',
  Humedal: '#6B9A80',
  Agricultura: '#8FA37E',
  Playas: '#E4D7BD',
  Otro: '#46545D',
};

/** Sinónimos de OSM y del catastro hacia las categorías de la leyenda. */
const AGRUPACION: Record<string, string> = {
  // usos del suelo
  grass: 'Vegetación',
  meadow: 'Vegetación',
  forest: 'Vegetación',
  scrub: 'Vegetación',
  orchard: 'Agricultura',
  farmland: 'Agricultura',
  farmyard: 'Agricultura',
  residential: 'Construido',
  commercial: 'Construido',
  industrial: 'Construido',
  construction: 'Construido',
  quarry: 'Suelo desnudo',
  landfill: 'Suelo desnudo',
  brownfield: 'Suelo desnudo',
  bare_rock: 'Suelo desnudo',
  sand: 'Playas',
  beach: 'Playas',
  wetland: 'Humedal',
  water: 'Cuerpos de agua',
  reservoir: 'Cuerpos de agua',
  bay: 'Cuerpos de agua',
  // elementos naturales
  wood: 'Vegetación',
  tree_row: 'Vegetación',
  tree: 'Vegetación',
  shrubbery: 'Vegetación',
  heath: 'Vegetación',
  mangrove: 'Vegetación',
  mud: 'Humedal',
  marsh: 'Humedal',
  coastline: 'Otro',
  cape: 'Otro',
  spring: 'Cuerpos de agua',
};

function agrupar(clave: string): string {
  return AGRUPACION[clave] ?? 'Otro';
}

/**
 * Resultado memoizado.
 *
 * El cálculo incluye uniones y diferencias de polígonos con Turf, que
 * tardan varios segundos. La página del panel y la de datos lo usan, y
 * ambas se generan en el mismo proceso de compilación: sin memoizar se
 * pagaría dos veces.
 */
let cache: Analitica | null = null;

export function calcularAnalitica(): Analitica {
  if (cache) return cache;
  cache = calcularAnaliticaSinCache();
  return cache;
}

function calcularAnaliticaSinCache(): Analitica {
  // --- Capas ------------------------------------------------------
  const isla = leerCapa('data/ligero/limite_isla.geojson');
  const usos = leerCapa('data/osm/usos_suelo.geojson');
  const natural = leerCapa('data/osm/natural.geojson');
  const hidro = leerCapa('data/osm/hidrografia.geojson');
  const edificaciones = leerCapa('data/osm/edificaciones.geojson');
  const construccion = leerCapa('data/oficial/construccion.geojson');
  const predios = leerCapa('data/oficial/predios.geojson');
  const manzanas = leerCapa('data/oficial/manzanas.geojson');
  const vias = leerCapa('data/osm/vias.geojson');
  const equipamientos = leerCapa('data/osm/equipamientos.geojson');

  // --- Superficie y perímetro de la isla --------------------------
  const islaM2 = superficieTotal(isla);
  const islaKm2 = islaM2 > 0 ? islaM2 / 1e6 : null;
  const perimetroM = perimetroIsla(isla);
  const perimetroKm = perimetroM !== null ? perimetroM / 1000 : null;

  // --- Cobertura del suelo ----------------------------------------
  // Clasificación POR PRIORIDAD: cada categoría se resta de las
  // inferiores para que ninguna hectárea se cuente dos veces.
  //
  // Hace falta porque los polígonos de OSM se solapan: el matorral
  // (`natural=scrub`) cubre casi toda la isla y engloba dentro los
  // asentamientos. Sin restar, la vegetación salía al 91,9 % del total
  // cartografiado, que es un artefacto de doble conteo.
  const VEG = new Set([
    'scrub', 'heath', 'wood', 'grass', 'meadow', 'forest', 'tree', 'tree_row',
    'shrubbery', 'orchard', 'farmland', 'mangrove', 'grassland', 'vineyard',
  ]);
  const CONSTRUIDO = new Set([
    'residential', 'commercial', 'industrial', 'construction', 'retail', 'quarry',
    'railway', 'landfill', 'brownfield',
  ]);
  const AGUA = new Set(['water', 'reservoir', 'basin', 'spring', 'river', 'stream', 'canal', 'ditch']);
  const PLAYA = new Set(['beach', 'sand']);
  const HUMEDAL = new Set(['wetland', 'mud', 'marsh', 'swamp']);

  const gAgua = unirTodo([
    ...porClaves(hidro, ['natural', 'waterway'], AGUA),
    ...porClaves(natural, ['natural'], AGUA),
  ]);

  // NOTA IMPORTANTE: las 2.714 huellas del catastro NO entran en las
  // operaciones booleanas. Unirlas produce un MultiPolygon de miles de
  // partes con el que `difference` falla y devuelve una geometría
  // prácticamente vacía (se comprobó: la vegetación caía al 0,2 %).
  // Se calculan por separado, sumando sus superficies, y se informa de
  // ellas como huella construida.
  const gConstruido = unirTodo(porClaves(usos, ['landuse'], CONSTRUIDO));

  const gPlaya = unirTodo(porClaves(natural, ['natural'], PLAYA));
  const gHumedal = unirTodo([
    ...porClaves(natural, ['natural'], HUMEDAL),
    ...porClaves(usos, ['landuse'], HUMEDAL),
  ]);
  const gVegetacionBruta = unirTodo([
    ...porClaves(natural, ['natural'], VEG),
    ...porClaves(usos, ['landuse'], VEG),
  ]);

  // La vegetación es la categoría más extensa y la más gruesa: se le
  // restan las demás para obtener la superficie realmente vegetal.
  const gVegetacion = restar(gVegetacionBruta, [gConstruido, gAgua, gPlaya, gHumedal]);

  const vegetacionM2 = areaDe(gVegetacion);
  const sueloConstruidoM2 = areaDe(gConstruido);
  const aguaM2 = areaDe(gAgua);
  const playaM2 = areaDe(gPlaya);
  const humedalM2 = areaDe(gHumedal);

  // Huella construida del catastro, sumada aparte (ver nota arriba).
  const huellaCatastroM2 = (construccion?.features ?? []).reduce(
    (n, f) => n + superficie(f),
    0
  );

  const totalCartografiado = vegetacionM2 + sueloConstruidoM2 + aguaM2 + playaM2 + humedalM2;

  // El resto de la isla no está clasificado en OpenStreetMap. Se
  // declara como tal en lugar de repartirlo entre las demás categorías.
  const sinClasificar = islaM2 > 0 ? Math.max(0, islaM2 - totalCartografiado) : 0;
  const base = islaM2 > 0 ? islaM2 : totalCartografiado;

  const usoDelSuelo: RepartoUsoSuelo[] = [
    { clave: 'Vegetación', m2: vegetacionM2, color: COLORES_USO['Vegetación'] },
    { clave: 'Construido', m2: sueloConstruidoM2, color: COLORES_USO['Construido'] },
    { clave: 'Sin clasificar', m2: sinClasificar, color: '#2D3A42' },
    { clave: 'Cuerpos de agua', m2: aguaM2, color: COLORES_USO['Cuerpos de agua'] },
    { clave: 'Playas', m2: playaM2, color: COLORES_USO['Playas'] },
    { clave: 'Humedal', m2: humedalM2, color: COLORES_USO['Humedal'] },
  ]
    .filter((u) => u.m2 > 0)
    .map((u) => ({ ...u, porcentaje: base > 0 ? (100 * u.m2) / base : 0 }))
    .sort((a, b) => b.m2 - a.m2);

  // --- Estadísticas del catastro ----------------------------------
  let estadisticasConstruccion: Analitica['estadisticasConstruccion'] = null;

  if (construccion && construccion.features.length) {
    const alturas: number[] = [];
    const pisos: number[] = [];
    let areaTotal = 0;

    for (const f of construccion.features) {
      const a = Number(f.properties?.altura_tot);
      if (Number.isFinite(a) && a > 0) alturas.push(a);

      const p = Number(f.properties?.total_piso);
      if (Number.isFinite(p) && p > 0) pisos.push(p);

      const ar = Number(f.properties?.area_total);
      if (Number.isFinite(ar) && ar > 0) areaTotal += ar;
    }

    const media = alturas.length ? alturas.reduce((a, b) => a + b, 0) / alturas.length : null;
    const pisosOrdenados = [...pisos].sort((a, b) => a - b);
    const mediana = pisosOrdenados.length
      ? pisosOrdenados[Math.floor(pisosOrdenados.length / 2)]
      : null;

    estadisticasConstruccion = {
      total: construccion.features.length,
      conAltura: alturas.length,
      alturaMedia: media,
      alturaMaxima: alturas.length ? Math.max(...alturas) : null,
      pisosMediana: mediana,
      porcentajeUnaPlanta: pisos.length
        ? (100 * pisos.filter((p) => p === 1).length) / pisos.length
        : null,
      areaConstruidaTotalM2: areaTotal,
      areaConstruidaMediaM2:
        construccion.features.length > 0 ? areaTotal / construccion.features.length : null,
    };
  }

  // --- Densidad ---------------------------------------------------
  const construccionesPorKm2 =
    islaKm2 && construccion ? construccion.features.length / islaKm2 : null;
  const prediosPorKm2 = islaKm2 && predios ? predios.features.length / islaKm2 : null;

  // --- Indicadores ------------------------------------------------
  const nf = (n: number, d = 0) => n.toLocaleString('es-CO', { maximumFractionDigits: d });

  const indicadores: Indicador[] = [
    {
      id: 'area',
      etiqueta: 'Superficie de la isla',
      valor: islaKm2 !== null ? `${nf(islaKm2, 2)} km²` : 'Sin datos',
      nota: 'Área del polígono del límite insular',
      fuente: 'OpenStreetMap · relation/11226348',
      disponible: islaKm2 !== null,
    },
    {
      id: 'costa',
      etiqueta: 'Línea de costa',
      valor: perimetroKm !== null ? `${nf(perimetroKm, 2)} km` : 'Sin datos',
      nota: 'Perímetro del contorno insular',
      fuente: 'OpenStreetMap · cálculo con Turf.js',
      disponible: perimetroKm !== null,
    },
    {
      id: 'construcciones',
      etiqueta: 'Construcciones',
      valor: construccion ? nf(construccion.features.length) : 'Sin datos',
      nota: 'Huellas de construcción del catastro oficial',
      fuente: 'Catastro AMB Cartagena',
      disponible: !!construccion,
    },
    {
      id: 'predios',
      etiqueta: 'Predios',
      valor: predios ? nf(predios.features.length) : 'Sin datos',
      nota: 'Lotes catastrales en el ámbito de la isla',
      fuente: 'Catastro AMB Cartagena',
      disponible: !!predios,
    },
    {
      id: 'altura-media',
      etiqueta: 'Altura media construida',
      valor: estadisticasConstruccion?.alturaMedia
        ? `${nf(estadisticasConstruccion.alturaMedia, 2)} m`
        : 'Sin datos',
      nota: estadisticasConstruccion
        ? `Registrada para ${nf(estadisticasConstruccion.conAltura)} de ${nf(estadisticasConstruccion.total)} construcciones`
        : 'Sin registros de altura',
      fuente: 'Catastro AMB Cartagena · altura_tot',
      disponible: !!estadisticasConstruccion?.alturaMedia,
    },
    {
      id: 'una-planta',
      etiqueta: 'Construcciones de una planta',
      valor: estadisticasConstruccion?.porcentajeUnaPlanta !== null
        ? `${nf(estadisticasConstruccion?.porcentajeUnaPlanta ?? 0, 1)} %`
        : 'Sin datos',
      nota: 'Proporción del total construido',
      fuente: 'Catastro AMB Cartagena · total_piso',
      disponible: estadisticasConstruccion?.porcentajeUnaPlanta != null,
    },
    {
      id: 'densidad',
      etiqueta: 'Densidad construida',
      valor: construccionesPorKm2 ? `${nf(construccionesPorKm2, 1)} /km²` : 'Sin datos',
      nota: 'Construcciones por kilómetro cuadrado',
      fuente: 'Catastro + OpenStreetMap',
      disponible: !!construccionesPorKm2,
    },
    {
      id: 'vegetacion',
      etiqueta: 'Cobertura vegetal',
      valor: base > 0 ? `${nf((100 * vegetacionM2) / base, 1)} %` : 'Sin datos',
      nota: 'Superficie vegetal neta sobre el total de la isla, descontando lo construido y el agua',
      fuente: 'OpenStreetMap · landuse + natural · unión y diferencia con Turf.js',
      disponible: vegetacionM2 > 0,
    },
    {
      id: 'huella-construida',
      etiqueta: 'Huella construida',
      valor: huellaCatastroM2 > 0 ? `${nf(huellaCatastroM2 / 1e4, 2)} ha` : 'Sin datos',
      nota: islaM2 > 0
        ? `${nf((100 * huellaCatastroM2) / islaM2, 2)} % de la isla ocupado por construcción`
        : 'Suma de las huellas del catastro',
      fuente: 'Catastro AMB Cartagena',
      disponible: huellaCatastroM2 > 0,
    },
    {
      id: 'vias',
      etiqueta: 'Tramos de vía y sendero',
      valor: vias ? nf(vias.features.length) : 'Sin datos',
      nota: 'Vías, caminos y senderos registrados',
      fuente: 'OpenStreetMap',
      disponible: !!vias,
    },
    {
      id: 'manzanas',
      etiqueta: 'Manzanas catastrales',
      valor: manzanas ? nf(manzanas.features.length) : 'Sin datos',
      nota: 'División por manzanas del catastro',
      fuente: 'Catastro AMB Cartagena',
      disponible: !!manzanas,
    },
    {
      id: 'equipamientos',
      etiqueta: 'Equipamientos',
      valor: equipamientos ? nf(equipamientos.features.length) : 'Sin datos',
      nota: 'Servicios comunitarios localizados',
      fuente: 'OpenStreetMap',
      disponible: !!equipamientos,
      requiere: equipamientos
        ? undefined
        : 'La descarga de Overpass está fallando por saturación. Reintentar o solicitar el inventario oficial a la Alcaldía.',
    },
    {
      id: 'poblacion',
      etiqueta: 'Población',
      valor: 'Sin datos',
      nota: 'No hay fuente de población integrada',
      fuente: 'Pendiente',
      disponible: false,
      requiere: 'DANE · Censo 2018 por manzana, o proyección municipal oficial',
    },
    {
      id: 'riesgo',
      etiqueta: 'Riesgo por amenaza costera',
      valor: 'Sin datos',
      nota: 'No hay capa oficial de amenaza integrada',
      fuente: 'Pendiente',
      disponible: false,
      requiere: 'DIMAR / CIOH / POT Cartagena · cartografía de amenaza y erosión',
    },
    {
      id: 'accesibilidad',
      etiqueta: 'Población a <10 min de un equipamiento',
      valor: 'Sin datos',
      nota: 'Requiere población y equipamientos completos',
      fuente: 'Pendiente',
      disponible: false,
      requiere: 'DANE (población) + inventario de equipamientos verificado',
    },
  ];

  return {
    indicadores,
    usoDelSuelo,
    superficies: {
      islaM2: islaM2 > 0 ? islaM2 : null,
      vegetacionM2,
      sueloConstruidoM2,
      aguaM2,
      huellaConstruidaCatastroM2: huellaCatastroM2,
    },
    estadisticasConstruccion,
    densidad: {
      construccionesPorKm2,
      prediosPorKm2,
    },
  };
}
