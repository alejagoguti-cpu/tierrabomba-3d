import type { Metadata } from 'next';
import { ModuloEnDesarrollo } from '@/components/layout/ModuloEnDesarrollo';

export const metadata: Metadata = { title: 'Análisis' };

export default function PaginaAnalisis() {
  return (
    <ModuloEnDesarrollo
      titulo="Herramientas de análisis territorial"
      descripcion="Módulos de cálculo sobre los datos cargados: pendientes, accesibilidad a equipamientos, ocupación del suelo y comparación de escenarios."
      funciones={[
        'Cálculo de pendientes y elevaciones a partir del modelo digital del terreno.',
        'Distancia de cada edificación al equipamiento más cercano y áreas de cobertura.',
        'Detección de zonas con baja accesibilidad.',
        'Densidad de edificaciones por asentamiento, cuando haya datos suficientes.',
        'Comparación de escenarios con un deslizador antes/después, diferenciando lo real de lo simulado.',
      ]}
      datosRequeridos={[
        {
          nombre: 'Modelo digital del terreno',
          estado: 'parcial',
          nota: 'El visor ya usa el relieve real de AWS Terrain Tiles (SRTM/GMTED, ~30 m). Para calcular pendientes con precisión sobre una isla de 19 km² hace falta un MDT de mayor resolución, idealmente derivado del levantamiento propio.',
        },
        {
          nombre: 'Equipamientos georreferenciados',
          estado: 'parcial',
          nota: 'Sin el inventario completo, el cálculo de accesibilidad daría resultados engañosos. Es la dependencia principal de este módulo.',
        },
        {
          nombre: 'Límites de asentamientos',
          estado: 'pendiente',
          nota: 'Necesarios para agregar datos por sector. Pueden derivarse del POT o levantarse en campo.',
        },
        {
          nombre: 'Población y vivienda',
          estado: 'pendiente',
          nota: 'DANE. Necesario para cualquier análisis per cápita.',
        },
      ]}
      alternativa={{ href: '/explorar', titulo: 'Usar las herramientas de medición del visor' }}
    />
  );
}
