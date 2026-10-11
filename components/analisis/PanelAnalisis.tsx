'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as TooltipRecharts,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, BarChart3, Building2, Route, Ruler } from 'lucide-react';
import type { ResultadoAnalisis } from '@/lib/datos/analisis';
import { numero } from '@/lib/utils';

const ESTILO_TOOLTIP = {
  background: '#0c212d',
  border: '1px solid rgba(246,244,239,0.15)',
  borderRadius: 8,
  fontSize: 12,
} as const;

const COLOR_BARRA = '#39B8B0';
const COLOR_BARRA_ALT = '#D9C6A3';

export function PanelAnalisis({ analisis }: { analisis: ResultadoAnalisis }) {
  if (!analisis.disponible) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="flex gap-3 rounded-lg border border-pendiente/30 bg-pendiente/[0.07] p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-pendiente" aria-hidden />
          <div>
            <h1 className="text-sm font-semibold text-arena-300">Análisis no disponible</h1>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-grafito-400">
              Faltan datos del catastro. Ejecuta la importación:
            </p>
            <pre className="dato-mono mt-2 rounded bg-oceano-950/60 px-3 py-2 text-[0.6875rem] text-turquesa-300">
              node scripts/datos/importar_catastro.mjs --ambito isla --solo construccion
            </pre>
          </div>
        </div>
      </div>
    );
  }

  const { accesibilidad, superficies } = analisis;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="max-w-3xl">
        <p className="dato-mono text-turquesa-500 uppercase tracking-[0.18em]">
          Cálculo geométrico
        </p>
        <h1 className="mt-2 font-display text-titulo text-hueso-100">Análisis territorial</h1>
        <p className="mt-3 text-base leading-relaxed text-grafito-400">
          Cada resultado se calcula sobre los datos publicados: distancias con la fórmula de
          haversine y pertenencia a un polígono con lanzamiento de rayo. No hay cifras estimadas.
        </p>
      </header>

      {/* Superficies */}
      <section className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica
          icono={<Building2 className="size-4" />}
          etiqueta="Huella construida"
          valor={`${numero(superficies.huellaM2 / 1e4, 2)} ha`}
          nota="Suma de las huellas del catastro"
        />
        <Metrica
          icono={<Ruler className="size-4" />}
          etiqueta="Índice de ocupación"
          valor={
            superficies.indiceOcupacionPct !== null
              ? `${numero(superficies.indiceOcupacionPct, 2)} %`
              : 'Sin datos'
          }
          nota="Huella sobre la superficie insular"
        />
        <Metrica
          icono={<Route className="size-4" />}
          etiqueta="Distancia media al comercio"
          valor={
            accesibilidad.distanciaMediaM !== null
              ? `${numero(accesibilidad.distanciaMediaM, 0)} m`
              : 'Sin datos'
          }
          nota={`Sobre ${numero(accesibilidad.analizadas)} construcciones`}
        />
        <Metrica
          icono={<BarChart3 className="size-4" />}
          etiqueta="Comercios localizados"
          valor={numero(accesibilidad.equipamientos)}
          nota="Única categoría cartografiada en OSM"
        />
      </section>

      {/* Advertencia sobre la accesibilidad */}
      <section className="mt-4 flex gap-3 rounded-xl border border-pendiente/25 bg-pendiente/[0.06] p-4">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-pendiente" aria-hidden />
        <p className="text-[0.75rem] leading-relaxed text-grafito-400">
          <strong className="text-arena-300">Qué mide y qué no la accesibilidad.</strong> Calcula
          la distancia en línea recta de cada construcción al <strong>comercio</strong> más
          cercano, porque es el único tipo de equipamiento que OpenStreetMap tiene cartografiado
          en la isla. <strong>No mide acceso a salud, educación ni cultura</strong>, ni tiempo de
          viaje real: no hay red de senderos con jerarquía ni inventario oficial de equipamientos
          para calcularlo.
        </p>
      </section>

      {/* Gráficos */}
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Grafico
          titulo="Distribución de superficies construidas"
          descripcion="Área construida registrada por el catastro, en tramos"
          datos={analisis.distribucionAreas}
          color={COLOR_BARRA}
        />
        <Grafico
          titulo="Distancia al comercio más cercano"
          descripcion="Construcciones por tramo de distancia en línea recta"
          datos={accesibilidad.tramos}
          color={COLOR_BARRA_ALT}
        />
        <Grafico
          titulo="Número de pisos registrado"
          descripcion="El catastro registra una sola planta en la práctica totalidad"
          datos={analisis.distribucionPisos}
          color={COLOR_BARRA}
        />

        {/* Construcciones por barrio */}
        <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
          <h2 className="text-[0.8125rem] font-semibold text-hueso-100">
            Construcciones por barrio
          </h2>
          <p className="mt-0.5 text-[0.6875rem] text-grafito-500">
            Pertenencia calculada por punto en polígono sobre los barrios del catastro
          </p>
          <ul className="mt-3 space-y-1.5">
            {analisis.porBarrio.map((b) => {
              const max = analisis.porBarrio[0]?.construcciones || 1;
              return (
                <li key={b.nombre} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[0.75rem] text-grafito-400" title={b.nombre}>
                    {b.nombre}
                  </span>
                  <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-hueso-100/10">
                    <span
                      className="block h-full rounded-full bg-turquesa-500"
                      style={{ width: `${(100 * b.construcciones) / max}%` }}
                    />
                  </span>
                  <span className="dato-mono w-12 shrink-0 text-right text-hueso-200">
                    {numero(b.construcciones)}
                  </span>
                </li>
              );
            })}
            {!analisis.porBarrio.length && (
              <li className="text-[0.75rem] text-grafito-500">
                Ninguna construcción cae dentro de los barrios del catastro: la isla está
                clasificada como suelo rural en la fuente oficial.
              </li>
            )}
          </ul>
        </section>
      </div>

      {/* Metodología */}
      <section className="mt-6 rounded-xl border border-hueso-100/10 bg-oceano-900/40 p-5">
        <h2 className="text-sm font-semibold text-hueso-200">Método y limitaciones</h2>
        <ul className="mt-2 space-y-1.5 text-[0.8125rem] leading-relaxed text-grafito-400">
          <li>
            <strong className="text-hueso-200">Distancias:</strong> fórmula de haversine sobre
            esfera de radio 6.371.008,8 m, en línea recta. No es distancia de recorrido.
          </li>
          <li>
            <strong className="text-hueso-200">Pertenencia a barrio:</strong> lanzamiento de rayo
            sobre el centroide de cada construcción. Una construcción se asigna a un solo barrio.
          </li>
          <li>
            <strong className="text-hueso-200">Superficies:</strong> la huella se calcula de la
            geometría con la fórmula del polígono; el área construida es el valor declarado por el
            catastro. Difieren cuando el inmueble tiene más de una planta.
          </li>
          <li>
            <strong className="text-hueso-200">Sin pendientes ni elevaciones:</strong> no hay un
            modelo digital del terreno integrado. El relieve del visor viene de teselas de
            elevación de ~30 m, insuficiente para calcular pendientes predio a predio.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Grafico({
  titulo,
  descripcion,
  datos,
  color,
}: {
  titulo: string;
  descripcion: string;
  datos: Array<{ etiqueta: string; cantidad: number }>;
  color: string;
}) {
  const total = datos.reduce((n, d) => n + d.cantidad, 0);

  return (
    <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
      <h2 className="text-[0.8125rem] font-semibold text-hueso-100">{titulo}</h2>
      <p className="mt-0.5 text-[0.6875rem] text-grafito-500">{descripcion}</p>

      {datos.length ? (
        <div className="mt-3 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} margin={{ top: 4, right: 8, bottom: 4, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(246,244,239,0.08)" vertical={false} />
              <XAxis
                dataKey="etiqueta"
                tick={{ fill: '#6b7a83', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(246,244,239,0.12)' }}
                tickLine={false}
                interval={0}
                angle={datos.length > 5 ? -25 : 0}
                textAnchor={datos.length > 5 ? 'end' : 'middle'}
                height={datos.length > 5 ? 52 : 28}
              />
              <YAxis
                tick={{ fill: '#6b7a83', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <TooltipRecharts
                contentStyle={ESTILO_TOOLTIP}
                cursor={{ fill: 'rgba(246,244,239,0.05)' }}
                formatter={(valor) => [`${numero(Number(valor))} construcciones`, '']}
              />
              <Bar dataKey="cantidad" radius={[3, 3, 0, 0]}>
                {datos.map((d) => (
                  <Cell key={d.etiqueta} fill={color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-3 text-[0.75rem] text-grafito-500">Sin datos para este análisis.</p>
      )}

      {total > 0 && (
        <p className="dato-mono mt-2 text-grafito-500">Total: {numero(total)} construcciones</p>
      )}
    </section>
  );
}

function Metrica({
  icono,
  etiqueta,
  valor,
  nota,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: string;
  nota: string;
}) {
  return (
    <div className="rounded-lg border border-hueso-100/10 bg-oceano-900/50 p-3.5">
      <div className="flex items-center gap-2 text-turquesa-500" aria-hidden>
        {icono}
      </div>
      <p className="mt-2 text-[0.6875rem] leading-tight text-grafito-400">{etiqueta}</p>
      <p className="mt-1.5 font-display text-xl leading-none text-hueso-100">{valor}</p>
      <p className="mt-1.5 text-[0.625rem] leading-snug text-grafito-500">{nota}</p>
    </div>
  );
}
