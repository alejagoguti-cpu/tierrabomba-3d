import type { Metadata } from 'next';
import { ModuloEnDesarrollo } from '@/components/layout/ModuloEnDesarrollo';

export const metadata: Metadata = { title: 'Equipamientos' };

export default function PaginaEquipamientos() {
  return (
    <ModuloEnDesarrollo
      titulo="Catálogo de equipamientos"
      descripcion="Inventario georreferenciado de los equipamientos comunitarios de la isla —educación, salud, culto, deporte, comercio y servicios— con análisis de distribución y cobertura."
      funciones={[
        'Listado filtrable por tipo de equipamiento, estado y fuente del dato.',
        'Ficha individual de cada equipamiento con sus atributos verificables.',
        'Análisis de distribución espacial y clasificación por uso.',
        'Cálculo de áreas de cobertura y detección de zonas con baja accesibilidad, con Turf.js.',
        'Gráficos de composición por tipo y por asentamiento.',
      ]}
      datosRequeridos={[
        {
          nombre: 'Equipamientos de OpenStreetMap',
          estado: 'parcial',
          nota: 'La consulta a Overpass API está fallando por saturación del servidor público. Hay 16 elementos detectados en el conteo previo, pero la descarga completa aún no se ha podido completar.',
        },
        {
          nombre: 'Inventario oficial de equipamientos',
          estado: 'pendiente',
          nota: 'Requiere solicitud a la Alcaldía de Cartagena o al POT. Sin él, el catálogo solo refleja lo que la comunidad ha cartografiado.',
        },
        {
          nombre: 'Población por asentamiento',
          estado: 'pendiente',
          nota: 'Necesario para calcular cobertura por habitante. DANE, censo 2018 por manzana.',
        },
        {
          nombre: 'Predios y linderos',
          estado: 'pendiente',
          nota: 'IGAC. Permite asociar cada equipamiento a su predio.',
        },
      ]}
      alternativa={{ href: '/explorar', titulo: 'Ver los equipamientos en el visor 3D' }}
    />
  );
}
