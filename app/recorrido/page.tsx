import type { Metadata } from 'next';
import { BarraNavegacion } from '@/components/layout/BarraNavegacion';
import { PortadaNarrativa } from '@/components/inicio/PortadaNarrativa';
import { obtenerCatalogo, obtenerResumen } from '@/lib/datos/servidor';

export const metadata: Metadata = {
  title: 'Recorrido narrativo',
  description:
    'Recorrido guiado por la isla de Tierra Bomba: del contexto geográfico al borde costero, con la cámara y las capas activándose a lo largo del scroll.',
};

/**
 * Portada narrativa. Vivía en la raíz, pero la raíz es ahora el panel
 * de control: el recorrido se conserva aquí como experiencia de
 * introducción.
 */
export default function PaginaRecorrido() {
  return (
    <>
      <BarraNavegacion />
      <main id="contenido-principal">
        <PortadaNarrativa catalogo={obtenerCatalogo()} resumen={obtenerResumen()} />
      </main>
    </>
  );
}
