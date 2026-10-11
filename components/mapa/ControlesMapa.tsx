'use client';

/**
 * Controles del visor: modo 2D/3D, estilo base, medición, encuadre y
 * gestión de vistas guardadas.
 *
 * Todas las acciones son funcionales; no hay botones decorativos.
 * Las vistas se guardan en localStorage del navegador, porque la
 * plataforma es un sitio estático sin servidor.
 */

import { useEffect, useState } from 'react';
import {
  Bookmark,
  BookmarkPlus,
  Box,
  Check,
  Map as MapIcon,
  Maximize2,
  PanelLeft,
  Ruler,
  Scan,
  Trash2,
  X,
} from 'lucide-react';
import { ESTILOS_BASE } from '@/lib/geo/estilos';
import { area as formatearArea, cn, longitud as formatearLongitud } from '@/lib/utils';
import type { ModoHerramienta, ResultadoMedicion } from './tipos';

export interface VistaGuardada {
  nombre: string;
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
  capas: string[];
  fecha: string;
}

interface Props {
  modo3d: boolean;
  alCambiarModo3d: (v: boolean) => void;
  estiloBase: string;
  alCambiarEstilo: (id: string) => void;
  herramienta: ModoHerramienta;
  alCambiarHerramienta: (h: ModoHerramienta) => void;
  medicion: ResultadoMedicion | null;
  alLimpiarMedicion: () => void;
  alGuardarVista: (nombre: string) => void;
  alRestaurarVista: (v: VistaGuardada) => void;
  alEncuadrar: () => void;
  pendienteTerreno: boolean;
  alAbrirPanel: () => void;
}

const CLAVE_VISTAS = 'tb3d:vistas';

export function ControlesMapa({
  modo3d,
  alCambiarModo3d,
  estiloBase,
  alCambiarEstilo,
  herramienta,
  alCambiarHerramienta,
  medicion,
  alLimpiarMedicion,
  alGuardarVista,
  alRestaurarVista,
  alEncuadrar,
  pendienteTerreno,
  alAbrirPanel,
}: Props) {
  const [vistas, setVistas] = useState<VistaGuardada[]>([]);
  const [panelVistas, setPanelVistas] = useState(false);
  const [nombreVista, setNombreVista] = useState('');
  const [guardado, setGuardado] = useState(false);

  // Cargar vistas guardadas al montar
  useEffect(() => {
    try {
      setVistas(JSON.parse(localStorage.getItem(CLAVE_VISTAS) ?? '[]'));
    } catch {
      setVistas([]);
    }
  }, []);

  const recargarVistas = () => {
    try {
      setVistas(JSON.parse(localStorage.getItem(CLAVE_VISTAS) ?? '[]'));
    } catch {
      setVistas([]);
    }
  };

  const guardar = () => {
    const nombre = nombreVista.trim() || `Vista ${vistas.length + 1}`;
    alGuardarVista(nombre);
    setNombreVista('');
    setGuardado(true);
    recargarVistas();
    window.setTimeout(() => setGuardado(false), 1600);
  };

  const borrar = (fecha: string) => {
    const siguientes = vistas.filter((v) => v.fecha !== fecha);
    try {
      localStorage.setItem(CLAVE_VISTAS, JSON.stringify(siguientes));
    } catch {
      // Sin almacenamiento: la lista simplemente no persiste
    }
    setVistas(siguientes);
  };

  const midiendo = herramienta !== 'navegar';

  return (
    <>
      {/* Barra superior derecha */}
      <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-2">
        <div className="panel flex items-center gap-1 p-1">
          {/* Abrir panel de capas en móvil */}
          <button
            type="button"
            onClick={alAbrirPanel}
            className="rounded-md p-2 text-hueso-200 transition hover:bg-hueso-100/10 md:hidden"
            aria-label="Abrir el panel de capas"
          >
            <PanelLeft className="size-4" />
          </button>

          {/* Modo 2D / 3D */}
          <div className="flex items-center rounded-md bg-oceano-950/50 p-0.5">
            <button
              type="button"
              onClick={() => alCambiarModo3d(false)}
              aria-pressed={!modo3d}
              className={cn(
                'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[0.6875rem] font-medium transition',
                !modo3d ? 'bg-hueso-100/15 text-hueso-100' : 'text-grafito-400 hover:text-hueso-200'
              )}
            >
              <MapIcon className="size-3.5" aria-hidden />
              2D
            </button>
            <button
              type="button"
              onClick={() => alCambiarModo3d(true)}
              aria-pressed={modo3d}
              className={cn(
                'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[0.6875rem] font-medium transition',
                modo3d ? 'bg-hueso-100/15 text-hueso-100' : 'text-grafito-400 hover:text-hueso-200'
              )}
            >
              <Box className="size-3.5" aria-hidden />
              3D
            </button>
          </div>

          <span className="mx-0.5 h-5 w-px bg-hueso-100/10" aria-hidden />

          {/* Medición */}
          <button
            type="button"
            onClick={() => alCambiarHerramienta(midiendo && herramienta === 'medir-distancia' ? 'navegar' : 'medir-distancia')}
            aria-pressed={herramienta === 'medir-distancia'}
            title="Medir distancia"
            className={cn(
              'rounded-md p-2 transition',
              herramienta === 'medir-distancia'
                ? 'bg-turquesa-500/25 text-turquesa-300'
                : 'text-hueso-200 hover:bg-hueso-100/10'
            )}
          >
            <Ruler className="size-4" aria-hidden />
            <span className="sr-only">Medir distancia</span>
          </button>
          <button
            type="button"
            onClick={() => alCambiarHerramienta(midiendo && herramienta === 'medir-area' ? 'navegar' : 'medir-area')}
            aria-pressed={herramienta === 'medir-area'}
            title="Medir área"
            className={cn(
              'rounded-md p-2 transition',
              herramienta === 'medir-area'
                ? 'bg-turquesa-500/25 text-turquesa-300'
                : 'text-hueso-200 hover:bg-hueso-100/10'
            )}
          >
            <Scan className="size-4" aria-hidden />
            <span className="sr-only">Medir área</span>
          </button>

          <span className="mx-0.5 h-5 w-px bg-hueso-100/10" aria-hidden />

          {/* Encuadrar */}
          <button
            type="button"
            onClick={alEncuadrar}
            title="Encuadrar la isla"
            className="rounded-md p-2 text-hueso-200 transition hover:bg-hueso-100/10"
          >
            <Maximize2 className="size-4" aria-hidden />
            <span className="sr-only">Encuadrar la isla</span>
          </button>

          {/* Vistas guardadas */}
          <button
            type="button"
            onClick={() => setPanelVistas((v) => !v)}
            aria-expanded={panelVistas}
            title="Vistas guardadas"
            className={cn(
              'rounded-md p-2 transition',
              panelVistas ? 'bg-turquesa-500/25 text-turquesa-300' : 'text-hueso-200 hover:bg-hueso-100/10'
            )}
          >
            <Bookmark className="size-4" aria-hidden />
            <span className="sr-only">Vistas guardadas</span>
          </button>
        </div>

        {/* Panel de vistas guardadas */}
        {panelVistas && (
          <div className="panel w-72 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[0.75rem] font-semibold uppercase tracking-wider text-hueso-200">
                Vistas guardadas
              </h3>
              <button
                type="button"
                onClick={() => setPanelVistas(false)}
                className="rounded p-1 text-grafito-400 hover:text-hueso-100"
                aria-label="Cerrar"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={nombreVista}
                onChange={(e) => setNombreVista(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && guardar()}
                placeholder="Nombre de la vista"
                className="min-w-0 flex-1 rounded-md border border-hueso-100/15 bg-oceano-950/60 px-2.5 py-1.5 text-[0.75rem] text-hueso-100 placeholder:text-grafito-500 focus:border-turquesa-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={guardar}
                className="shrink-0 rounded-md bg-turquesa-500/20 px-2.5 py-1.5 text-turquesa-300 transition hover:bg-turquesa-500/30"
                title="Guardar la vista actual"
              >
                {guardado ? <Check className="size-4" /> : <BookmarkPlus className="size-4" />}
              </button>
            </div>

            <p className="mt-2 text-[0.625rem] leading-relaxed text-grafito-500">
              Se guardan en este navegador: posición, inclinación y capas activas.
            </p>

            {vistas.length > 0 && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {vistas.map((v) => (
                  <li key={v.fecha} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => alRestaurarVista(v)}
                      className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-[0.75rem] text-hueso-200 transition hover:bg-hueso-100/10"
                    >
                      {v.nombre}
                      <span className="dato-mono ml-2 text-grafito-500">
                        {v.capas.length} capas
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => borrar(v.fecha)}
                      className="shrink-0 rounded p-1 text-grafito-500 transition hover:text-red-400"
                      aria-label={`Borrar la vista ${v.nombre}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Selector de estilo base */}
        <div className="panel flex items-center gap-1 p-1">
          <span className="dato-mono px-2 text-grafito-400">BASE</span>
          {ESTILOS_BASE.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => alCambiarEstilo(e.id)}
              aria-pressed={estiloBase === e.id}
              className={cn(
                'rounded px-2 py-1 text-[0.6875rem] transition',
                estiloBase === e.id
                  ? 'bg-hueso-100/15 text-hueso-100'
                  : 'text-grafito-400 hover:text-hueso-200'
              )}
            >
              {e.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Aviso de medición activa */}
      {midiendo && (
        <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2">
          <div className="panel flex items-center gap-3 px-4 py-2">
            <span className="text-[0.75rem] text-hueso-200">
              {herramienta === 'medir-distancia'
                ? 'Haz clic para trazar la distancia'
                : 'Haz clic para delimitar el área'}
            </span>
            {medicion && medicion.puntos.length > 0 && (
              <span className="dato-mono text-turquesa-300">
                {medicion.distanciaM !== undefined && formatearLongitud(medicion.distanciaM)}
                {medicion.areaM2 !== undefined && formatearArea(medicion.areaM2)}
                {medicion.areaM2 !== undefined && medicion.perimetroM !== undefined && (
                  <> · perímetro {formatearLongitud(medicion.perimetroM)}</>
                )}
              </span>
            )}
            <button
              type="button"
              onClick={alLimpiarMedicion}
              className="dato-mono text-grafito-400 underline decoration-dotted underline-offset-2 hover:text-hueso-200"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => alCambiarHerramienta('navegar')}
              className="rounded p-1 text-grafito-400 hover:text-hueso-100"
              aria-label="Salir del modo medición"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Aviso cuando el terreno no está disponible */}
      {pendienteTerreno && modo3d && (
        <div className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2">
          <div className="panel px-4 py-2">
            <p className="text-[0.6875rem] text-arena-300">
              El relieve no está disponible en este navegador. Las capas siguen funcionando.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
