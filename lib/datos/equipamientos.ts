/**
 * Catálogo de equipamientos.
 * ==================================================================
 * Clasifica los equipamientos descargados de OpenStreetMap.
 *
 * HALLAZGO QUE CONDICIONA ESTE MÓDULO
 *   En la isla, OpenStreetMap solo tiene cartografiado COMERCIO:
 *   supermercados, una ferretería y una verdulería. Las consultas de
 *   salud, educación, cultura, deporte y culto no devolvieron ningún
 *   elemento.
 *
 *   Eso no significa que no existan: significa que la comunidad no los
 *   ha registrado. El módulo lo declara en lugar de rellenar el vacío,
 *   porque un inventario de equipamientos inventado es peor que uno
 *   incompleto y declarado.
 * ==================================================================
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RUTA = 'data/osm/equipamientos.geojson';

/** Categorías del catálogo, en el orden en que se muestran. */
export const CATEGORIAS_EQUIPAMIENTO = [
  { id: 'comercio', etiqueta: 'Comercio y servicios', color: '#39B8B0' },
  { id: 'salud', etiqueta: 'Salud', color: '#D96B6B' },
  { id: 'educacion', etiqueta: 'Educación', color: '#D9C6A3' },
  { id: 'cultura', etiqueta: 'Cultura', color: '#B06FC4' },
  { id: 'recreacion', etiqueta: 'Deporte y recreación', color: '#6B9A80' },
  { id: 'culto', etiqueta: 'Culto', color: '#8FA37E' },
  { id: 'institucional', etiqueta: 'Institucional', color: '#2F7DD1' },
  { id: 'otro', etiqueta: 'Otro', color: '#6B7A83' },
] as const;

export type IdCategoriaEquipamiento = (typeof CATEGORIAS_EQUIPAMIENTO)[number]['id'];

export interface FichaEquipamiento {
  id: string;
  nombre: string | null;
  /** Valor original de la etiqueta de OSM (amenity, shop, ...). */
  tipoOsm: string;
  tipoLegible: string;
  categoria: IdCategoriaEquipamiento;
  longitude: number;
  latitude: number;
  direccion: string | null;
  /** Etiquetas originales, para la ficha completa. */
  etiquetas: Record<string, string>;
  osmTipo: string | null;
  osmId: number | null;
}

export interface CatalogoEquipamientos {
  fichas: FichaEquipamiento[];
  porCategoria: Array<{ id: IdCategoriaEquipamiento; etiqueta: string; color: string; cantidad: number }>;
  disponible: boolean;
  fuente: string;
  fecha: string | null;
  /** Categorías sin ningún elemento registrado. */
  vacias: Array<{ etiqueta: string }>;
}

// ------------------------------------------------------------------
//  Clasificación
// ------------------------------------------------------------------
const SALUD = new Set([
  'hospital', 'clinic', 'doctors', 'pharmacy', 'dentist', 'veterinary',
  'nursing_home', 'health_post',
]);
const EDUCACION = new Set(['school', 'kindergarten', 'college', 'university', 'library', 'prep_school']);
const CULTURA = new Set(['community_centre', 'arts_centre', 'theatre', 'cinema', 'museum', 'social_facility']);
const RECREACION = new Set(['pitch', 'playground', 'sports_centre', 'park', 'swimming_pool', 'stadium', 'fitness_station']);
const CULTO = new Set(['place_of_worship', 'religion']);
const INSTITUCIONAL = new Set(['townhall', 'police', 'fire_station', 'post_office', 'courthouse', 'embassy', 'public_building']);

const LEGIBLES: Record<string, string> = {
  supermarket: 'Supermercado',
  greengrocer: 'Verdulería',
  convenience: 'Tienda de conveniencia',
  hardware: 'Ferretería',
  video_games: 'Videojuegos',
  pharmacy: 'Farmacia',
  clinic: 'Clínica',
  doctors: 'Consultorio médico',
  school: 'Escuela',
  kindergarten: 'Jardín infantil',
  place_of_worship: 'Lugar de culto',
  community_centre: 'Centro comunitario',
  playground: 'Parque infantil',
  pitch: 'Cancha',
  townhall: 'Alcaldía',
  police: 'Policía',
};

function clasificar(tipoOsm: string, etiquetas: Record<string, string>): IdCategoriaEquipamiento {
  const v = tipoOsm.toLowerCase();
  if (etiquetas.religion) return 'culto';
  if (SALUD.has(v)) return 'salud';
  if (EDUCACION.has(v)) return 'educacion';
  if (CULTURA.has(v)) return 'cultura';
  if (RECREACION.has(v)) return 'recreacion';
  if (CULTO.has(v)) return 'culto';
  if (INSTITUCIONAL.has(v)) return 'institucional';
  // Todo lo que llega por `shop=*` es comercio
  if (etiquetas.shop) return 'comercio';
  return 'otro';
}

const legible = (t: string) => LEGIBLES[t] ?? t.replace(/_/g, ' ');

/** Centroide de un polígono o coordenada de un punto. */
function centroDe(geometria: { type: string; coordinates: unknown } | undefined) {
  if (!geometria?.coordinates) return { lng: 0, lat: 0 };
  if (geometria.type === 'Point') {
    const c = geometria.coordinates as [number, number];
    return { lng: c[0], lat: c[1] };
  }

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

export function cargarEquipamientos(): CatalogoEquipamientos {
  const sinDatos: CatalogoEquipamientos = {
    fichas: [],
    porCategoria: CATEGORIAS_EQUIPAMIENTO.map((c) => ({ ...c, cantidad: 0 })),
    disponible: false,
    fuente: 'OpenStreetMap',
    fecha: null,
    vacias: CATEGORIAS_EQUIPAMIENTO.map((c) => ({ etiqueta: c.etiqueta })),
  };

  const ruta = resolve(process.cwd(), RUTA);
  if (!existsSync(ruta)) return sinDatos;

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
    return sinDatos;
  }

  const features = geojson.features ?? [];
  if (!features.length) return sinDatos;

  const fichas: FichaEquipamiento[] = features.map((f, i) => {
    // Se normalizan todas las etiquetas a texto para la ficha
    const etiquetas: Record<string, string> = {};
    for (const [k, v] of Object.entries(f.properties ?? {})) {
      if (v === null || v === undefined) continue;
      etiquetas[k] = String(v);
    }

    const tipoOsm =
      etiquetas.amenity ??
      etiquetas.shop ??
      etiquetas.healthcare ??
      etiquetas.leisure ??
      etiquetas.tourism ??
      etiquetas.office ??
      'sin-tipo';

    const centro = centroDe(f.geometry);
    const calle = etiquetas['addr:street'];
    const numero = etiquetas['addr:housenumber'];
    const direccion = calle && numero ? `${calle} ${numero}` : (calle ?? null);

    return {
      id: `${etiquetas.osm_tipo ?? 'osm'}/${etiquetas.osm_id ?? i}`,
      nombre: etiquetas.name ?? null,
      tipoOsm,
      tipoLegible: legible(tipoOsm),
      categoria: clasificar(tipoOsm, etiquetas),
      longitude: Math.round(centro.lng * 1e6) / 1e6,
      latitude: Math.round(centro.lat * 1e6) / 1e6,
      direccion,
      etiquetas,
      osmTipo: etiquetas.osm_tipo ?? null,
      osmId: etiquetas.osm_id ? Number(etiquetas.osm_id) : null,
    };
  });

  const porCategoria = CATEGORIAS_EQUIPAMIENTO.map((c) => ({
    ...c,
    cantidad: fichas.filter((f) => f.categoria === c.id).length,
  })).filter((c) => c.cantidad > 0 || ['comercio', 'salud', 'educacion'].includes(c.id));

  const vacias = CATEGORIAS_EQUIPAMIENTO.filter(
    (c) => !fichas.some((f) => f.categoria === c.id)
  ).map((c) => ({ etiqueta: c.etiqueta }));

  return {
    fichas,
    porCategoria,
    disponible: true,
    fuente: 'OpenStreetMap',
    fecha: (geojson.metadata?.fecha_descarga as string) ?? null,
    vacias,
  };
}
