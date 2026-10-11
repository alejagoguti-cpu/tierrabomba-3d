/**
 * Lectura de datos en el servidor (tiempo de compilación).
 * ==================================================================
 * La plataforma se compila como sitio estático, así que estas
 * funciones se ejecutan UNA vez durante `npm run build` y su resultado
 * queda incrustado en el HTML. No hay acceso a disco en producción.
 *
 * Fuente: data/osm/manifiesto.json, que genera automáticamente
 * scripts/datos/descargar_osm_tierrabomba.mjs. Nunca se escriben
 * recuentos ni fechas a mano: si un dato no está en el manifiesto, la
 * interfaz debe decir "Información no disponible".
 * ==================================================================
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CAPAS, type DefinicionCapa } from '@/lib/catalogo';

const RAIZ = process.cwd();
const RUTA_MANIFIESTO_OSM = resolve(RAIZ, 'data/osm/manifiesto.json');
const RUTA_MANIFIESTO_OFICIAL = resolve(RAIZ, 'data/oficial/manifiesto.json');

/** Orígenes de datos de la plataforma, con su manifiesto de procedencia. */
const ORIGENES = [
  { id: 'osm', ruta: RUTA_MANIFIESTO_OSM, nombre: 'OpenStreetMap' },
  { id: 'oficial', ruta: RUTA_MANIFIESTO_OFICIAL, nombre: 'Catastro oficial' },
] as const;

// ------------------------------------------------------------------
//  Tipos del manifiesto
// ------------------------------------------------------------------
export interface EntradaManifiesto {
  titulo: string;
  descripcion: string;
  categoria: string;
  color: string;
  archivo: string;
  entidades: number;
  fechaDescarga: string;
  fuente: string;
  attribution: string;
  licencia: string;
  estadoValidacion: string;
  pesoKb: number;
  geometrias: {
    puntos: number;
    lineas: number;
    poligonos: number;
    relaciones: number;
    sinGeometria: number;
  };
}

export interface Manifiesto {
  actualizado: string;
  fuente: string;
  osm_relacion_isla: number;
  total_entidades: number;
  nota: string;
  capas: Record<string, EntradaManifiesto>;
}

// ------------------------------------------------------------------
//  Lectura
// ------------------------------------------------------------------
let cache: Manifiesto | null | undefined;

/**
 * Lee y fusiona los manifiestos de procedencia de todos los orígenes.
 *
 * Hay dos: OpenStreetMap (colaborativo) y el catastro oficial. Se
 * fusionan en un único índice de capas para que el catálogo pueda
 * consultarlos sin saber de dónde viene cada uno.
 *
 * Devuelve null si no hay ningún manifiesto (clon recién hecho antes de
 * ejecutar las descargas).
 */
export function leerManifiesto(): Manifiesto | null {
  if (cache !== undefined) return cache;

  const capas: Record<string, EntradaManifiesto> = {};
  const fuentes: string[] = [];
  let actualizado: string | null = null;
  let osmRelacion: number | null = null;
  let encontrado = false;

  for (const origen of ORIGENES) {
    if (!existsSync(origen.ruta)) continue;

    try {
      const m = JSON.parse(readFileSync(origen.ruta, 'utf8')) as Manifiesto;
      encontrado = true;
      fuentes.push(origen.nombre);

      for (const [clave, entrada] of Object.entries(m.capas ?? {})) {
        capas[clave] = entrada;
      }

      if (m.actualizado && (!actualizado || m.actualizado > actualizado)) {
        actualizado = m.actualizado;
      }
      if (m.osm_relacion_isla) osmRelacion = m.osm_relacion_isla;
    } catch {
      // Un manifiesto ilegible no debe impedir leer el otro
    }
  }

  if (!encontrado) {
    cache = null;
    return cache;
  }

  cache = {
    actualizado: actualizado ?? '',
    fuente: fuentes.join(' + '),
    osm_relacion_isla: osmRelacion ?? 0,
    total_entidades: Object.values(capas).reduce((n, c) => n + (c.entidades ?? 0), 0),
    nota: 'Manifiestos fusionados en lib/datos/servidor.ts',
    capas,
  };

  return cache;
}

/** ¿Hay datos descargados disponibles? */
export function hayDatos(): boolean {
  const m = leerManifiesto();
  return m !== null && Object.keys(m.capas ?? {}).length > 0;
}

// ------------------------------------------------------------------
//  Catálogo enriquecido
// ------------------------------------------------------------------
/**
 * Devuelve el catálogo de capas con los metadatos reales (recuento y
 * fecha) inyectados desde el manifiesto.
 *
 * Si una capa no aparece en el manifiesto, se devuelve igualmente pero
 * SIN recuento ni fecha: la interfaz mostrará "Información no
 * disponible" en lugar de un número inventado.
 */
export function obtenerCatalogo(): DefinicionCapa[] {
  const manifiesto = leerManifiesto();

  return CAPAS.map((capa) => {
    // El manifiesto indexa por el nombre del archivo sin extensión
    // (p. ej. "edificaciones"). El id del catálogo usa guiones.
    const clave = capa.archivo.split('/').pop()?.replace('.geojson', '') ?? '';
    const entrada = manifiesto?.capas?.[clave];

    if (!entrada) return capa;

    return {
      ...capa,
      entidades: entrada.entidades,
      fechaDescarga: entrada.fechaDescarga,
      pesoKb: entrada.pesoKb,
    };
  });
}

/** Capas que realmente tienen datos descargados. */
export function capasDisponibles(): DefinicionCapa[] {
  return obtenerCatalogo().filter((c) => c.entidades !== undefined && c.entidades > 0);
}

// ------------------------------------------------------------------
//  Resumen para la página de datos
// ------------------------------------------------------------------
export interface ResumenDatos {
  totalEntidades: number;
  totalCapas: number;
  pesoTotalKb: number;
  fechaActualizacion: string | null;
  osmRelacion: number | null;
  fuentePrincipal: string;
  conDatos: boolean;
}

export function obtenerResumen(): ResumenDatos {
  const m = leerManifiesto();
  const catalogo = obtenerCatalogo();
  const conDatos = catalogo.filter((c) => (c.entidades ?? 0) > 0);

  return {
    totalEntidades: conDatos.reduce((n, c) => n + (c.entidades ?? 0), 0),
    totalCapas: conDatos.length,
    pesoTotalKb: conDatos.reduce((n, c) => n + (c.pesoKb ?? 0), 0),
    fechaActualizacion: m?.actualizado ?? null,
    osmRelacion: m?.osm_relacion_isla ?? null,
    fuentePrincipal: m?.fuente ?? 'OpenStreetMap',
    conDatos: conDatos.length > 0,
  };
}

/** Formatea una fecha ISO como texto en español, sin dependencias. */
export function formatearFecha(iso?: string | null): string {
  if (!iso) return 'Información no disponible';
  const [a, m, d] = iso.split('-');
  if (!a || !m || !d) return iso;
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${Number(d)} de ${meses[Number(m) - 1] ?? m} de ${a}`;
}

/** Formatea un número con separador de miles español. */
export function formatearNumero(n?: number | null): string {
  if (n === undefined || n === null) return 'Información no disponible';
  return n.toLocaleString('es-CO');
}
