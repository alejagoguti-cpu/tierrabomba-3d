import type { Metadata } from 'next';
import { ModuloEnDesarrollo } from '@/components/layout/ModuloEnDesarrollo';

export const metadata: Metadata = { title: 'Construcciones' };

export default function PaginaConstrucciones() {
  return (
    <ModuloEnDesarrollo
      titulo="Inventario de construcciones"
      descripcion="Relación de las edificaciones registradas en la isla, con el estado real de su documentación: qué se conoce de cada una y qué falta por levantar."
      funciones={[
        'Explorador tabular de las 827 huellas de edificación con búsqueda y orden.',
        'Filtros por atributos disponibles: tipo, material, superficie, presencia de dirección.',
        'Indicador de completitud por edificación: cuántos campos faltan.',
        'Exportación a CSV de la selección filtrada.',
        'Acceso directo a la ficha y al elemento en el visor 3D.',
      ]}
      datosRequeridos={[
        {
          nombre: 'Huellas de edificación (OSM)',
          estado: 'disponible',
          nota: '827 polígonos descargados, con superficie calculable. Es la base del inventario.',
        },
        {
          nombre: 'Número de niveles y altura',
          estado: 'parcial',
          nota: 'Solo 2 edificaciones tienen building:levels y 1 tiene height. El 99,6 % del inventario carece de datos de altura: hay que levantarlos en campo.',
        },
        {
          nombre: 'Uso y estado de conservación',
          estado: 'pendiente',
          nota: 'No existe en la fuente actual. Requiere trabajo de campo o inventario oficial.',
        },
        {
          nombre: 'Fotografías autorizadas',
          estado: 'pendiente',
          nota: 'No hay imágenes con licencia verificable. Deben aportarse con consentimiento.',
        },
      ]}
      alternativa={{ href: '/explorar', titulo: 'Ver las edificaciones extruidas en 3D' }}
    />
  );
}
