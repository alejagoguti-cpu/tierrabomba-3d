import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, AlertTriangle, Droplets, Leaf, TreePine } from 'lucide-react';
import { calcularAnalitica } from '@/lib/datos/analitica';
import { obtenerCatalogo } from '@/lib/datos/servidor';
import { numero } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Ambiente',
  description:
    'Cobertura del suelo, elementos naturales e hidrografía de Tierra Bomba según OpenStreetMap, con sus limitaciones declaradas.',
};

/**
 * Análisis ambiental.
 *
 * Se apoya en el cálculo de cobertura del suelo de lib/datos/analitica.ts,
 * que resuelve los solapamientos con unión y diferencia de polígonos.
 * Sin ese paso, la vegetación salía al 91,9 % por doble conteo.
 */
export default function PaginaAmbiente() {
  const analitica = calcularAnalitica();
  const catalogo = obtenerCatalogo();

  const natural = catalogo.find((c) => c.id === 'natural');
  const hidro = catalogo.find((c) => c.id === 'hidrografia');
  const usos = catalogo.find((c) => c.id === 'usos-suelo');

  const { usoDelSuelo, superficies } = analitica;
  const islaKm2 = superficies.islaM2 ? superficies.islaM2 / 1e6 : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="max-w-3xl">
        <p className="dato-mono text-turquesa-500 uppercase tracking-[0.18em]">
          OpenStreetMap
        </p>
        <h1 className="mt-2 font-display text-titulo text-hueso-100">Ambiente</h1>
        <p className="mt-3 text-base leading-relaxed text-grafito-400">
          Cobertura del suelo, elementos naturales e hidrografía de la isla. Las superficies son
          netas: se calculan con unión y diferencia de polígonos para no contar dos veces las
          mismas hectáreas.
        </p>
      </header>

      {/* Cobertura del suelo */}
      <section className="mt-6">
        <h2 className="mb-2.5 text-[0.8125rem] font-semibold uppercase tracking-wider text-hueso-200">
          Cobertura del suelo
        </h2>

        {usoDelSuelo.length ? (
          <>
            {/* Barra apilada: una sola lectura de la composición */}
            <div
              className="flex h-3 w-full overflow-hidden rounded-full ring-1 ring-inset ring-white/10"
              role="img"
              aria-label={`Composición del suelo: ${usoDelSuelo
                .map((u) => `${u.clave} ${u.porcentaje.toFixed(1)} %`)
                .join(', ')}`}
            >
              {usoDelSuelo.map((u) => (
                <span
                  key={u.clave}
                  style={{ backgroundColor: u.color, width: `${u.porcentaje}%` }}
                  title={`${u.clave}: ${u.porcentaje.toFixed(1)} %`}
                />
              ))}
            </div>

            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {usoDelSuelo.map((u) => (
                <li
                  key={u.clave}
                  className="rounded-lg border border-hueso-100/10 bg-oceano-900/50 p-3.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-sm ring-1 ring-inset ring-white/20"
                      style={{ backgroundColor: u.color }}
                      aria-hidden
                    />
                    <span className="text-[0.75rem] text-grafito-400">{u.clave}</span>
                  </div>
                  <p className="mt-1.5 font-display text-xl leading-none text-hueso-100">
                    {u.porcentaje.toFixed(1)} %
                  </p>
                  <p className="dato-mono mt-1 text-grafito-500">
                    {numero(u.m2 / 1e6, 2)} km²
                  </p>
                </li>
              ))}
            </ul>

            {islaKm2 && (
              <p className="mt-3 text-[0.75rem] leading-relaxed text-grafito-500">
                Los porcentajes se calculan sobre la superficie insular completa ({numero(islaKm2, 2)}{' '}
                km²), no sobre lo cartografiado. Por eso «Sin clasificar» aparece como una categoría
                más y no se reparte entre las demás.
              </p>
            )}
          </>
        ) : (
          <p className="text-[0.8125rem] text-grafito-500">
            Sin datos de cobertura del suelo. Ejecuta <code className="dato-mono">npm run datos:osm</code>.
          </p>
        )}
      </section>

      {/* Capas ambientales */}
      <section className="mt-8">
        <h2 className="mb-2.5 text-[0.8125rem] font-semibold uppercase tracking-wider text-hueso-200">
          Capas ambientales
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <FichaCapa
            icono={<TreePine className="size-4" />}
            titulo="Elementos naturales"
            capa={natural}
            nota="Playas, vegetación, humedales y roquedos cartografiados."
          />
          <FichaCapa
            icono={<Droplets className="size-4" />}
            titulo="Hidrografía"
            capa={hidro}
            nota="Caños, cursos de agua, cuerpos de agua y varaderos."
          />
          <FichaCapa
            icono={<Leaf className="size-4" />}
            titulo="Usos del suelo"
            capa={usos}
            nota="Clasificación del suelo registrada por la comunidad."
          />
        </div>
      </section>

      {/* Limitaciones, en primer plano */}
      <section className="mt-8 flex gap-3 rounded-xl border border-pendiente/30 bg-pendiente/[0.07] p-5">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-pendiente" aria-hidden />
        <div>
          <h2 className="font-display text-lg text-arena-300">
            Este módulo es hoy un inventario, no un análisis de riesgo
          </h2>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-grafito-400">
            La plataforma <strong className="text-hueso-200">no puede</strong> calcular exposición
            a amenazas costeras, erosión ni calidad del agua, porque no tiene esos datos. Lo que
            hay es un inventario de lo que la comunidad ha cartografiado.
          </p>
          <ul className="mt-3 space-y-1.5 text-[0.8125rem] leading-relaxed text-grafito-400">
            <li>
              <strong className="text-hueso-200">Manglares:</strong> solo aparecen si están
              documentados en OpenStreetMap. La cartografía oficial de ecosistemas la publican
              CARDIQUE y el IDEAM.
            </li>
            <li>
              <strong className="text-hueso-200">Erosión costera:</strong> la tasa de retroceso de
              ~1,8 m/año que cita la tesis proviene de estudios académicos. Para cartografiarla
              hacen falta líneas de costa comparables en el tiempo —DIMAR, CIOH o imágenes
              satelitales— que no están integradas.
            </li>
            <li>
              <strong className="text-hueso-200">Clima:</strong> no hay precipitación, viento ni
              evapotranspiración. Fuente: IDEAM.
            </li>
            <li>
              <strong className="text-hueso-200">Calidad del agua:</strong> no hay datos de
              salinización de pozos, que es uno de los problemas centrales del proyecto. Requiere
              muestreo de campo.
            </li>
          </ul>
          <Link
            href="/datos"
            className="group mt-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-turquesa-400 transition hover:text-turquesa-300"
          >
            Ver el estado de las fuentes por integrar
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function FichaCapa({
  icono,
  titulo,
  capa,
  nota,
}: {
  icono: React.ReactNode;
  titulo: string;
  capa?: { entidades?: number; fechaDescarga?: string; color: string; fuente: string; limitaciones: string };
  nota: string;
}) {
  return (
    <article className="rounded-lg border border-hueso-100/10 bg-oceano-900/50 p-4">
      <div className="flex items-center gap-2">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-md"
          style={{ backgroundColor: `color-mix(in oklab, ${capa?.color ?? '#6B7A83'} 25%, transparent)` }}
        >
          <span style={{ color: capa?.color ?? '#6B7A83' }} aria-hidden>
            {icono}
          </span>
        </span>
        <h3 className="text-[0.8125rem] font-semibold text-hueso-100">{titulo}</h3>
      </div>

      <p className="mt-2 font-display text-xl leading-none text-hueso-100">
        {capa?.entidades !== undefined ? numero(capa.entidades) : 'Sin datos'}
      </p>
      <p className="mt-1.5 text-[0.6875rem] leading-snug text-grafito-500">{nota}</p>
      <p className="mt-2 text-[0.625rem] leading-snug text-grafito-600">
        {capa?.fuente ?? 'Fuente no disponible'}
        {capa?.fechaDescarga ? ` · ${capa.fechaDescarga}` : ''}
      </p>
    </article>
  );
}
