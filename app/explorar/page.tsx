import { Metadata } from 'next';
import { BarraNavegacion } from '@/components/layout/BarraNavegacion';
import { VisorTerritorial } from '@/components/mapa/VisorTerritorial';
import { obtenerCatalogo } from '@/lib/datos/servidor';

export const metadata: Metadata = {
  title: 'Explorar el territorio',
  description:
    'Visor territorial 3D de la isla de Tierra Bomba: relieve real, edificaciones, equipamientos, movilidad y análisis ambiental con capas verificables.',
};

export default function PaginaExplorar() {
  // Se ejecuta en tiempo de compilación: el catálogo queda incrustado
  // en el HTML con los recuentos y fechas reales del manifiesto.
  const catalogo = obtenerCatalogo();

  return (
    <div className="pt-14">
      <BarraNavegacion />
      <main id="contenido-principal">
        <VisorTerritorial catalogo={catalogo} />
      </main>
    </div>
  );
}
