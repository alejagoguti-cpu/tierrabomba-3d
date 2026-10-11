import type { DefinicionCapa } from '@/lib/catalogo';

/** Elemento seleccionado en el mapa, con su capa de origen. */
export interface ElementoSeleccionado {
  /** Id de la capa del catálogo a la que pertenece. */
  capaId: string;
  /** Propiedades originales del dato (etiquetas de OpenStreetMap). */
  propiedades: Record<string, unknown>;
  /** Centro del elemento, para centrar la ficha. */
  lng: number;
  lat: number;
  /** Tipo de geometría, para saber qué magnitudes calcular. */
  geometria: 'Point' | 'LineString' | 'Polygon' | string;
  /** Área en m² si es polígono. */
  areaM2?: number;
  /** Longitud en m si es línea. */
  longitudM?: number;
}

/** Modo de dibujo activo en el mapa. */
export type ModoHerramienta = 'navegar' | 'medir-distancia' | 'medir-area';

export interface PuntoMedicion {
  lng: number;
  lat: number;
}

export interface ResultadoMedicion {
  puntos: PuntoMedicion[];
  /** Metros, si es una medición de distancia. */
  distanciaM?: number;
  /** Metros cuadrados, si es una medición de área. */
  areaM2?: number;
  /** Perímetro en metros, si es una medición de área. */
  perimetroM?: number;
}

export interface EstadoCapas {
  /** Ids de capas visibles. */
  visibles: Set<string>;
  /** Opacidad por capa (no usado en la v1, reservado). */
  opacidad: Record<string, number>;
}

export type { DefinicionCapa };
