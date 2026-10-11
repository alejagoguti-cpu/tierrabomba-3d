'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { RUTAS } from '@/lib/rutas';
import { cn } from '@/lib/utils';

/**
 * Barra de navegación principal.
 * En móvil se convierte en un panel desplegable. Marca la ruta activa
 * con `aria-current` para que los lectores de pantalla la identifiquen.
 */
export function BarraNavegacion() {
  const rutaActual = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [conFondo, setConFondo] = useState(false);

  // Cerrar el menú al cambiar de ruta
  useEffect(() => {
    setAbierto(false);
  }, [rutaActual]);

  // Fondo sólido al hacer scroll, para que el texto siga legible
  useEffect(() => {
    const alScroll = () => setConFondo(window.scrollY > 24);
    alScroll();
    window.addEventListener('scroll', alScroll, { passive: true });
    return () => window.removeEventListener('scroll', alScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        conFondo || abierto
          ? 'border-b border-hueso-100/10 bg-oceano-950/90 backdrop-blur-lg'
          : 'border-b border-transparent'
      )}
    >
      <nav
        className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6"
        aria-label="Navegación principal"
      >
        <Link
          href="/"
          className="group flex items-baseline gap-2"
          aria-label="TIERRA BOMBA 3D, ir al inicio"
        >
          <span className="font-display text-[0.9375rem] font-semibold tracking-tight text-hueso-100">
            TIERRA BOMBA
          </span>
          <span className="dato-mono text-turquesa-500">3D</span>
        </Link>

        {/* Navegación de escritorio */}
        <ul className="hidden items-center gap-1 lg:flex">
          {RUTAS.map((r) => {
            const activa = rutaActual === r.href || rutaActual.startsWith(`${r.href}/`);
            return (
              <li key={r.href}>
                <Link
                  href={r.href}
                  aria-current={activa ? 'page' : undefined}
                  className={cn(
                    'relative rounded-md px-3 py-1.5 text-[0.8125rem] transition',
                    activa
                      ? 'text-hueso-100'
                      : 'text-grafito-400 hover:bg-hueso-100/[0.06] hover:text-hueso-200'
                  )}
                >
                  {r.titulo}
                  {activa && (
                    <span
                      className="absolute inset-x-3 -bottom-px h-px bg-turquesa-500"
                      aria-hidden
                    />
                  )}
                  {r.estado === 'en-desarrollo' && (
                    <span
                      className="ml-1 inline-block size-1 rounded-full bg-pendiente align-middle"
                      title="Módulo en desarrollo"
                      aria-label="Módulo en desarrollo"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Botón de menú móvil */}
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="menu-movil"
          className="rounded-md p-2 text-hueso-200 transition hover:bg-hueso-100/10 lg:hidden"
        >
          {abierto ? <X className="size-5" /> : <Menu className="size-5" />}
          <span className="sr-only">{abierto ? 'Cerrar el menú' : 'Abrir el menú'}</span>
        </button>
      </nav>

      {/* Menú móvil */}
      {abierto && (
        <div id="menu-movil" className="border-t border-hueso-100/10 lg:hidden">
          <ul className="mx-auto max-w-7xl px-2 py-2">
            {RUTAS.map((r) => {
              const activa = rutaActual === r.href;
              return (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    aria-current={activa ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition',
                      activa
                        ? 'bg-hueso-100/[0.08] text-hueso-100'
                        : 'text-grafito-400 hover:bg-hueso-100/[0.05] hover:text-hueso-200'
                    )}
                  >
                    <span>{r.titulo}</span>
                    {r.estado === 'en-desarrollo' && (
                      <span className="dato-mono text-pendiente">en desarrollo</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </header>
  );
}
