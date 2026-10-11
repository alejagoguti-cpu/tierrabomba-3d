import type { Metadata } from 'next';
import { ExploradorConstrucciones } from '@/components/construcciones/ExploradorConstrucciones';
import { cargarInventario } from '@/lib/datos/construcciones';

export const metadata: Metadata = {
  title: 'Inventario de construcciones',
  description:
    'Inventario de las construcciones de Tierra Bomba según el catastro oficial, con altura, número de pisos y área registrados por la entidad catastral.',
};

/**
 * Inventario de construcciones.
 *
 * Se calcula en tiempo de compilación: el área de las 2.714 huellas se
 * resuelve con Turf una sola vez y el navegador recibe los datos ya
 * listos.
 */
export default function PaginaConstrucciones() {
  const inventario = cargarInventario();
  return <ExploradorConstrucciones inventario={inventario} />;
}
