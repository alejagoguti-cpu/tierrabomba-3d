import { BarraNavegacion } from '@/components/layout/BarraNavegacion';
import { PortadaNarrativa } from '@/components/inicio/PortadaNarrativa';
import { obtenerCatalogo, obtenerResumen } from '@/lib/datos/servidor';

/**
 * Portada narrativa. Los datos se leen en tiempo de compilación, así
 * que los recuentos que aparecen en pantalla son los reales del
 * manifiesto de procedencia, no cifras escritas a mano.
 */
export default function Inicio() {
  const catalogo = obtenerCatalogo();
  const resumen = obtenerResumen();

  return (
    <>
      <BarraNavegacion />
      <main id="contenido-principal">
        <PortadaNarrativa catalogo={catalogo} resumen={resumen} />
      </main>
    </>
  );
}
