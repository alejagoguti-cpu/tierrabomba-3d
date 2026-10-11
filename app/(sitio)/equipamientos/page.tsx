import type { Metadata } from 'next';
import { CatalogoEquipamientos } from '@/components/equipamientos/CatalogoEquipamientos';
import { cargarEquipamientos } from '@/lib/datos/equipamientos';

export const metadata: Metadata = {
  title: 'Equipamientos',
  description:
    'Equipamientos comunitarios y servicios de Tierra Bomba según OpenStreetMap, con su procedencia y el estado real de la cobertura del inventario.',
};

export default function PaginaEquipamientos() {
  const catalogo = cargarEquipamientos();
  return <CatalogoEquipamientos catalogo={catalogo} />;
}
