import type { Metadata } from 'next';
import { ModuloEnDesarrollo } from '@/components/layout/ModuloEnDesarrollo';

export const metadata: Metadata = { title: 'Ambiente' };

export default function PaginaAmbiente() {
  return (
    <ModuloEnDesarrollo
      titulo="Análisis ambiental"
      descripcion="Lectura de los elementos naturales de la isla y de las condiciones que definen su vulnerabilidad costera: vegetación, hidrografía, humedales y erosión."
      funciones={[
        'Mapa temático de vegetación, playas, humedales e hidrografía.',
        'Identificación de áreas ambientalmente sensibles.',
        'Cruce con la línea de costa para estimar exposición.',
        'Evolución temporal del retroceso costero, si se obtienen imágenes comparables.',
        'Fichas por ecosistema con su fuente y fecha.',
      ]}
      datosRequeridos={[
        {
          nombre: 'Elementos naturales (OSM)',
          estado: 'disponible',
          nota: '100 elementos descargados: playas, vegetación y superficies naturales.',
        },
        {
          nombre: 'Hidrografía (OSM)',
          estado: 'disponible',
          nota: '43 elementos: cursos de agua, caños, cuerpos de agua y varaderos.',
        },
        {
          nombre: 'Manglares y ecosistemas oficiales',
          estado: 'pendiente',
          nota: 'El manglar solo aparece si la comunidad lo ha cartografiado. Los datos oficiales de ecosistemas los publica CARDIQUE y el IDEAM.',
        },
        {
          nombre: 'Erosión costera y línea de costa histórica',
          estado: 'pendiente',
          nota: 'La tasa de retroceso citada en la tesis (~1,8 m/año) proviene de estudios académicos. Para cartografiarla hacen falta líneas de costa comparables en el tiempo: DIMAR, CIOH o imágenes satelitales.',
        },
        {
          nombre: 'Clima y datos meteorológicos',
          estado: 'pendiente',
          nota: 'Precipitación, vientos y evapotranspiración: IDEAM.',
        },
      ]}
      alternativa={{ href: '/explorar', titulo: 'Activar las capas ambientales en el visor' }}
    />
  );
}
