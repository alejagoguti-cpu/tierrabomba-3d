/**
 * Inventario de construcciones.
 * ==================================================================
 * Lee las huellas del catastro oficial y las convierte en fichas
 * tipadas para el explorador.
 *
 * Solo se exponen datos que EXISTEN en el catastro. Los campos que la
 * entidad no registra quedan a `null`, y la interfaz los muestra como
 * "Información no disponible" en lugar de rellenarlos.
 *
 * Se ejecuta en tiempo de compilación: calcular el área de 2.714
 * polígonos con Turf no debe ocurrir en el navegador.
 * ==================================================================
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { area as areaTurf } from '@turf/area';

const RUTA = 'data/oficial/construccion.geojson';

export interface FichaConstruccion {
  /** Código catastral. Identificador oficial del inmueble. */
  codigo: string;
  /** Altura total registrada, en metros. */
  altura: number | null;
  /** Número de pisos registrado. */
  pisos: number | null;
  /** Área construida registrada, en m². */
  areaRegistrada: number | null;
  /** Tipo de construcción (Convencional, etc.). */
  tipo: string | null;
  /** Área de la huella en planta, calculada de la geometría. */
  areaHuella: number;
  longitude: number;
  latitude: number;
}

export interface EstadisticasConstrucciones {
  total: number;
  conAltura: number;
  conPisos: number;
  conArea: number;
  alturaMedia: number | null;
  alturaMaxima: number | null;
  areaRegistradaTotal: number;
  areaHuellaTotal: number;
  porPisos: Array<{ pisos: number; cantidad: number }>;
  porTipo: Array<{ tipo: string; cantidad: number }>;
}

export interface InventarioConstrucciones {
  fichas: FichaConstruccion[];
  estadisticas: EstadisticasConstrucciones;
  disponible: boolean;
  fuente: string;
  fecha: string | null;
}

/** Centroide aproximado de un polígono (media de sus vértices). */
function centroide(geometria: { type: string; coordinates: unknown } | null) {
  if (!geometria?.coordinates) return { lng: 0, lat: 0 };

  let sx = 0;
  let sy = 0;
  let n = 0;

  const recorrer = (c: unknown) => {
    const arr = c as number[] | unknown[];
    if (typeof arr[0] === 'number') {
      sx += arr[0] as number;
      sy += arr[1] as number;
      n++;
    } else {
      for (const sub of arr) recorrer(sub);
    }
  };

  recorrer(geometria.coordinates);
  return n ? { lng: sx / n, lat: sy / n } : { lng: 0, lat: 0 };
}

const aNumero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const aTexto = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

export function cargarInventario(): InventarioConstrucciones {
  const vacio: InventarioConstrucciones = {
    fichas: [],
    estadisticas: {
      total: 0,
      conAltura: 0,
      conPisos: 0,
      conArea: 0,
      alturaMedia: null,
      alturaMaxima: null,
      areaRegistradaTotal: 0,
      areaHuellaTotal: 0,
      porPisos: [],
      porTipo: [],
    },
    disponible: false,
    fuente: 'Catastro oficial · Área Metropolitana de Cartagena',
    fecha: null,
  };

  const ruta = resolve(process.cwd(), RUTA);
  if (!existsSync(ruta)) return vacio;

  let geojson: {
    features?: Array<{
      properties?: Record<string, unknown>;
      geometry?: { type: string; coordinates: unknown };
    }>;
    metadata?: Record<string, unknown>;
  };

  try {
    geojson = JSON.parse(readFileSync(ruta, 'utf8'));
  } catch {
    return vacio;
  }

  const features = geojson.features ?? [];
  if (!features.length) return vacio;

  const fichas: FichaConstruccion[] = [];
  const conteoPisos = new Map<number, number>();
  const conteoTipos = new Map<string, number>();
  const alturas: number[] = [];
  let areaRegistradaTotal = 0;
  let areaHuellaTotal = 0;
  let conAltura = 0;
  let conPisos = 0;
  let conArea = 0;

  for (const f of features) {
    const p = f.properties ?? {};
    const centro = centroide(f.geometry ?? null);

    let huella = 0;
    if (f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')) {
      try {
        huella = areaTurf({ type: 'Feature', geometry: f.geometry, properties: {} } as never);
      } catch {
        huella = 0;
      }
    }

    const altura = aNumero(p.altura_tot);
    const pisos = aNumero(p.total_piso);
    const areaReg = aNumero(p.area_total);
    const tipo = aTexto(p.tipo_const);

    if (altura !== null && altura > 0) {
      alturas.push(altura);
      conAltura++;
    }
    if (pisos !== null && pisos > 0) {
      conteoPisos.set(pisos, (conteoPisos.get(pisos) ?? 0) + 1);
      conPisos++;
    }
    if (areaReg !== null && areaReg > 0) {
      areaRegistradaTotal += areaReg;
      conArea++;
    }
    if (tipo) conteoTipos.set(tipo, (conteoTipos.get(tipo) ?? 0) + 1);
    if (huella > 0) areaHuellaTotal += huella;

    fichas.push({
      codigo: aTexto(p.codigo) ?? `sin-codigo-${fichas.length}`,
      altura,
      pisos,
      areaRegistrada: areaReg,
      tipo,
      areaHuella: Math.round(huella * 10) / 10,
      longitude: Math.round(centro.lng * 1e6) / 1e6,
      latitude: Math.round(centro.lat * 1e6) / 1e6,
    });
  }

  // Ordenadas por área construida descendente: lo más relevante primero
  fichas.sort((a, b) => (b.areaRegistrada ?? b.areaHuella) - (a.areaRegistrada ?? a.areaHuella));

  return {
    fichas,
    estadisticas: {
      total: fichas.length,
      conAltura,
      conPisos,
      conArea,
      alturaMedia: alturas.length
        ? alturas.reduce((a, b) => a + b, 0) / alturas.length
        : null,
      alturaMaxima: alturas.length ? Math.max(...alturas) : null,
      areaRegistradaTotal,
      areaHuellaTotal,
      porPisos: [...conteoPisos.entries()]
        .map(([pisos, cantidad]) => ({ pisos, cantidad }))
        .sort((a, b) => a.pisos - b.pisos),
      porTipo: [...conteoTipos.entries()]
        .map(([tipo, cantidad]) => ({ tipo, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad),
    },
    disponible: true,
    fuente: 'Catastro oficial · Área Metropolitana de Cartagena',
    fecha: (geojson.metadata?.fecha_importacion as string) ?? null,
  };
}
