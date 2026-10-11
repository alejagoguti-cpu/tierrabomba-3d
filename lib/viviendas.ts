/**
 * Ediciones de vivienda guardadas por la persona usuaria.
 * ==================================================================
 * Cada vivienda se identifica por su CÓDIGO CATASTRAL, que es el
 * identificador oficial del inmueble. Eso significa que las ediciones
 * sobreviven a cualquier recarga de los datos: si mañana se reimporta
 * el catastro, los códigos siguen siendo los mismos.
 *
 * SE GUARDAN EN EL NAVEGADOR
 *   La plataforma es un sitio estático, sin servidor ni base de datos.
 *   Guardar en el navegador es lo único honesto que se puede hacer sin
 *   backend; el módulo exporta a JSON para no perder el trabajo y para
 *   poder llevarlo a otro equipo.
 *
 *   Nada de esto se publica como dato verificado: son propuestas de
 *   diseño, no levantamientos.
 * ==================================================================
 */

const CLAVE = 'tb3d:viviendas';

export interface EdicionVivienda {
  /** Código catastral del inmueble. */
  codigo: string;
  colorMuro: string;
  colorTecho: string;
  ventanasFrente: number;
  ventanasLateral: number;
  puerta: boolean;
  /** Dimensiones en planta, en metros. */
  ancho: number;
  largo: number;
  /** Altura del muro, en metros. */
  altoMuro: number;
  /** Fecha ISO de la última edición. */
  actualizado: string;
}

export type MapaEdiciones = Record<string, EdicionVivienda>;

/** Valores por defecto, derivados de la tipología del catastro. */
export const EDICION_INICIAL: Omit<EdicionVivienda, 'codigo' | 'actualizado'> = {
  colorMuro: '#efe7d7',
  colorTecho: '#b9bec2',
  ventanasFrente: 2,
  ventanasLateral: 1,
  puerta: true,
  ancho: 7.2,
  largo: 9,
  altoMuro: 3,
};

/** Lee todas las ediciones guardadas. Nunca lanza: devuelve {} si falla. */
export function leerEdiciones(): MapaEdiciones {
  if (typeof window === 'undefined') return {};
  try {
    const bruto = window.localStorage.getItem(CLAVE);
    if (!bruto) return {};
    const datos = JSON.parse(bruto) as MapaEdiciones;
    return datos && typeof datos === 'object' ? datos : {};
  } catch {
    return {};
  }
}

/** Guarda o actualiza la edición de una vivienda. */
export function guardarEdicion(
  edicion: Omit<EdicionVivienda, 'actualizado'>
): MapaEdiciones {
  const actuales = leerEdiciones();
  const siguiente: MapaEdiciones = {
    ...actuales,
    [edicion.codigo]: { ...edicion, actualizado: new Date().toISOString() },
  };
  escribir(siguiente);
  return siguiente;
}

/** Elimina la edición de una vivienda y vuelve a su estado original. */
export function borrarEdicion(codigo: string): MapaEdiciones {
  const actuales = leerEdiciones();
  delete actuales[codigo];
  escribir(actuales);
  return actuales;
}

function escribir(mapa: MapaEdiciones) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(mapa));
  } catch {
    // Cuota agotada o almacenamiento bloqueado: la edición no persiste,
    // pero la sesión actual sigue funcionando.
  }
}

/**
 * Exporta las ediciones a un archivo JSON descargable.
 * Sin esto, el trabajo quedaría atrapado en un solo navegador.
 */
export function exportarEdiciones(): void {
  const datos = leerEdiciones();
  const total = Object.keys(datos).length;
  if (!total) return;

  const salida = {
    proyecto: 'TIERRA BOMBA 3D',
    tipo: 'propuestas de vivienda',
    aviso:
      'Propuestas de diseño elaboradas sobre la tipología del caserío. ' +
      'NO son datos verificados ni levantamientos: no deben publicarse ' +
      'como información territorial confirmada.',
    fecha: new Date().toISOString(),
    viviendas: total,
    ediciones: datos,
  };

  const blob = new Blob([JSON.stringify(salida, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `viviendas-tierra-bomba-${total}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Cuenta de viviendas editadas. */
export function contarEdiciones(): number {
  return Object.keys(leerEdiciones()).length;
}
