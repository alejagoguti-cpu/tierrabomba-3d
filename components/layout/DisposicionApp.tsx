'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { MapPin, Menu, Search, X } from 'lucide-react';
import { BarraLateral } from './BarraLateral';
import { RUTAS } from '@/lib/rutas';
import { AREA_ESTUDIO, type DefinicionCapa } from '@/lib/catalogo';
import { cn, formatearFecha } from '@/lib/utils';

/**
 * Armazón de la aplicación: barra lateral + cabecera + contenido.
 *
 * LA BÚSQUEDA ES REAL
 *   No es un adorno: indexa las secciones de la plataforma y las capas
 *   del catálogo, y navega al resultado. Si no hay coincidencias lo
 *   dice, en lugar de aparentar que busca.
 */
export function DisposicionApp({
  children,
  catalogo = [],
  fechaDatos,
}: {
  children: React.ReactNode;
  catalogo?: DefinicionCapa[];
  fechaDatos?: string | null;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [buscando, setBuscando] = useState(false);

  /** Índice de búsqueda: secciones + capas con datos. */
  const resultados = useMemo(() => {
    const q = consulta.trim().toLowerCase();
    if (q.length < 2) return { rutas: [], capas: [] };

    return {
      rutas: RUTAS.filter(
        (r) =>
          r.titulo.toLowerCase().includes(q) || r.descripcion.toLowerCase().includes(q)
      ).slice(0, 4),
      capas: catalogo
        .filter(
          (c) =>
            c.titulo.toLowerCase().includes(q) ||
            c.descripcion.toLowerCase().includes(q) ||
            c.fuente.toLowerCase().includes(q)
        )
        .slice(0, 6),
    };
  }, [consulta, catalogo]);

  const hayResultados = resultados.rutas.length > 0 || resultados.capas.length > 0;

  const cerrar = () => {
    setBuscando(false);
    setConsulta('');
  };

  return (
    <div className="flex min-h-dvh">
      <BarraLateral />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera */}
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-hueso-100/10 bg-oceano-950/90 px-3 backdrop-blur-lg sm:px-5">
          {/* Menú móvil */}
          <div className="relative lg:hidden">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-expanded={menuAbierto}
              aria-controls="menu-lateral-movil"
              className="rounded-md p-2 text-hueso-200 transition hover:bg-hueso-100/10"
            >
              {menuAbierto ? <X className="size-5" /> : <Menu className="size-5" />}
              <span className="sr-only">{menuAbierto ? 'Cerrar menú' : 'Abrir menú'}</span>
            </button>

            {menuAbierto && (
              <nav
                id="menu-lateral-movil"
                className="panel absolute left-0 top-12 z-50 w-60 p-2"
                aria-label="Navegación"
              >
                <Link
                  href="/"
                  onClick={() => setMenuAbierto(false)}
                  className="block rounded-md px-3 py-2 text-[0.8125rem] text-grafito-400 hover:bg-hueso-100/[0.06] hover:text-hueso-200"
                >
                  Panel
                </Link>
                {RUTAS.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    onClick={() => setMenuAbierto(false)}
                    className="flex items-center justify-between rounded-md px-3 py-2 text-[0.8125rem] text-grafito-400 hover:bg-hueso-100/[0.06] hover:text-hueso-200"
                  >
                    {r.titulo}
                    {r.estado === 'en-desarrollo' && (
                      <span className="size-1.5 rounded-full bg-pendiente" aria-hidden />
                    )}
                  </Link>
                ))}
                <Link
                  href="/recorrido"
                  onClick={() => setMenuAbierto(false)}
                  className="block rounded-md px-3 py-2 text-[0.8125rem] text-grafito-400 hover:bg-hueso-100/[0.06] hover:text-hueso-200"
                >
                  Portada narrativa
                </Link>
              </nav>
            )}
          </div>

          {/* Búsqueda real */}
          <div className="relative min-w-0 flex-1 max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-grafito-500"
              aria-hidden
            />
            <input
              type="search"
              value={consulta}
              onChange={(e) => {
                setConsulta(e.target.value);
                setBuscando(true);
              }}
              onFocus={() => setBuscando(true)}
              onKeyDown={(e) => e.key === 'Escape' && cerrar()}
              placeholder="Buscar sección o capa…"
              aria-label="Buscar en la plataforma"
              className="w-full rounded-md border border-hueso-100/12 bg-oceano-900/70 py-2 pl-9 pr-3 text-[0.8125rem] text-hueso-100 placeholder:text-grafito-500 focus:border-turquesa-500 focus:outline-none"
            />

            {buscando && consulta.trim().length >= 2 && (
              <div className="panel absolute inset-x-0 top-11 z-50 max-h-80 overflow-y-auto p-1.5">
                {!hayResultados && (
                  <p className="px-3 py-3 text-[0.75rem] text-grafito-400">
                    Sin coincidencias para «{consulta}».
                  </p>
                )}

                {resultados.rutas.length > 0 && (
                  <>
                    <p className="dato-mono px-3 pb-1 pt-2 text-grafito-500">SECCIONES</p>
                    {resultados.rutas.map((r) => (
                      <Link
                        key={r.href}
                        href={r.href}
                        onClick={cerrar}
                        className="block rounded-md px-3 py-2 transition hover:bg-hueso-100/[0.07]"
                      >
                        <span className="block text-[0.8125rem] text-hueso-100">{r.titulo}</span>
                        <span className="block text-[0.6875rem] text-grafito-500">
                          {r.descripcion}
                        </span>
                      </Link>
                    ))}
                  </>
                )}

                {resultados.capas.length > 0 && (
                  <>
                    <p className="dato-mono px-3 pb-1 pt-3 text-grafito-500">CAPAS</p>
                    {resultados.capas.map((c) => (
                      <Link
                        key={c.id}
                        href="/explorar"
                        onClick={cerrar}
                        className="flex items-center gap-2 rounded-md px-3 py-2 transition hover:bg-hueso-100/[0.07]"
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-sm ring-1 ring-inset ring-white/25"
                          style={{ backgroundColor: c.color }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.8125rem] text-hueso-100">
                            {c.titulo}
                          </span>
                          <span className="block truncate text-[0.6875rem] text-grafito-500">
                            {c.fuente}
                            {c.entidades ? ` · ${c.entidades.toLocaleString('es-CO')}` : ''}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Área de estudio */}
            <span className="hidden items-center gap-1.5 rounded-md border border-hueso-100/12 px-2.5 py-1.5 sm:inline-flex">
              <MapPin className="size-3.5 text-turquesa-500" aria-hidden />
              <span className="dato-mono text-grafito-400">
                {AREA_ESTUDIO.municipio}
              </span>
            </span>

            {/* Fecha real de los datos */}
            <span className="hidden rounded-md border border-hueso-100/12 px-2.5 py-1.5 md:inline-block">
              <span className="dato-mono text-grafito-400">
                Datos: {fechaDatos ? formatearFecha(fechaDatos) : 'sin datos'}
              </span>
            </span>
          </div>
        </header>

        {/* Contenido */}
        <div className={cn('min-w-0 flex-1')}>{children}</div>
      </div>
    </div>
  );
}
