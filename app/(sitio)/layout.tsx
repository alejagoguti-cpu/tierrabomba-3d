import { DisposicionApp } from '@/components/layout/DisposicionApp';
import { PiePagina } from '@/components/layout/PiePagina';
import { obtenerCatalogo, obtenerResumen } from '@/lib/datos/servidor';

/**
 * Layout de las secciones de contenido.
 *
 * Usa el mismo armazón que el panel de control —barra lateral y
 * cabecera con búsqueda— para que la navegación sea coherente en toda
 * la plataforma.
 *
 * El visor territorial (`/explorar`) vive fuera de este grupo porque
 * ocupa toda la pantalla y gestiona sus propios controles.
 */
export default function LayoutSitio({ children }: { children: React.ReactNode }) {
  const catalogo = obtenerCatalogo();
  const resumen = obtenerResumen();

  return (
    <DisposicionApp catalogo={catalogo} fechaDatos={resumen.fechaActualizacion}>
      <main id="contenido-principal" className="flex-1">
        {children}
      </main>
      <PiePagina />
    </DisposicionApp>
  );
}
