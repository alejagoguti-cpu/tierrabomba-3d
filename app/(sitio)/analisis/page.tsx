import type { Metadata } from 'next';
import { PanelAnalisis } from '@/components/analisis/PanelAnalisis';
import { calcularAnalisis } from '@/lib/datos/analisis';

export const metadata: Metadata = {
  title: 'Análisis territorial',
  description:
    'Análisis territorial de Tierra Bomba calculado sobre datos reales: distribución de superficies, accesibilidad y ocupación del suelo.',
};

/**
 * Análisis territorial.
 *
 * Todo el cálculo ocurre en tiempo de compilación: distancias con
 * haversine y pertenencia a polígono con lanzamiento de rayo sobre las
 * 2.714 construcciones. El navegador solo recibe los resultados.
 */
export default function PaginaAnalisis() {
  const analisis = calcularAnalisis();
  return <PanelAnalisis analisis={analisis} />;
}
