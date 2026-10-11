'use client';

/**
 * Panel de capas del visor.
 * Agrupa las capas por categoría y muestra, para cada una, su leyenda,
 * su fuente, su fecha de descarga y su estado de validación.
 */

import {
  Building2,
  Droplets,
  Eye,
  EyeOff,
  Hospital,
  LandPlot,
  Layers,
  Leaf,
  Map as MapIcon,
  Route,
  ShieldCheck,
  X,
} from 'lucide-react';
import { CATEGORIAS, ETIQUETA_ESTADO, type DefinicionCapa, type IdCategoria } from '@/lib/catalogo';
import { cn } from '@/lib/utils';

const ICONOS: Record<IdCategoria, typeof MapIcon> = {
  territorio: MapIcon,
  catastro: ShieldCheck,
  equipamientos: Hospital,
  movilidad: Route,
  ambiente: Leaf,
  construccion: Building2,
};

/** Icono por capa concreta, para distinguirlas dentro de la categoría. */
const ICONO_CAPA: Record<string, typeof MapIcon> = {
  'limite-isla': MapIcon,
  'usos-suelo': Layers,
  'catastro-construccion': Building2,
  'catastro-predios': LandPlot,
  'catastro-vias': Route,
  'catastro-manzanas': Layers,
  'catastro-barrios': MapIcon,
  'catastro-veredas': Leaf,
  'catastro-sectores': LandPlot,
  'catastro-unidades': Building2,
  edificaciones: Building2,
  equipamientos: Hospital,
  vias: Route,
  natural: Leaf,
  hidrografia: Droplets,
};

interface Props {
  catalogo: DefinicionCapa[];
  visibles: Set<string>;
  alAlternar: (id: string) => void;
  alSoloEsta: (id: string) => void;
  alCerrar: () => void;
}

export function PanelCapas({ catalogo, visibles, alAlternar, alSoloEsta, alCerrar }: Props) {
  const totalVisibles = visibles.size;

  return (
    <aside className="panel flex h-full flex-col overflow-hidden" aria-label="Capas del mapa">
      {/* Cabecera */}
      <header className="flex items-start justify-between gap-2 border-b border-hueso-100/10 px-4 py-3">
        <div>
          <h2 className="font-display text-base leading-tight text-hueso-100">Capas</h2>
          <p className="dato-mono mt-0.5 text-grafito-400">
            {totalVisibles} de {catalogo.length} activas
          </p>
        </div>
        <button
          type="button"
          onClick={alCerrar}
          className="rounded-md p-1.5 text-grafito-400 transition hover:bg-hueso-100/10 hover:text-hueso-100 md:hidden"
          aria-label="Cerrar el panel de capas"
        >
          <X className="size-4" />
        </button>
      </header>

      {/* Lista de categorías */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {CATEGORIAS.map((categoria) => {
          const capas = catalogo.filter((c) => c.categoria === categoria.id);
          if (!capas.length) return null;
          const Icono = ICONOS[categoria.id];

          return (
            <section key={categoria.id} className="mb-4 last:mb-1">
              <div className="flex items-center gap-2 px-2 pb-1.5">
                <Icono className="size-3.5 text-turquesa-500" aria-hidden />
                <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-hueso-200">
                  {categoria.titulo}
                </h3>
              </div>

              <ul className="space-y-0.5">
                {capas.map((capa) => {
                  const activa = visibles.has(capa.id);
                  const IconoCapa = ICONO_CAPA[capa.id] ?? Layers;
                  const sinDatos = capa.entidades === undefined;

                  return (
                    <li key={capa.id}>
                      <div
                        className={cn(
                          'group rounded-lg px-2 py-2 transition',
                          activa ? 'bg-hueso-100/[0.06]' : 'hover:bg-hueso-100/[0.04]'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={activa}
                            onClick={() => alAlternar(capa.id)}
                            className="mt-0.5 shrink-0 rounded p-0.5"
                            aria-label={`${activa ? 'Ocultar' : 'Mostrar'} la capa ${capa.titulo}`}
                          >
                            {activa ? (
                              <Eye className="size-4 text-turquesa-400" />
                            ) : (
                              <EyeOff className="size-4 text-grafito-500" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="size-2.5 shrink-0 rounded-sm ring-1 ring-inset ring-white/25"
                                style={{ backgroundColor: capa.color }}
                                aria-hidden
                              />
                              <span
                                className={cn(
                                  'truncate text-[0.8125rem] leading-tight',
                                  activa ? 'text-hueso-100' : 'text-grafito-400'
                                )}
                              >
                                {capa.titulo}
                              </span>
                              <IconoCapa
                                className="ml-auto size-3 shrink-0 text-grafito-500"
                                aria-hidden
                              />
                            </div>

                            <p className="dato-mono mt-0.5 text-grafito-500">
                              {sinDatos ? (
                                <span className="text-pendiente">Sin datos descargados</span>
                              ) : (
                                <>
                                  {capa.entidades?.toLocaleString('es-CO')} entidades
                                  {capa.fechaDescarga ? ` · ${capa.fechaDescarga}` : ''}
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Acciones secundarias, visibles al pasar el ratón o enfocar */}
                        <div className="mt-1.5 flex items-center gap-2 pl-6 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={() => alSoloEsta(capa.id)}
                            className="dato-mono text-grafito-400 underline decoration-dotted underline-offset-2 transition hover:text-turquesa-400"
                          >
                            Solo esta
                          </button>
                          <a
                            href={capa.fuenteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dato-mono text-grafito-400 underline decoration-dotted underline-offset-2 transition hover:text-turquesa-400"
                          >
                            Fuente
                          </a>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Pie con la atribución obligatoria */}
      <footer className="border-t border-hueso-100/10 px-4 py-2.5">
        <p className="text-[0.625rem] leading-relaxed text-grafito-500">
          Datos vectoriales:{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="text-turquesa-400 underline decoration-dotted underline-offset-2"
          >
            © OpenStreetMap contributors
          </a>{' '}
          (ODbL 1.0). Elevación: AWS Terrain Tiles. Base: OpenFreeMap.
        </p>
      </footer>
    </aside>
  );
}
