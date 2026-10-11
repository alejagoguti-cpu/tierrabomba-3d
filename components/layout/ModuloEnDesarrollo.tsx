import Link from 'next/link';
import { ArrowRight, Database, FileText } from 'lucide-react';

/**
 * Página de módulo en desarrollo.
 *
 * DECISIÓN DE DISEÑO
 *   No se simula funcionalidad que no existe. En lugar de mostrar
 *   controles falsos, esta página declara con precisión:
 *     - qué hará el módulo
 *     - qué datos necesita
 *     - qué hay disponible hoy y qué no
 *     - a dónde ir mientras tanto
 *
 *   Es la alternativa honesta a un botón decorativo.
 */
interface Props {
  titulo: string;
  descripcion: string;
  /** Lo que el módulo hará cuando esté terminado. */
  funciones: string[];
  /** Datos que se necesitan y su estado actual. */
  datosRequeridos: Array<{ nombre: string; estado: 'disponible' | 'parcial' | 'pendiente'; nota: string }>;
  /** Ruta y nombre de la sección que sí funciona y se parece más. */
  alternativa?: { href: string; titulo: string };
}

const COLOR_ESTADO = {
  disponible: 'text-verificado',
  parcial: 'text-pendiente',
  pendiente: 'text-grafito-400',
} as const;

const TEXTO_ESTADO = {
  disponible: 'Disponible',
  parcial: 'Parcial',
  pendiente: 'Pendiente',
} as const;

export function ModuloEnDesarrollo({
  titulo,
  descripcion,
  funciones,
  datosRequeridos,
  alternativa,
}: Props) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="dato-mono text-pendiente uppercase tracking-[0.18em]">
        Módulo en desarrollo
      </p>
      <h1 className="mt-3 font-display text-titulo text-hueso-100">{titulo}</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-grafito-400">{descripcion}</p>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        {/* Funciones previstas */}
        <section className="panel p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="size-4 text-turquesa-500" aria-hidden />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-hueso-200">
              Qué hará este módulo
            </h2>
          </div>
          <ul className="space-y-2">
            {funciones.map((f) => (
              <li key={f} className="flex gap-2 text-[0.8125rem] leading-relaxed text-grafito-400">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-turquesa-500" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </section>

        {/* Estado de los datos */}
        <section className="panel p-5">
          <div className="mb-3 flex items-center gap-2">
            <Database className="size-4 text-turquesa-500" aria-hidden />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-hueso-200">
              Datos necesarios
            </h2>
          </div>
          <ul className="space-y-3">
            {datosRequeridos.map((d) => (
              <li key={d.nombre}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.8125rem] text-hueso-100">{d.nombre}</span>
                  <span className={`dato-mono shrink-0 ${COLOR_ESTADO[d.estado]}`}>
                    {TEXTO_ESTADO[d.estado]}
                  </span>
                </div>
                <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-grafito-500">{d.nota}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Alternativa funcional */}
      {alternativa && (
        <div className="mt-8 rounded-lg border border-turquesa-500/25 bg-turquesa-500/[0.06] p-5">
          <p className="text-[0.8125rem] leading-relaxed text-hueso-200">
            Mientras tanto, esta información ya está disponible en otra sección de la plataforma.
          </p>
          <Link
            href={alternativa.href}
            className="group mt-3 inline-flex items-center gap-2 text-sm font-semibold text-turquesa-400 transition hover:text-turquesa-300"
          >
            {alternativa.titulo}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}

      <p className="mt-8 text-[0.75rem] leading-relaxed text-grafito-500">
        Esta plataforma no simula funciones que aún no existen. Si un módulo aparece aquí es porque
        le faltan datos verificables o desarrollo, y se indica exactamente qué falta.
      </p>
    </div>
  );
}
