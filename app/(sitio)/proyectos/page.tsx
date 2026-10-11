import type { Metadata } from 'next';
import { ModuloEnDesarrollo } from '@/components/layout/ModuloEnDesarrollo';

export const metadata: Metadata = { title: 'Proyectos' };

export default function PaginaProyectos() {
  return (
    <ModuloEnDesarrollo
      titulo="Proyectos arquitectónicos"
      descripcion="Visor de los modelos arquitectónicos del proyecto de grado: el equipamiento comunitario y la infraestructura hídrica propuestos para la meseta segura de Tierra Bomba."
      funciones={[
        'Visor 3D del modelo BIM exportado de Revit (glTF binario, 40,3 MB).',
        'Filtro por familias de material: terreno, muros, tabiques y volumetría construida.',
        'Despiece vertical para separar cubierta, aljibe y terreno.',
        'Consulta de las propiedades disponibles por elemento.',
        'Descarga del modelo y de la documentación autorizada.',
      ]}
      datosRequeridos={[
        {
          nombre: 'Modelo 3D del equipamiento',
          estado: 'disponible',
          nota: 'TIERRABOMBA.glb: 1.087.522 triángulos, 4.472 mallas, 6 materiales. Ya publicado en el repositorio.',
        },
        {
          nombre: 'Georreferenciación del modelo',
          estado: 'parcial',
          nota: 'El OBJ de Revit está en coordenadas internas del proyecto, sin sistema de referencia. Debe calibrarse con un punto conocido para situarlo en el globo.',
        },
        {
          nombre: 'Modelo IFC',
          estado: 'pendiente',
          nota: 'El módulo BIM requiere un IFC exportado de Revit con propiedades de elementos. El glTF actual no conserva metadatos BIM.',
        },
        {
          nombre: 'Planos y memorias',
          estado: 'parcial',
          nota: 'Existe documentación gráfica en el repositorio, pero falta sistematizarla por planta y sección.',
        },
      ]}
      alternativa={{ href: '/explorar', titulo: 'Situar el proyecto en el territorio' }}
    />
  );
}
