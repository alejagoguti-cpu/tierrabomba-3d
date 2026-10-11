/**
 * Traducción del catálogo de capas a especificaciones de MapLibre.
 * ==================================================================
 * Mantiene separados los datos (lib/catalogo.ts) de la lógica
 * geoespacial (este archivo) y de la interfaz (componentes). Añadir
 * una capa al catálogo basta para que el visor sepa dibujarla.
 * ==================================================================
 */

import type { LayerSpecification } from 'maplibre-gl';
import type { DefinicionCapa } from '@/lib/catalogo';

/**
 * Texturas procedurales del visor.
 *
 * Se generan con `python scripts/datos/generar_texturas.py`: son sin
 * costura y de licencia libre, así que no hay que citar a nadie.
 *
 * SOBRE EL MATERIAL DE CUBIERTA
 *   El caserío de Tierra Bomba NO usa teja de barro: usa lámina de
 *   acero corrugado (zinc). Por eso la textura por defecto de las
 *   construcciones es `acero`. La teja de barro se reserva al centro
 *   histórico y los sectores consolidados.
 *
 *   El catastro NO registra el material de cubierta de cada
 *   edificación, así que la textura es una representación tipológica,
 *   no un dato por edificio. Así se declara en la interfaz.
 */
export const TEXTURAS = {
  acero: '/texturas/acero.png',
  teja: '/texturas/teja.png',
  muro: '/texturas/muro.png',
  vegetacion: '/texturas/vegetacion.png',
  arena: '/texturas/arena.png',
  agua: '/texturas/agua.png',
  adoquin: '/texturas/adoquin.png',
  tierra: '/texturas/tierra.png',
} as const;

export type NombreTextura = keyof typeof TEXTURAS;

/** Patrón de relleno que corresponde a cada capa del catálogo. */
export function texturaDeCapa(capa: DefinicionCapa): NombreTextura | null {
  switch (capa.id) {
    case 'catastro-construccion':
    case 'catastro-unidades':
    case 'edificaciones':
      // Cubierta de zinc: la tipología real de la isla
      return 'acero';
    case 'natural':
      return 'vegetacion';
    case 'usos-suelo':
      return 'vegetacion';
    case 'hidrografia':
      return 'agua';
    case 'vias':
      return 'adoquin';
    case 'catastro-manzanas':
      return 'tierra';
    default:
      return null;
  }
}

/**
 * Altura en metros que se aplica a las edificaciones de OpenStreetMap
 * SIN altura registrada al extruirlas en 3D.
 *
 * CALIBRADA CON DATO OFICIAL, no inventada.
 *   La cartografía catastral de Cartagena registra `altura_tot` para
 *   2.687 de las 2.714 construcciones de la isla (99,0 %), con una
 *   media de 2,97 m: el caserío de Tierra Bomba es abrumadoramente de
 *   una sola planta. Por eso la aproximación es de una planta y no de
 *   las dos que se suponen por defecto en un entorno urbano.
 *
 *   Aun así es una APROXIMACIÓN declarada: para altura con dato oficial
 *   hay que usar la capa `catastro-construccion`.
 */
export const ALTURA_APROXIMADA_M = 3.2;

/** Altura en metros de cada nivel cuando solo hay `building:levels`. */
export const ALTURA_POR_NIVEL_M = 3.2;

/** Identificador catastral: es la clave con la que se editan viviendas. */
export const CAMPO_ID_VIVIENDA = 'codigo';

/**
 * ¿La capa admite edición por vivienda?
 * Solo las construcciones del catastro, que llevan código catastral.
 */
export function esEditable(capa: DefinicionCapa): boolean {
  return capa.id === 'catastro-construccion';
}

/** Capas que se extruyen en 3D. */
export const CAPAS_CON_EXTRUSION = new Set(['edificaciones', 'catastro-construccion']);

/**
 * Expresión de MapLibre que calcula la altura de extrusión.
 * Prioridad:
 *   1. `height` real (OpenStreetMap), si existe
 *   2. `building:levels` x 3,2 m
 *   3. Altura aproximada declarada
 */
export const EXPRESION_ALTURA = [
  'case',
  ['has', 'height'],
  ['to-number', ['get', 'height'], ALTURA_APROXIMADA_M],
  ['has', 'building:levels'],
  ['*', ['to-number', ['get', 'building:levels'], 1], ALTURA_POR_NIVEL_M],
  ALTURA_APROXIMADA_M,
] as never;

/**
 * Expresión para el catastro oficial: aquí la altura SÍ es un dato
 * registrado por la entidad catastral, no una estimación.
 *   1. `altura_tot` (altura total registrada)
 *   2. `total_piso` x 3,2 m
 *   3. Respaldo aproximado, solo si el registro viniera vacío
 */
export const EXPRESION_ALTURA_OFICIAL = [
  'case',
  ['has', 'altura_tot'],
  ['to-number', ['get', 'altura_tot'], ALTURA_APROXIMADA_M],
  ['has', 'total_piso'],
  ['*', ['to-number', ['get', 'total_piso'], 1], ALTURA_POR_NIVEL_M],
  ALTURA_APROXIMADA_M,
] as never;

/** ¿La capa tiene datos reales de altura? Solo para mensajes de la interfaz. */
export function tieneAlturasReales(capa: DefinicionCapa): boolean {
  return capa.estadoValidacion === 'oficial' && capa.id.includes('construccion');
}

export const idFuente = (id: string) => `fuente-${id}`;
export const idRelleno = (id: string) => `relleno-${id}`;
export const idLinea = (id: string) => `linea-${id}`;
export const idPunto = (id: string) => `punto-${id}`;
export const idEtiqueta = (id: string) => `etiqueta-${id}`;
export const idExtrusion = (id: string) => `extrusion-${id}`;

/** Ids de todas las capas de dibujo asociadas a una capa del catálogo. */
export function idsDeCapa(capa: DefinicionCapa): string[] {
  const ids = [idRelleno(capa.id), idLinea(capa.id), idPunto(capa.id), idEtiqueta(capa.id)];
  if (CAPAS_CON_EXTRUSION.has(capa.id)) ids.push(idExtrusion(capa.id));
  return ids;
}

/**
 * Construye las capas de MapLibre para una capa del catálogo.
 *
 * @param capa         Definición del catálogo
 * @param modo3d       Si el visor está en 3D (activa la extrusión)
 * @param antesDe      Id de la capa ante la que insertar (para orden)
 */
export function especificacionesDeCapa(
  capa: DefinicionCapa,
  modo3d: boolean,
  conTexturas = true,
  antesDe?: string
): LayerSpecification[] {
  const fuente = idFuente(capa.id);
  const capas: LayerSpecification[] = [];
  const comun = antesDe ? { beforeId: antesDe } : {};
  // El interruptor de texturas permite alternar entre la lectura
  // tipológica (axonomía con materiales) y la lectura analítica
  // (rampa de color por altura).
  const textura = conTexturas ? texturaDeCapa(capa) : null;

  const esPunto = capa.geometria === 'punto' || capa.geometria === 'mixta';
  const esLinea = capa.geometria === 'linea' || capa.geometria === 'mixta';
  const esPoligono = capa.geometria === 'poligono' || capa.geometria === 'mixta';

  // --- Polígonos: relleno -------------------------------------------
  if (esPoligono) {
    capas.push({
      id: idRelleno(capa.id),
      type: 'fill',
      source: fuente,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        // El patrón sustituye al color plano cuando la capa tiene
        // textura asignada. Se deja el color como respaldo por si la
        // imagen no llegara a cargarse.
        ...(textura && capa.id !== 'limite-isla'
          ? { 'fill-pattern': textura }
          : {}),
        'fill-color': capa.color,
        'fill-opacity': capa.id === 'limite-isla' ? 0.08 : textura ? 0.85 : 0.42,
        'fill-outline-color': 'transparent',
      },
      layout: { visibility: 'visible' },
      ...comun,
    } as LayerSpecification);
  }

  // --- Líneas: contorno de polígono o vía ---------------------------
  if (esLinea || esPoligono) {
    capas.push({
      id: idLinea(capa.id),
      type: 'line',
      source: fuente,
      filter: esPoligono && !esLinea
        ? ['==', ['geometry-type'], 'Polygon']
        : ['in', ['geometry-type'], ['literal', ['Polygon', 'LineString']]],
      paint: {
        'line-color': capa.color,
        'line-width': capa.geometria === 'linea' ? 1.4 : 1.1,
        'line-opacity': capa.id === 'limite-isla' ? 0.9 : 0.72,
        ...(capa.id === 'limite-isla' ? { 'line-dasharray': [2, 1.5] } : {}),
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        visibility: 'visible',
      },
      ...comun,
    } as LayerSpecification);
  }

  // --- Puntos -------------------------------------------------------
  if (esPunto) {
    capas.push({
      id: idPunto(capa.id),
      type: 'circle',
      source: fuente,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11, 3,
          14, 5.5,
          17, 9,
        ],
        'circle-color': capa.color,
        'circle-opacity': 0.92,
        'circle-stroke-color': '#08171f',
        'circle-stroke-width': 1.4,
      },
      layout: { visibility: 'visible' },
      ...comun,
    } as LayerSpecification);
  }

  // --- Edificaciones: extrusión 3D ----------------------------------
  // Solo en modo 3D y solo para las capas de construcción: extruir el
  // resto de polígonos no aporta y multiplica el coste de dibujo.
  if (CAPAS_CON_EXTRUSION.has(capa.id) && modo3d) {
    const esOficial = capa.estadoValidacion === 'oficial';

    capas.push({
      id: idExtrusion(capa.id),
      type: 'fill-extrusion',
      source: fuente,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        // Con textura, la cubierta se lee por su material (lámina de
        // acero corrugado). Sin textura, el color codifica la altura.
        ...(textura ? { 'fill-extrusion-pattern': textura } : {}),
        // El color editado por la persona usuaria TIENE PRIORIDAD sobre
        // la rampa. Se guarda como feature-state, indexado por código
        // catastral, así que no hay que reescribir los datos del mapa.
        'fill-extrusion-color': [
          'coalesce',
          ['feature-state', 'colorMuro'],
          esOficial
            ? [
                'interpolate',
                ['linear'],
                ['coalesce', ['to-number', ['get', 'altura_tot'], 3], 3],
                2, '#8a7550',
                4, '#d9c6a3',
                8, '#f0e6d2',
              ]
            : [
                'interpolate',
                ['linear'],
                ['coalesce', ['to-number', ['get', 'height'], 0], 0],
                0, '#6f6047',
                12, '#b8a077',
                30, '#d9c6a3',
              ],
        ],
        'fill-extrusion-height': esOficial ? EXPRESION_ALTURA_OFICIAL : EXPRESION_ALTURA,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': textura ? 1 : esOficial ? 0.94 : 0.7,
      },
      layout: { visibility: 'visible' },
      ...comun,
    } as LayerSpecification);
  }

  // --- Etiquetas: solo nombres registrados --------------------------
  capas.push({
    id: idEtiqueta(capa.id),
    type: 'symbol',
    source: fuente,
    minzoom: 14,
    filter: ['all', ['has', 'name'], ['!=', ['get', 'name'], '']],
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-font': ['Noto Sans Regular'],
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-max-width': 9,
      'text-allow-overlap': false,
      visibility: 'visible',
    },
    paint: {
      'text-color': '#f6f4ef',
      'text-halo-color': '#08171f',
      'text-halo-width': 1.4,
      'text-halo-blur': 0.4,
    },
    ...comun,
  } as LayerSpecification);

  return capas;
}

/** Estilos de resalte al pasar el ratón o seleccionar. */
export const ESTILO_RESALTE = {
  lineaSeleccion: {
    'line-color': '#39B8B0',
    'line-width': 3,
  },
} as const;

/**
 * Fuentes base sin token. Todas gratuitas y sin cuenta:
 *  - OpenFreeMap: teselas vectoriales (estilos fiord, dark, positron, liberty)
 *  - AWS Terrain Tiles: modelo de elevación (Terrarium, derivado de SRTM/GMTED)
 */
export const ESTILOS_BASE = [
  {
    id: 'fiord',
    nombre: 'Fiordo',
    url: 'https://tiles.openfreemap.org/styles/fiord',
    oscuro: true,
  },
  {
    id: 'dark',
    nombre: 'Oscuro',
    url: 'https://tiles.openfreemap.org/styles/dark',
    oscuro: true,
  },
  {
    id: 'positron',
    nombre: 'Claro',
    url: 'https://tiles.openfreemap.org/styles/positron',
    oscuro: false,
  },
  {
    id: 'liberty',
    nombre: 'Detallado',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    oscuro: false,
  },
] as const;

export const FUENTE_TERRENO = {
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium' as const,
  tileSize: 256,
  maxzoom: 15,
  attribution:
    'Elevación: <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a> (SRTM/GMTED)',
};

/** Exageración vertical del terreno. La isla es llana; sin esto no se lee. */
export const EXAGERACION_TERRENO = 1.6;
