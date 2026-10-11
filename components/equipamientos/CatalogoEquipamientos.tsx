'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, MapPin, Store } from 'lucide-react';
import type { CatalogoEquipamientos, IdCategoriaEquipamiento } from '@/lib/datos/equipamientos';
import { cn, coordenadas, numero } from '@/lib/utils';

/**
 * Catálogo de equipamientos.
 *
 * El mensaje principal de esta página no es la lista —son nueve
 * comercios— sino la ADVERTENCIA: las categorías de salud, educación,
 * cultura, deporte e institucional no tienen ni un solo elemento
 * cartografiado. Se dice en grande, no en letra pequeña.
 */
export function CatalogoEquipamientos({ catalogo }: { catalogo: CatalogoEquipamientos }) {
  const [filtro, setFiltro] = useState<IdCategoriaEquipamiento | 'todas'>('todas');

  const visibles = useMemo(
    () => (filtro === 'todas' ? catalogo.fichas : catalogo.fichas.filter((f) => f.categoria === filtro)),
    [catalogo.fichas, filtro]
  );

  const conNombre = catalogo.fichas.filter((f) => f.nombre).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="max-w-3xl">
        <p className="dato-mono text-turquesa-500 uppercase tracking-[0.18em]">OpenStreetMap</p>
        <h1 className="mt-2 font-display text-titulo text-hueso-100">Equipamientos</h1>
        <p className="mt-3 text-base leading-relaxed text-grafito-400">
          Equipamientos comunitarios y servicios cartografiados en la isla de Tierra Bomba por la
          comunidad de OpenStreetMap.
        </p>
      </header>

      {/* La advertencia va primero, y en grande */}
      <section className="mt-6 flex gap-4 rounded-xl border border-pendiente/35 bg-pendiente/[0.08] p-5">
        <AlertTriangle className="mt-0.5 size-6 shrink-0 text-pendiente" aria-hidden />
        <div>
          <h2 className="font-display text-lg text-arena-300">
            Este inventario está prácticamente vacío, y eso es un hallazgo
          </h2>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-grafito-400">
            De los {numero(catalogo.fichas.length)} elementos localizados,{' '}
            <strong className="text-hueso-200">todos son comercio</strong>: supermercados, una
            ferretería y una verdulería. Las consultas de <strong>salud, educación, cultura,
            deporte, culto e institucional</strong> no devolvieron ni un solo registro.
          </p>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-grafito-400">
            Eso <strong className="text-hueso-200">no significa que no existan</strong>: significa
            que nadie los ha cartografiado. Un colegio o un puesto de salud no aparecen aquí
            porque la comunidad no los ha registrado, no porque la isla carezca de ellos.
          </p>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-grafito-500">
            Para un inventario fiable hace falta el listado oficial de la Alcaldía de Cartagena o
            trabajo de campo. La plataforma está preparada para incorporarlo.
          </p>
        </div>
      </section>

      {/* Reparto por categoría */}
      <section className="mt-6" aria-label="Reparto por categoría">
        <h2 className="mb-2.5 text-[0.8125rem] font-semibold uppercase tracking-wider text-hueso-200">
          Reparto por categoría
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {catalogo.porCategoria.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFiltro(filtro === c.id ? 'todas' : c.id)}
              aria-pressed={filtro === c.id}
              className={cn(
                'rounded-lg border p-3.5 text-left transition',
                filtro === c.id
                  ? 'border-turquesa-500/50 bg-turquesa-500/[0.08]'
                  : 'border-hueso-100/10 bg-oceano-900/50 hover:border-hueso-100/25'
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-sm ring-1 ring-inset ring-white/20"
                  style={{ backgroundColor: c.color }}
                  aria-hidden
                />
                <span className="text-[0.6875rem] leading-tight text-grafito-400">{c.etiqueta}</span>
              </div>
              <p className="mt-1.5 font-display text-xl leading-none text-hueso-100">
                {c.cantidad}
              </p>
            </button>
          ))}
        </div>

        {catalogo.vacias.length > 0 && (
          <p className="mt-3 text-[0.75rem] leading-relaxed text-grafito-500">
            <strong className="text-pendiente">Sin ningún registro:</strong>{' '}
            {catalogo.vacias.map((v) => v.etiqueta).join(' · ')}
          </p>
        )}
      </section>

      {/* Listado */}
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl text-hueso-100">
            {filtro === 'todas'
              ? 'Todos los equipamientos'
              : catalogo.porCategoria.find((c) => c.id === filtro)?.etiqueta}
          </h2>
          <span className="dato-mono text-grafito-400">
            {numero(visibles.length)} elementos · {numero(conNombre)} con nombre registrado
          </span>
        </div>

        <ul className="space-y-2">
          {visibles.map((f) => {
            const categoria = catalogo.porCategoria.find((c) => c.id === f.categoria);
            return (
              <li
                key={f.id}
                className="flex flex-wrap items-start gap-3 rounded-lg border border-hueso-100/10 bg-oceano-900/40 p-3.5"
              >
                <span
                  className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md"
                  style={{ backgroundColor: `color-mix(in oklab, ${categoria?.color ?? '#6B7A83'} 25%, transparent)` }}
                >
                  <Store className="size-4" style={{ color: categoria?.color ?? '#6B7A83' }} aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] text-hueso-100">
                    {f.nombre ?? (
                      <span className="italic text-grafito-500">Sin nombre registrado</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[0.75rem] text-grafito-400">
                    {f.tipoLegible}
                    {f.direccion && ` · ${f.direccion}`}
                  </p>
                  <p className="dato-mono mt-1 flex items-center gap-1.5 text-grafito-500">
                    <MapPin className="size-3" aria-hidden />
                    {coordenadas(f.longitude, f.latitude)}
                  </p>
                </div>

                {f.osmTipo && f.osmId && (
                  <a
                    href={`https://www.openstreetmap.org/${f.osmTipo}/${f.osmId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dato-mono inline-flex shrink-0 items-center gap-1 rounded-md bg-hueso-100/10 px-2.5 py-1.5 text-grafito-400 transition hover:bg-hueso-100/20 hover:text-hueso-200"
                  >
                    <ExternalLink className="size-3" aria-hidden />
                    OSM
                  </a>
                )}
              </li>
            );
          })}
        </ul>

        {!visibles.length && (
          <p className="rounded-lg border border-hueso-100/10 px-4 py-8 text-center text-grafito-500">
            Ningún equipamiento en esta categoría.
          </p>
        )}
      </section>

      {/* Procedencia */}
      <section className="mt-8 rounded-lg border border-hueso-100/10 bg-oceano-900/40 p-5">
        <h2 className="text-sm font-semibold text-hueso-200">Procedencia</h2>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-grafito-400">
          Fuente: <strong className="text-hueso-200">{catalogo.fuente}</strong>, vía Overpass API.
          Licencia ODbL 1.0. Atribución obligatoria:{' '}
          <strong className="text-hueso-200">© OpenStreetMap contributors</strong>.
          {catalogo.fecha && ` Descarga: ${catalogo.fecha}.`}
        </p>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-grafito-400">
          La descarga se hace por categorías independientes porque el servidor público de Overpass
          se satura con frecuencia. En la última ejecución, tres de las seis consultas fallaron por
          tiempo de espera: los resultados que sí llegaron se conservan, y las categorías que
          quedaron sin respuesta aparecen vacías aquí.
        </p>
      </section>
    </div>
  );
}
