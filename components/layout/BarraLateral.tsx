'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building2,
  Database,
  Home,
  Hospital,
  Leaf,
  Map as MapIcon,
  MessageSquare,
  Route as RouteIcon,
  DraftingCompass,
} from 'lucide-react';
import { RUTAS } from '@/lib/rutas';
import { cn } from '@/lib/utils';

/** Icono de cada sección. */
const ICONOS: Record<string, typeof Home> = {
  '/explorar': MapIcon,
  '/equipamientos': Hospital,
  '/construcciones': Building2,
  '/proyectos': DraftingCompass,
  '/ambiente': Leaf,
  '/analisis': BarChart3,
  '/participa': MessageSquare,
  '/datos': Database,
};

/**
 * Barra lateral de navegación.
 *
 * Se oculta en móvil (donde manda la cabecera con menú) y se muestra
 * fija a partir de `lg`. Marca la ruta activa con `aria-current`.
 */
export function BarraLateral() {
  const rutaActual = usePathname();

  return (
    <aside
      className="hidden w-56 shrink-0 flex-col border-r border-hueso-100/10 bg-oceano-900/60 lg:flex"
      aria-label="Navegación lateral"
    >
      {/* Marca */}
      <Link
        href="/"
        className="flex items-center gap-2.5 border-b border-hueso-100/10 px-5 py-4"
        aria-label="TIERRA BOMBA 3D, ir al panel"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-turquesa-500/15">
          <MapIcon className="size-4 text-turquesa-400" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[0.8125rem] font-semibold leading-tight text-hueso-100">
            TIERRA BOMBA
          </span>
          <span className="dato-mono block text-turquesa-500">3D</span>
        </span>
      </Link>

      {/* Secciones */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <Link
          href="/"
          aria-current={rutaActual === '/' ? 'page' : undefined}
          className={cn(
            'mb-1 flex items-center gap-2.5 rounded-md px-3 py-2 text-[0.8125rem] transition',
            rutaActual === '/'
              ? 'bg-turquesa-500/15 text-hueso-100'
              : 'text-grafito-400 hover:bg-hueso-100/[0.06] hover:text-hueso-200'
          )}
        >
          <Home className="size-4 shrink-0" aria-hidden />
          Panel
        </Link>

        <p className="dato-mono px-3 pb-1 pt-3 text-grafito-500">MÓDULOS</p>

        {RUTAS.map((r) => {
          const activa = rutaActual === r.href || rutaActual.startsWith(`${r.href}/`);
          const Icono = ICONOS[r.href] ?? MapIcon;
          return (
            <Link
              key={r.href}
              href={r.href}
              aria-current={activa ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-[0.8125rem] transition',
                activa
                  ? 'bg-turquesa-500/15 text-hueso-100'
                  : 'text-grafito-400 hover:bg-hueso-100/[0.06] hover:text-hueso-200'
              )}
            >
              <Icono className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{r.titulo}</span>
              {r.estado === 'en-desarrollo' && (
                <span
                  className="size-1.5 shrink-0 rounded-full bg-pendiente"
                  title="Módulo en desarrollo"
                  aria-label="Módulo en desarrollo"
                />
              )}
            </Link>
          );
        })}

        <p className="dato-mono px-3 pb-1 pt-4 text-grafito-500">RECORRIDO</p>
        <Link
          href="/recorrido"
          aria-current={rutaActual === '/recorrido' ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2.5 rounded-md px-3 py-2 text-[0.8125rem] transition',
            rutaActual === '/recorrido'
              ? 'bg-turquesa-500/15 text-hueso-100'
              : 'text-grafito-400 hover:bg-hueso-100/[0.06] hover:text-hueso-200'
          )}
        >
          <RouteIcon className="size-4 shrink-0" aria-hidden />
          Portada narrativa
        </Link>
      </nav>

      {/* Atribución obligatoria */}
      <div className="border-t border-hueso-100/10 px-4 py-3">
        <p className="text-[0.625rem] leading-relaxed text-grafito-500">
          © OpenStreetMap contributors (ODbL) · Catastro oficial de Cartagena · AWS Terrain ·
          OpenFreeMap
        </p>
      </div>
    </aside>
  );
}
