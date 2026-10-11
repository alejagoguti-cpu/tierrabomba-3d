import { BarraNavegacion } from '@/components/layout/BarraNavegacion';
import { PiePagina } from '@/components/layout/PiePagina';

/**
 * Layout de las secciones de contenido.
 * El visor territorial vive fuera de este grupo porque ocupa toda la
 * pantalla y gestiona su propia navegación.
 */
export default function LayoutSitio({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BarraNavegacion />
      <main id="contenido-principal" className="pt-14">
        {children}
      </main>
      <PiePagina />
    </>
  );
}
