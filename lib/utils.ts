import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases de Tailwind resolviendo conflictos. */
export function cn(...entradas: ClassValue[]) {
  return twMerge(clsx(entradas));
}

/** Formatea un número con separador de miles español. */
export function numero(n?: number | null, decimales = 0): string {
  if (n === undefined || n === null || Number.isNaN(n)) {
    return 'Información no disponible';
  }
  return n.toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/** Formatea un área en m² o hectáreas según magnitud. */
export function area(m2?: number | null): string {
  if (m2 === undefined || m2 === null || Number.isNaN(m2)) {
    return 'Información no disponible';
  }
  if (m2 >= 10000) return `${numero(m2 / 10000, 2)} ha`;
  return `${numero(m2, 0)} m²`;
}

/** Formatea una longitud en metros o kilómetros. */
export function longitud(m?: number | null): string {
  if (m === undefined || m === null || Number.isNaN(m)) {
    return 'Información no disponible';
  }
  if (m >= 1000) return `${numero(m / 1000, 2)} km`;
  return `${numero(m, 1)} m`;
}

/** Coordenadas en formato grados decimales con hemisferio. */
export function coordenadas(lng: number, lat: number, decimales = 5): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'O';
  return `${Math.abs(lat).toFixed(decimales)}° ${ns}, ${Math.abs(lng).toFixed(decimales)}° ${ew}`;
}

/** Texto legible a partir de una clave de OpenStreetMap. */
export function etiquetaOsm(clave: string, valor?: string): string {
  const nombres: Record<string, string> = {
    building: 'Edificación',
    amenity: 'Equipamiento',
    shop: 'Comercio',
    leisure: 'Recreación',
    healthcare: 'Salud',
    tourism: 'Turismo',
    office: 'Oficina',
    highway: 'Vía',
    landuse: 'Uso del suelo',
    natural: 'Elemento natural',
    waterway: 'Curso de agua',
    name: 'Nombre',
    surface: 'Superficie',
    material: 'Material',
    religion: 'Culto',
    'building:levels': 'Niveles',
    height: 'Altura',
    foot: 'Acceso peatonal',
    motorcycle: 'Acceso en moto',
    access: 'Acceso',
    width: 'Ancho',
    incline: 'Pendiente',
    source: 'Fuente del dato',
  };
  const nombre = nombres[clave] ?? clave;
  return valor ? `${nombre}: ${valor}` : nombre;
}

/** Convierte "yes"/"no" de OSM a texto en español. */
export function siNo(valor?: string): string {
  if (!valor) return 'Información no disponible';
  if (valor === 'yes' || valor === 'true') return 'Sí';
  if (valor === 'no' || valor === 'false') return 'No';
  return valor;
}

/**
 * Formatea una fecha ISO (AAAA-MM-DD) como texto en español.
 *
 * Vive en utils y no en lib/datos/servidor.ts porque los componentes de
 * cliente también la usan: aquel módulo importa `node:fs` y arrastrarlo
 * al paquete del navegador rompería la compilación.
 */
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
