'use client';

/**
 * Panel de control de TIERRA BOMBA 3D
 * ==================================================================
 * Dashboard principal de la plataforma.
 *
 * TODAS LAS CIFRAS SON CALCULADAS, NINGUNA ESCRITA A MANO
 *   Los indicadores vienen de lib/datos/analitica.ts, que los obtiene
 *   de los GeoJSON reales con unión y diferencia de polígonos (Turf).
 *   Cuando un indicador no se puede calcular, se muestra "Sin datos"
 *   junto con la fuente que haría falta: nunca se rellena con una
 *   estimación.
 *
 *   Esto es deliberado: el mockup de referencia daba 312 edificaciones
 *   y 5,4 km²; las cifras reales son 2.714 y 19,89 km². Publicar las
 *   primeras habría invalidado el trabajo académico.
 * ==================================================================
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  ChartPie,
  Info,
  Layers,
  Map as MapIcon,
  Ruler,
  TriangleAlert,
} from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as TooltipRecharts,
} from 'recharts';

import { VisorTerritorial } from '@/components/mapa/VisorTerritorial';
import { AREA_ESTUDIO, type DefinicionCapa } from '@/lib/catalogo';
import type { Analitica, Indicador } from '@/lib/datos/analitica';
import { cn, numero } from '@/lib/utils';

interface Props {
  catalogo: DefinicionCapa[];
  analitica: Analitica;
}

export function PanelControl({ catalogo, analitica }: Props) {
  const [verTodos, setVerTodos] = useState(false);

  // Se muestran primero los indicadores disponibles: son los que
  // aportan información. Los pendientes van al final, declarados.
  const disponibles = analitica.indicadores.filter((i) => i.disponible);
  const pendientes = analitica.indicadores.filter((i) => !i.disponible);
  const mostrar = verTodos ? [...disponibles, ...pendientes] : disponibles.slice(0, 8);

  return (
    <div className="p-3 sm:p-5">
      {/* Cabecera del panel */}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="dato-mono text-turquesa-500 uppercase tracking-[0.18em]">
            Panel de control
          </p>
          <h1 className="mt-1 font-display text-2xl text-hueso-100 sm:text-3xl">
            {AREA_ESTUDIO.nombre}
          </h1>
          <p className="mt-0.5 text-[0.8125rem] text-grafito-400">
            {AREA_ESTUDIO.municipio} · {AREA_ESTUDIO.departamento} · Colombia
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="dato-mono rounded-md border border-hueso-100/12 px-2.5 py-1.5 text-grafito-400">
            {numero(analitica.indicadores.length)} indicadores ·{' '}
            {numero(disponibles.length)} con dato
          </span>
          <Link
            href="/explorar"
            className="group inline-flex items-center gap-1.5 rounded-md bg-turquesa-500 px-3.5 py-2 text-[0.8125rem] font-semibold text-oceano-950 transition hover:bg-turquesa-400"
          >
            Abrir el visor
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </header>

      {/* Fila de indicadores */}
      <section aria-label="Indicadores territoriales" className="mb-4">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {mostrar.map((ind) => (
            <TarjetaIndicador key={ind.id} indicador={ind} />
          ))}
        </div>

        {pendientes.length > 0 && (
          <button
            type="button"
            onClick={() => setVerTodos((v) => !v)}
            className="dato-mono mt-2.5 text-grafito-400 underline decoration-dotted underline-offset-2 transition hover:text-turquesa-400"
          >
            {verTodos
              ? 'Ver solo los indicadores con dato'
              : `Ver los ${pendientes.length} indicadores sin dato y qué falta`}
          </button>
        )}
      </section>

      {/* Mapa + columna lateral */}
      <div className="grid gap-3 xl:grid-cols-[1fr_20rem]">
        {/* Mapa */}
        <section className="overflow-hidden rounded-xl border border-hueso-100/10">
          <div className="flex items-center justify-between border-b border-hueso-100/10 bg-oceano-900/60 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <MapIcon className="size-4 text-turquesa-500" aria-hidden />
              <h2 className="text-[0.8125rem] font-semibold text-hueso-100">
                Visor territorial
              </h2>
            </div>
            <span className="dato-mono hidden text-grafito-500 sm:block">
              {numero(catalogo.filter((c) => c.entidades).length)} capas · relieve real
            </span>
          </div>

          {/* El visor completo, incrustado en la tarjeta */}
          <VisorTerritorial catalogo={catalogo} className="h-[34rem]" />
        </section>

        {/* Columna lateral */}
        <div className="flex flex-col gap-3">
          {/* Ficha del ámbito */}
          <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
            <h2 className="text-[0.8125rem] font-semibold text-hueso-100">
              Sobre el área de estudio
            </h2>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-grafito-400">
              Isla del Caribe colombiano frente a Cartagena de Indias. El proyecto de grado
              estudia la reubicación del equipamiento comunitario y la infraestructura hídrica
              frente al retroceso costero.
            </p>
            <dl className="mt-3 space-y-1.5">
              <DatoLinea etiqueta="Centro" valor={`${AREA_ESTUDIO.centro.lat.toFixed(5)}° N, ${Math.abs(AREA_ESTUDIO.centro.lng).toFixed(5)}° O`} />
              <DatoLinea etiqueta="Superficie" valor={indicadorPorId(analitica, 'area')} />
              <DatoLinea etiqueta="Línea de costa" valor={indicadorPorId(analitica, 'costa')} />
              <DatoLinea etiqueta="Altura media" valor={indicadorPorId(analitica, 'altura-media')} />
              <DatoLinea etiqueta="Construcciones" valor={indicadorPorId(analitica, 'construcciones')} />
              <DatoLinea etiqueta="Vías oficiales" valor={numero(entidadesDe(catalogo, 'catastro-vias'))} />
            </dl>
          </section>

          {/* Uso del suelo */}
          <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <ChartPie className="size-4 text-turquesa-500" aria-hidden />
              <h2 className="text-[0.8125rem] font-semibold text-hueso-100">
                Cobertura del suelo
              </h2>
            </div>

            {analitica.usoDelSuelo.length > 0 ? (
              <>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analitica.usoDelSuelo}
                        dataKey="m2"
                        nameKey="clave"
                        innerRadius="55%"
                        outerRadius="85%"
                        paddingAngle={1}
                        stroke="none"
                      >
                        {analitica.usoDelSuelo.map((u) => (
                          <Cell key={u.clave} fill={u.color} />
                        ))}
                      </Pie>
                      <TooltipRecharts
                        contentStyle={{
                          background: '#0c212d',
                          border: '1px solid rgba(246,244,239,0.15)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(valor, nombre) => [
                          `${(Number(valor) / 1e6).toFixed(2)} km²`,
                          String(nombre),
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <ul className="mt-2 space-y-1">
                  {analitica.usoDelSuelo.map((u) => (
                    <li key={u.clave} className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-sm ring-1 ring-inset ring-white/20"
                        style={{ backgroundColor: u.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-[0.75rem] text-grafito-400">
                        {u.clave}
                      </span>
                      <span className="dato-mono shrink-0 text-hueso-200">
                        {u.porcentaje.toFixed(1)} %
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-2.5 text-[0.625rem] leading-relaxed text-grafito-500">
                  Superficies netas calculadas con unión y diferencia de polígonos. El matorral de
                  OSM engloba los asentamientos: se le restan lo construido y el agua.
                </p>
              </>
            ) : (
              <p className="text-[0.75rem] text-grafito-500">
                Sin datos de cobertura del suelo.
              </p>
            )}
          </section>

          {/* Estado de las fuentes */}
          <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Layers className="size-4 text-turquesa-500" aria-hidden />
              <h2 className="text-[0.8125rem] font-semibold text-hueso-100">
                Estado de las capas
              </h2>
            </div>
            <ul className="space-y-1">
              {catalogo.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-sm ring-1 ring-inset ring-white/20"
                    style={{ backgroundColor: c.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-grafito-400">
                    {c.titulo}
                  </span>
                  <span
                    className={cn(
                      'dato-mono shrink-0 text-[0.625rem]',
                      c.entidades ? 'text-hueso-200' : 'text-pendiente'
                    )}
                  >
                    {c.entidades ? numero(c.entidades) : 'sin archivo'}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/datos"
              className="dato-mono mt-3 inline-block text-turquesa-400 underline decoration-dotted underline-offset-2"
            >
              Ver procedencia y licencias
            </Link>
          </section>
        </div>
      </div>

      {/* Nota de honestidad de los datos */}
      <section className="mt-4 flex gap-3 rounded-xl border border-pendiente/25 bg-pendiente/[0.06] p-4">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-pendiente" aria-hidden />
        <div className="text-[0.75rem] leading-relaxed text-grafito-400">
          <strong className="text-arena-300">Cómo leer este panel.</strong> Los indicadores se
          calculan en tiempo de compilación a partir de los GeoJSON publicados, con su fuente y su
          fecha. Los que aparecen como <em>Sin datos</em> requieren una fuente que aún no está
          integrada —población del DANE, amenaza costera del POT o del CIOH, inventario oficial de
          equipamientos— y se declaran en lugar de estimarse.
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------
//  Piezas
// ------------------------------------------------------------------

/** Valor de un indicador por su id, o "—" si no existe. */
function indicadorPorId(a: Analitica, id: string): string {
  const i = a.indicadores.find((x) => x.id === id);
  if (!i) return '—';
  if (!i.disponible) return 'Sin datos';
  // Se recorta la unidad para la ficha lateral
  return i.valor;
}

/** Recuento de entidades de una capa del catálogo. */
function entidadesDe(catalogo: DefinicionCapa[], id: string): number | null {
  const c = catalogo.find((x) => x.id === id);
  return c?.entidades ?? null;
}

function DatoLinea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[0.6875rem] text-grafito-500">{etiqueta}</dt>
      <dd className="dato-mono min-w-0 truncate text-right text-hueso-200">{valor}</dd>
    </div>
  );
}

function TarjetaIndicador({ indicador }: { indicador: Indicador }) {
  const sinDato = !indicador.disponible;

  return (
    <article
      className={cn(
        'rounded-lg border p-3.5 transition',
        sinDato
          ? 'border-hueso-100/[0.07] bg-oceano-900/30'
          : 'border-hueso-100/10 bg-oceano-900/60'
      )}
      title={sinDato ? indicador.requiere : indicador.nota}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.6875rem] leading-tight text-grafito-400">{indicador.etiqueta}</p>
        {sinDato ? (
          <Info className="size-3.5 shrink-0 text-pendiente" aria-hidden />
        ) : (
          <span className="size-1.5 shrink-0 rounded-full bg-turquesa-500" aria-hidden />
        )}
      </div>

      <p
        className={cn(
          'mt-1.5 font-display leading-none',
          sinDato ? 'text-base text-pendiente' : 'text-2xl text-hueso-100'
        )}
      >
        {sinDato ? 'Sin datos' : indicador.valor}
      </p>

      <p className="mt-1.5 text-[0.625rem] leading-snug text-grafito-500">
        {sinDato ? indicador.requiere : indicador.fuente}
      </p>
    </article>
  );
}
