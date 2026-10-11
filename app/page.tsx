import { DisposicionApp } from '@/components/layout/DisposicionApp';
import { PanelControl } from '@/components/panel/PanelControl';
import { calcularAnalitica } from '@/lib/datos/analitica';
import { obtenerCatalogo, obtenerResumen } from '@/lib/datos/servidor';

/**
 * Panel de control. Es la portada de la plataforma.
 *
 * Las cifras se calculan en tiempo de compilación: el coste de Turf
 * (uniones y diferencias de polígonos) no llega nunca al navegador.
 */
export default function Inicio() {
  const catalogo = obtenerCatalogo();
  const resumen = obtenerResumen();
  const analitica = calcularAnalitica();

  return (
    <DisposicionApp catalogo={catalogo} fechaDatos={resumen.fechaActualizacion}>
      <main id="contenido-principal">
        <PanelControl catalogo={catalogo} analitica={analitica} />
      </main>
    </DisposicionApp>
  );
}
