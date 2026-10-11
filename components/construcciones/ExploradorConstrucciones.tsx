'use client';

/**
 * Explorador del inventario de construcciones.
 *
 * REGLA DE PRESENTACIÓN
 *   El catastro no registra todos los campos en todos los inmuebles.
 *   Cuando un valor falta se muestra "Información no disponible" en
 *   lugar de un cero o un guion ambiguo: la diferencia entre "no hay
 *   dato" y "el dato es cero" importa.
 *
 * Todas las acciones son reales: filtrar, ordenar, paginar y exportar
 * el resultado filtrado a CSV.
 */

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Search, TriangleAlert } from 'lucide-react';
import type {
  FichaConstruccion,
  InventarioConstrucciones,
} from '@/lib/datos/construcciones';
import { cn, numero } from '@/lib/utils';

type Columna = 'codigo' | 'altura' | 'pisos' | 'areaRegistrada' | 'areaHuella' | 'tipo';
type Direccion = 'asc' | 'desc';

const POR_PAGINA = 40;

const NO_DISPONIBLE = 'Información no disponible';

export function ExploradorConstrucciones({ inventario }: { inventario: InventarioConstrucciones }) {
  const [consulta, setConsulta] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [pisos, setPisos] = useState('todos');
  const [soloConAltura, setSoloConAltura] = useState(false);
  const [orden, setOrden] = useState<Columna>('areaRegistrada');
  const [direccion, setDireccion] = useState<Direccion>('desc');
  const [pagina, setPagina] = useState(0);

  const { fichas, estadisticas } = inventario;

  // --- Filtrado ----------------------------------------------------
  const filtradas = useMemo(() => {
    const q = consulta.trim().toLowerCase();

    const resultado = fichas.filter((f) => {
      if (q && !f.codigo.toLowerCase().includes(q)) return false;
      if (tipo !== 'todos' && (f.tipo ?? 'sin-tipo') !== tipo) return false;
      if (pisos !== 'todos') {
        if (pisos === 'sin-dato' ? f.pisos !== null : String(f.pisos) !== pisos) return false;
      }
      // "Con altura" significa con altura REGISTRADA y mayor que cero
      if (soloConAltura && !(f.altura !== null && f.altura > 0)) return false;
      return true;
    });

    resultado.sort((a, b) => {
      const va = a[orden];
      const vb = b[orden];
      // Los valores ausentes van siempre al final, en cualquier orden
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;

      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'es');
      return direccion === 'asc' ? cmp : -cmp;
    });

    return resultado;
  }, [fichas, consulta, tipo, pisos, soloConAltura, orden, direccion]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = filtradas.slice(paginaActual * POR_PAGINA, (paginaActual + 1) * POR_PAGINA);

  // --- Acciones ----------------------------------------------------
  const cambiarOrden = (col: Columna) => {
    if (orden === col) {
      setDireccion((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrden(col);
      setDireccion(col === 'codigo' || col === 'tipo' ? 'asc' : 'desc');
    }
    setPagina(0);
  };

  /** Exporta a CSV las filas que cumplen los filtros, no solo la página. */
  const exportar = () => {
    const cabeceras = [
      'codigo',
      'altura_m',
      'pisos',
      'area_construida_m2',
      'area_huella_m2',
      'tipo',
      'longitud',
      'latitud',
    ];
    const filas = filtradas.map((f) =>
      [
        f.codigo,
        f.altura ?? '',
        f.pisos ?? '',
        f.areaRegistrada ?? '',
        f.areaHuella,
        f.tipo ?? '',
        f.longitude,
        f.latitude,
      ].join(',')
    );

    const csv = [cabeceras.join(','), ...filas].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `construcciones-tierra-bomba-${filtradas.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const limpiarFiltros = () => {
    setConsulta('');
    setTipo('todos');
    setPisos('todos');
    setSoloConAltura(false);
    setPagina(0);
  };

  if (!inventario.disponible) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="flex gap-3 rounded-lg border border-pendiente/30 bg-pendiente/[0.07] p-5">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-pendiente" aria-hidden />
          <div>
            <h1 className="text-sm font-semibold text-arena-300">
              Inventario no disponible
            </h1>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-grafito-400">
              No se ha podido leer <code className="dato-mono">data/oficial/construccion.geojson</code>.
              Ejecuta la importación del catastro:
            </p>
            <pre className="dato-mono mt-2 rounded bg-oceano-950/60 px-3 py-2 text-[0.6875rem] text-turquesa-300">
              node scripts/datos/importar_catastro.mjs --ambito isla --solo construccion
            </pre>
          </div>
        </div>
      </div>
    );
  }

  const hayFiltros =
    consulta.trim() !== '' || tipo !== 'todos' || pisos !== 'todos' || soloConAltura;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Encabezado */}
      <header className="max-w-3xl">
        <p className="dato-mono text-turquesa-500 uppercase tracking-[0.18em]">
          Catastro oficial
        </p>
        <h1 className="mt-2 font-display text-titulo text-hueso-100">
          Inventario de construcciones
        </h1>
        <p className="mt-3 text-base leading-relaxed text-grafito-400">
          {numero(estadisticas.total)} huellas de construcción registradas por la entidad
          catastral en el ámbito de la isla, con su altura y número de pisos. Es la única fuente
          del proyecto que aporta datos de altura reales: OpenStreetMap solo los tiene para 1
          edificación de 827.
        </p>
      </header>

      {/* Resumen */}
      <section className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica etiqueta="Construcciones" valor={numero(estadisticas.total)} nota="Huellas del catastro" />
        <Metrica
          etiqueta="Con altura registrada"
          valor={`${numero(estadisticas.conAltura)} (${((100 * estadisticas.conAltura) / estadisticas.total).toFixed(1)} %)`}
          nota="El resto no tiene el dato"
        />
        <Metrica
          etiqueta="Altura media"
          valor={estadisticas.alturaMedia ? `${numero(estadisticas.alturaMedia, 2)} m` : NO_DISPONIBLE}
          nota={`Máxima: ${estadisticas.alturaMaxima ? `${numero(estadisticas.alturaMaxima, 1)} m` : NO_DISPONIBLE}`}
        />
        <Metrica
          etiqueta="Huella construida total"
          valor={`${numero(estadisticas.areaHuellaTotal / 1e4, 2)} ha`}
          nota="Calculada de la geometría"
        />
      </section>

      {/* Filtros */}
      <section className="mt-6 rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="buscar" className="mb-1.5 block text-[0.75rem] text-hueso-200">
              Buscar por código catastral
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-grafito-500"
                aria-hidden
              />
              <input
                id="buscar"
                type="search"
                value={consulta}
                onChange={(e) => {
                  setConsulta(e.target.value);
                  setPagina(0);
                }}
                placeholder="1300113000000003600200000"
                className="w-full rounded-md border border-hueso-100/15 bg-oceano-950/60 py-2 pl-8 pr-3 text-[0.8125rem] text-hueso-100 placeholder:text-grafito-600 focus:border-turquesa-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tipo" className="mb-1.5 block text-[0.75rem] text-hueso-200">
              Tipo de construcción
            </label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                setPagina(0);
              }}
              className="w-full rounded-md border border-hueso-100/15 bg-oceano-950/60 px-2.5 py-2 text-[0.8125rem] text-hueso-100 focus:border-turquesa-500 focus:outline-none"
            >
              <option value="todos">Todos los tipos</option>
              {estadisticas.porTipo.map((t) => (
                <option key={t.tipo} value={t.tipo}>
                  {t.tipo} ({t.cantidad})
                </option>
              ))}
              <option value="sin-tipo">Sin tipo registrado</option>
            </select>
          </div>

          <div>
            <label htmlFor="pisos" className="mb-1.5 block text-[0.75rem] text-hueso-200">
              Número de pisos
            </label>
            <select
              id="pisos"
              value={pisos}
              onChange={(e) => {
                setPisos(e.target.value);
                setPagina(0);
              }}
              className="w-full rounded-md border border-hueso-100/15 bg-oceano-950/60 px-2.5 py-2 text-[0.8125rem] text-hueso-100 focus:border-turquesa-500 focus:outline-none"
            >
              <option value="todos">Cualquier número</option>
              {estadisticas.porPisos.map((p) => (
                <option key={p.pisos} value={String(p.pisos)}>
                  {p.pisos} piso{p.pisos > 1 ? 's' : ''} ({p.cantidad})
                </option>
              ))}
              <option value="sin-dato">Sin dato</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-[0.75rem] text-hueso-200">
              <input
                type="checkbox"
                checked={soloConAltura}
                onChange={(e) => {
                  setSoloConAltura(e.target.checked);
                  setPagina(0);
                }}
                className="accent-turquesa-500"
              />
              Solo con altura registrada
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.75rem] text-grafito-400">
            {numero(filtradas.length)} de {numero(estadisticas.total)} construcciones
            {hayFiltros && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="dato-mono ml-2 text-turquesa-400 underline decoration-dotted underline-offset-2"
              >
                limpiar filtros
              </button>
            )}
          </p>
          <button
            type="button"
            onClick={exportar}
            disabled={!filtradas.length}
            className="inline-flex items-center gap-1.5 rounded-md bg-hueso-100/10 px-3 py-1.5 text-[0.75rem] text-hueso-200 transition enabled:hover:bg-hueso-100/20 disabled:opacity-40"
          >
            <Download className="size-3.5" aria-hidden />
            Exportar {numero(filtradas.length)} a CSV
          </button>
        </div>
      </section>

      {/* Tabla */}
      <section className="mt-4 overflow-hidden rounded-xl border border-hueso-100/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-[0.8125rem]">
            <thead className="bg-hueso-100/[0.05]">
              <tr>
                <Cabecera columna="codigo" actual={orden} dir={direccion} alOrdenar={cambiarOrden}>
                  Código catastral
                </Cabecera>
                <Cabecera columna="tipo" actual={orden} dir={direccion} alOrdenar={cambiarOrden}>
                  Tipo
                </Cabecera>
                <Cabecera
                  columna="pisos"
                  actual={orden}
                  dir={direccion}
                  alOrdenar={cambiarOrden}
                  numerica
                >
                  Pisos
                </Cabecera>
                <Cabecera
                  columna="altura"
                  actual={orden}
                  dir={direccion}
                  alOrdenar={cambiarOrden}
                  numerica
                >
                  Altura
                </Cabecera>
                <Cabecera
                  columna="areaRegistrada"
                  actual={orden}
                  dir={direccion}
                  alOrdenar={cambiarOrden}
                  numerica
                >
                  Área construida
                </Cabecera>
                <Cabecera
                  columna="areaHuella"
                  actual={orden}
                  dir={direccion}
                  alOrdenar={cambiarOrden}
                  numerica
                >
                  Huella
                </Cabecera>
                <th scope="col" className="px-3 py-2.5 font-medium text-hueso-200">
                  Coordenadas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hueso-100/[0.07]">
              {visibles.map((f) => (
                <Fila key={f.codigo} ficha={f} />
              ))}
              {!visibles.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-grafito-500">
                    Ninguna construcción cumple los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <nav
          className="mt-3 flex items-center justify-between gap-3"
          aria-label="Paginación del inventario"
        >
          <button
            type="button"
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={paginaActual === 0}
            className="rounded-md border border-hueso-100/15 px-3 py-1.5 text-[0.75rem] text-hueso-200 transition enabled:hover:bg-hueso-100/10 disabled:opacity-35"
          >
            Anterior
          </button>
          <span className="dato-mono text-grafito-400">
            Página {paginaActual + 1} de {numero(totalPaginas)}
          </span>
          <button
            type="button"
            onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
            disabled={paginaActual >= totalPaginas - 1}
            className="rounded-md border border-hueso-100/15 px-3 py-1.5 text-[0.75rem] text-hueso-200 transition enabled:hover:bg-hueso-100/10 disabled:opacity-35"
          >
            Siguiente
          </button>
        </nav>
      )}

      {/* Limitaciones */}
      <section className="mt-8 rounded-lg border border-hueso-100/10 bg-oceano-900/40 p-5">
        <h2 className="text-sm font-semibold text-hueso-200">Limitaciones de este inventario</h2>
        <ul className="mt-2 space-y-1.5 text-[0.8125rem] leading-relaxed text-grafito-400">
          <li>
            Los valores de altura y pisos son los <strong>registrados por la entidad catastral</strong>{' '}
            y pueden no reflejar el estado construido actual.
          </li>
          <li>
            {numero(estadisticas.total - estadisticas.conAltura)} construcciones no tienen altura
            registrada y aparecen como «{NO_DISPONIBLE}».
          </li>
          <li>
            No hay uso, estado de conservación ni fotografías: el catastro no los publica en esta
            capa.
          </li>
          <li>
            La huella se calcula de la geometría; el área construida es el valor declarado. Pueden
            no coincidir si el inmueble tiene más de una planta.
          </li>
        </ul>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------
//  Piezas
// ------------------------------------------------------------------

function Fila({ ficha }: { ficha: FichaConstruccion }) {
  return (
    <tr className="transition hover:bg-hueso-100/[0.04]">
      <td className="dato-mono px-3 py-2 text-grafito-400" title={ficha.codigo}>
        {ficha.codigo.length > 22 ? `${ficha.codigo.slice(0, 22)}…` : ficha.codigo}
      </td>
      <td className="px-3 py-2 text-hueso-200">{ficha.tipo ?? NO_DISPONIBLE}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {ficha.pisos !== null ? (
          <span className="text-hueso-100">{ficha.pisos}</span>
        ) : (
          <span className="text-[0.75rem] italic text-grafito-500">{NO_DISPONIBLE}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {ficha.altura !== null && ficha.altura > 0 ? (
          <span className="text-hueso-100">{numero(ficha.altura, 2)} m</span>
        ) : (
          <span className="text-[0.75rem] italic text-grafito-500">{NO_DISPONIBLE}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {ficha.areaRegistrada !== null ? (
          <span className="text-hueso-100">{numero(ficha.areaRegistrada, 1)} m²</span>
        ) : (
          <span className="text-[0.75rem] italic text-grafito-500">{NO_DISPONIBLE}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-grafito-400">
        {numero(ficha.areaHuella, 1)} m²
      </td>
      <td className="dato-mono px-3 py-2 text-grafito-500">
        {ficha.latitude.toFixed(5)}, {ficha.longitude.toFixed(5)}
      </td>
    </tr>
  );
}

function Cabecera({
  columna,
  actual,
  dir,
  alOrdenar,
  numerica,
  children,
}: {
  columna: Columna;
  actual: Columna;
  dir: Direccion;
  alOrdenar: (c: Columna) => void;
  numerica?: boolean;
  children: React.ReactNode;
}) {
  const activa = actual === columna;
  const Icono = dir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th scope="col" className={cn('px-3 py-2.5 font-medium', numerica && 'text-right')}>
      <button
        type="button"
        onClick={() => alOrdenar(columna)}
        aria-sort={activa ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(
          'inline-flex items-center gap-1 transition',
          activa ? 'text-turquesa-400' : 'text-hueso-200 hover:text-turquesa-400'
        )}
      >
        {children}
        {activa && <Icono className="size-3" aria-hidden />}
      </button>
    </th>
  );
}

function Metrica({
  etiqueta,
  valor,
  nota,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
}) {
  return (
    <div className="rounded-lg border border-hueso-100/10 bg-oceano-900/50 p-3.5">
      <p className="text-[0.6875rem] leading-tight text-grafito-400">{etiqueta}</p>
      <p className="mt-1.5 font-display text-xl leading-none text-hueso-100">{valor}</p>
      <p className="mt-1.5 text-[0.625rem] leading-snug text-grafito-500">{nota}</p>
    </div>
  );
}
