/**
 * Análisis territorial con cálculo geométrico real.
 * ==================================================================
 * Cada análisis se calcula sobre los datos publicados. No hay cifras
 * escritas a mano ni estimaciones presentadas como mediciones.
 *
 * Las funciones geométricas (distancia y punto en polígono) están
 * implementadas aquí para no añadir dependencias: son diez líneas cada
 * una y así el cálculo queda auditable.
 *
 * Se ejecuta en tiempo de compilación.
 * ==================================================================
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = process.cwd();

interface Entidad {
  properties: Record<string, unknown>;
  geometry?: { type: string; coordinates: unknown };
}
interface Coleccion {
  features: Entidad[];
}

function leer(ruta: string): Coleccion | null {
  const abs = resolve(RAIZ, ruta);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, 'utf8')) as Coleccion;
  } catch {
    return null;
  }
}

/** Centro aproximado de una geometría (media de vértices). */
function centro(geometria?: { type: string; coordinates: unknown }): [number, number] | null {
  if (!geometria?.coordinates) return null;
  if (geometria.type === 'Point') {
    const c = geometria.coordinates as [number, number];
    return [c[0], c[1]];
  }

  let sx = 0;
  let sy = 0;
  let n = 0;
  const recorrer = (c: unknown) => {
    const arr = c as number[];
    if (typeof arr[0] === 'number') {
      sx += arr[0];
      sy += arr[1];
      n++;
    } else {
      for (const sub of arr as unknown[]) recorrer(sub);
    }
  };
  recorrer(geometria.coordinates);
  return n ? [sx / n, sy / n] : null;
}

/**
 * Distancia entre dos puntos en metros (haversine).
 * Radio medio terrestre: 6.371.008,8 m (WGS 84).
 */
function distanciaM([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Lanzamiento de rayo: ¿el punto está dentro del anillo? */
function enAnillo(p: [number, number], anillo: number[][]): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const xi = anillo[i][0];
    const yi = anillo[i][1];
    const xj = anillo[j][0];
    const yj = anillo[j][1];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

function enPoligono(p: [number, number], geometria?: { type: string; coordinates: unknown }): boolean {
  if (!geometria) return false;
  if (geometria.type === 'Polygon') {
    const anillos = geometria.coordinates as number[][][];
    if (!enAnillo(p, anillos[0])) return false;
    for (let i = 1; i < anillos.length; i++) if (enAnillo(p, anillos[i])) return false;
    return true;
  }
  if (geometria.type === 'MultiPolygon') {
    const polis = geometria.coordinates as number[][][][];
    return polis.some((anillos) => {
      if (!enAnillo(p, anillos[0])) return false;
      for (let i = 1; i < anillos.length; i++) if (enAnillo(p, anillos[i])) return false;
      return true;
    });
  }
  return false;
}

// ------------------------------------------------------------------
//  Resultados
// ------------------------------------------------------------------
export interface Tramo {
  etiqueta: string;
  cantidad: number;
}

export interface ResultadoAnalisis {
  disponible: boolean;
  /** Distribución de superficies construidas, en tramos. */
  distribucionAreas: Tramo[];
  /** Número de pisos registrado. */
  distribucionPisos: Tramo[];
  /** Accesibilidad: distancia de cada construcción al comercio más cercano. */
  accesibilidad: {
    analizadas: number;
    equipamientos: number;
    distanciaMinimaM: number | null;
    distanciaMediaM: number | null;
    distanciaMaximaM: number | null;
    tramos: Tramo[];
  };
  /** Construcciones por barrio y densidad resultante. */
  porBarrio: Array<{
    nombre: string;
    construcciones: number;
    areaKm2: number | null;
    densidadPorKm2: number | null;
  }>;
  /** Superficie construida total frente a la huella. */
  superficies: {
    huellaM2: number;
    areaRegistradaM2: number;
    indiceOcupacionPct: number | null;
  };
}

const vacio: ResultadoAnalisis = {
  disponible: false,
  distribucionAreas: [],
  distribucionPisos: [],
  accesibilidad: {
    analizadas: 0,
    equipamientos: 0,
    distanciaMinimaM: null,
    distanciaMediaM: null,
    distanciaMaximaM: null,
    tramos: [],
  },
  porBarrio: [],
  superficies: { huellaM2: 0, areaRegistradaM2: 0, indiceOcupacionPct: null },
};

let cache: ResultadoAnalisis | null = null;

export function calcularAnalisis(): ResultadoAnalisis {
  if (cache) return cache;

  const construcciones = leer('data/oficial/construccion.geojson');
  const equipamientos = leer('data/osm/equipamientos.geojson');
  const barrios = leer('data/oficial/barrios.geojson');
  const isla = leer('data/ligero/limite_isla.geojson');

  if (!construcciones?.features.length) return vacio;

  // --- Puntos de construcción y de equipamiento -------------------
  const puntosConstruccion: Array<{ p: [number, number]; props: Record<string, unknown> }> = [];
  for (const f of construcciones.features) {
    const c = centro(f.geometry);
    if (c) puntosConstruccion.push({ p: c, props: f.properties ?? {} });
  }

  const puntosEquipamiento: Array<[number, number]> = [];
  for (const f of equipamientos?.features ?? []) {
    const c = centro(f.geometry);
    if (c) puntosEquipamiento.push(c);
  }

  // --- Distribución de superficies --------------------------------
  const limites = [0, 30, 50, 75, 100, 150, 250, 500, Infinity];
  const etiquetas = [
    '< 30 m²',
    '30 – 50 m²',
    '50 – 75 m²',
    '75 – 100 m²',
    '100 – 150 m²',
    '150 – 250 m²',
    '250 – 500 m²',
    '> 500 m²',
  ];
  const conteoAreas = new Array(limites.length - 1).fill(0);
  let areaRegistradaM2 = 0;

  for (const { props } of puntosConstruccion) {
    const a = Number(props.area_total);
    if (!Number.isFinite(a) || a <= 0) continue;
    areaRegistradaM2 += a;
    for (let i = 0; i < limites.length - 1; i++) {
      if (a >= limites[i] && a < limites[i + 1]) {
        conteoAreas[i]++;
        break;
      }
    }
  }

  const distribucionAreas: Tramo[] = etiquetas
    .map((etiqueta, i) => ({ etiqueta, cantidad: conteoAreas[i] }))
    .filter((t) => t.cantidad > 0);

  // --- Distribución de pisos --------------------------------------
  const conteoPisos = new Map<number, number>();
  for (const { props } of puntosConstruccion) {
    const p = Number(props.total_piso);
    if (!Number.isFinite(p) || p <= 0) continue;
    conteoPisos.set(p, (conteoPisos.get(p) ?? 0) + 1);
  }
  const distribucionPisos: Tramo[] = [...conteoPisos.entries()]
    .map(([p, cantidad]) => ({ etiqueta: `${p} piso${p > 1 ? 's' : ''}`, cantidad }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));

  // --- Accesibilidad al comercio más cercano ----------------------
  // Es el único tipo de equipamiento que OpenStreetMap tiene
  // cartografiado en la isla, así que la medida se declara como
  // "distancia al comercio", no "a un equipamiento".
  const distancias: number[] = [];
  for (const { p } of puntosConstruccion) {
    if (!puntosEquipamiento.length) break;
    let minima = Infinity;
    for (const e of puntosEquipamiento) {
      const d = distanciaM(p, e);
      if (d < minima) minima = d;
    }
    if (Number.isFinite(minima)) distancias.push(minima);
  }

  let distanciaMinimaM: number | null = null;
  let distanciaMediaM: number | null = null;
  let distanciaMaximaM: number | null = null;
  const tramosAccesibilidad: Tramo[] = [];

  if (distancias.length) {
    distancias.sort((a, b) => a - b);
    distanciaMinimaM = distancias[0];
    distanciaMaximaM = distancias[distancias.length - 1];
    distanciaMediaM = distancias.reduce((a, b) => a + b, 0) / distancias.length;

    const cortes: Array<[string, number, number]> = [
      ['< 100 m', 0, 100],
      ['100 – 250 m', 100, 250],
      ['250 – 500 m', 250, 500],
      ['500 m – 1 km', 500, 1000],
      ['> 1 km', 1000, Infinity],
    ];
    for (const [etiqueta, desde, hasta] of cortes) {
      tramosAccesibilidad.push({
        etiqueta,
        cantidad: distancias.filter((d) => d >= desde && d < hasta).length,
      });
    }
  }

  // --- Construcciones por barrio ----------------------------------
  // Punto en polígono sobre los barrios oficiales del catastro.
  const porBarrio: ResultadoAnalisis['porBarrio'] = [];
  for (const b of barrios?.features ?? []) {
    const nombre = String(b.properties?.nombre ?? 'Sin nombre');
    let cantidad = 0;
    for (const { p } of puntosConstruccion) {
      if (enPoligono(p, b.geometry)) cantidad++;
    }
    if (!cantidad) continue;
    porBarrio.push({ nombre, construcciones: cantidad, areaKm2: null, densidadPorKm2: null });
  }
  porBarrio.sort((a, b) => b.construcciones - a.construcciones);

  // --- Superficies -------------------------------------------------
  let huellaM2 = 0;
  for (const f of construcciones.features) {
    const g = f.geometry;
    if (!g) continue;
    // Área aproximada por la fórmula del polígono sobre el anillo
    const anillos =
      g.type === 'Polygon'
        ? (g.coordinates as number[][][])
        : g.type === 'MultiPolygon'
          ? (g.coordinates as number[][][][]).flat()
          : [];
    for (const anillo of anillos) {
      let suma = 0;
      for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
        suma += anillo[j][0] * anillo[i][1] - anillo[i][0] * anillo[j][1];
      }
      // Conversión de grados² a m² en la latitud de la isla
      const metrosPorGrado = 111320;
      const cosLat = Math.cos((10.35 * Math.PI) / 180);
      huellaM2 += Math.abs(suma / 2) * metrosPorGrado * metrosPorGrado * cosLat;
    }
  }

  const areaIslaM2 = (() => {
    const g = isla?.features?.[0]?.geometry;
    if (!g) return null;
    const anillos =
      g.type === 'Polygon'
        ? (g.coordinates as number[][][])
        : g.type === 'MultiPolygon'
          ? (g.coordinates as number[][][][]).flat()
          : [];
    let total = 0;
    for (const anillo of anillos) {
      let suma = 0;
      for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
        suma += anillo[j][0] * anillo[i][1] - anillo[i][0] * anillo[j][1];
      }
      const metrosPorGrado = 111320;
      const cosLat = Math.cos((10.35 * Math.PI) / 180);
      total += Math.abs(suma / 2) * metrosPorGrado * metrosPorGrado * cosLat;
    }
    return total || null;
  })();

  cache = {
    disponible: true,
    distribucionAreas,
    distribucionPisos,
    accesibilidad: {
      analizadas: distancias.length,
      equipamientos: puntosEquipamiento.length,
      distanciaMinimaM,
      distanciaMediaM,
      distanciaMaximaM,
      tramos: tramosAccesibilidad,
    },
    porBarrio,
    superficies: {
      huellaM2,
      areaRegistradaM2,
      indiceOcupacionPct: areaIslaM2 ? (100 * huellaM2) / areaIslaM2 : null,
    },
  };

  return cache;
}
