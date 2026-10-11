import type { Metadata } from 'next';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileJson,
  Layers,
  ShieldCheck,
} from 'lucide-react';

import { CATEGORIAS, ETIQUETA_ESTADO } from '@/lib/catalogo';
import { formatearFecha, formatearNumero, obtenerCatalogo, obtenerResumen } from '@/lib/datos/servidor';

export const metadata: Metadata = {
  title: 'Datos y fuentes',
  description:
    'Catálogo de procedencia de TIERRA BOMBA 3D: origen, licencia, fecha de descarga y limitaciones de cada capa de datos.',
};

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function PaginaDatos() {
  const catalogo = obtenerCatalogo();
  const resumen = obtenerResumen();

  const conDatos = catalogo.filter((c) => (c.entidades ?? 0) > 0);
  const sinDatos = catalogo.filter((c) => !c.entidades);

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      {/* Encabezado */}
      <header className="max-w-3xl">
        <p className="dato-mono text-turquesa-500 uppercase tracking-[0.18em]">Procedencia</p>
        <h1 className="mt-3 font-display text-titulo text-hueso-100">Datos y fuentes</h1>
        <p className="mt-4 text-base leading-relaxed text-grafito-400">
          Todo dato de esta plataforma declara de dónde viene, con qué licencia se publica, cuándo
          se descargó y qué limitaciones tiene. Nada se ha estimado ni rellenado de forma
          silenciosa.
        </p>
      </header>

      {/* Resumen */}
      <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaResumen
          icono={<Layers className="size-4" />}
          etiqueta="Entidades reales"
          valor={formatearNumero(resumen.totalEntidades)}
        />
        <TarjetaResumen
          icono={<FileJson className="size-4" />}
          etiqueta="Capas con datos"
          valor={`${resumen.totalCapas} de ${catalogo.length}`}
        />
        <TarjetaResumen
          icono={<ShieldCheck className="size-4" />}
          etiqueta="Última descarga"
          valor={formatearFecha(resumen.fechaActualizacion)}
        />
        <TarjetaResumen
          icono={<Download className="size-4" />}
          etiqueta="Peso publicado"
          valor={`${formatearNumero(Math.round(resumen.pesoTotalKb / 1024))} MB`}
        />
      </section>

      {/* Advertencia principal sobre la naturaleza de los datos */}
      <section className="mt-8 flex gap-3 rounded-lg border border-pendiente/30 bg-pendiente/[0.07] p-5">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-pendiente" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-arena-300">
            Estos datos son colaborativos, no oficiales
          </h2>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-grafito-400">
            La totalidad de la información vectorial de esta versión proviene de{' '}
            <strong className="text-hueso-200">OpenStreetMap</strong>, una base de datos construida
            por voluntarios. Su cobertura es desigual y su precisión no equivale a la de un
            levantamiento topográfico ni a la de un catastro oficial.{' '}
            <strong className="text-hueso-200">
              No debe utilizarse para trámites, linderos ni cálculos normativos.
            </strong>
          </p>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-grafito-400">
            La plataforma está preparada para incorporar fuentes oficiales colombianas (IGAC, DANE,
            POT de Cartagena, CARDIQUE) en cuanto estén disponibles y autorizadas. Ver el estado en
            la tabla inferior.
          </p>
        </div>
      </section>

      {/* Capas con datos */}
      <section className="mt-12">
        <h2 className="font-display text-2xl text-hueso-100">Capas publicadas</h2>
        <p className="mt-1 text-sm text-grafito-400">
          Cada capa se puede descargar en GeoJSON (WGS 84, EPSG:4326).
        </p>
        <p className="mt-3 rounded-md border border-hueso-100/10 bg-oceano-950/40 px-4 py-3 text-[0.75rem] leading-relaxed text-grafito-400">
          <strong className="text-hueso-200">Nota sobre las capas del catastro.</strong> La
          cartografía catastral se distribuye en{' '}
          <span className="dato-mono text-arena-400">MAGNA-SIRGAS Origen Nacional (EPSG:9377)</span>,
          el sistema oficial colombiano, cuyos ejes no son latitud y longitud sino metros con falso
          este de 5.000.000. Para publicarla se reproyectó a WGS 84 con proj4 y se recortó al ámbito
          de la isla. Sin esa conversión los datos aparecerían a cientos de kilómetros de su posición
          real.
        </p>

        <div className="mt-6 space-y-4">
          {conDatos.map((capa) => {
            const estado = ETIQUETA_ESTADO[capa.estadoValidacion];
            const categoria = CATEGORIAS.find((c) => c.id === capa.categoria);

            return (
              <article key={capa.id} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 rounded-sm ring-1 ring-inset ring-white/25"
                        style={{ backgroundColor: capa.color }}
                        aria-hidden
                      />
                      <h3 className="font-display text-lg text-hueso-100">{capa.titulo}</h3>
                    </div>
                    <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-grafito-400">
                      {capa.descripcion}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="dato-mono rounded-full px-2.5 py-1"
                      style={{
                        backgroundColor: `color-mix(in oklab, ${estado.color} 20%, transparent)`,
                        color: estado.color,
                      }}
                      title={estado.descripcion}
                    >
                      {estado.texto}
                    </span>
                    <a
                      href={`${BASE}${capa.archivo}`}
                      download
                      className="inline-flex items-center gap-1.5 rounded-md bg-hueso-100/10 px-3 py-1.5 text-[0.75rem] text-hueso-200 transition hover:bg-hueso-100/20"
                    >
                      <Download className="size-3.5" aria-hidden />
                      GeoJSON
                    </a>
                  </div>
                </div>

                <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-hueso-100/10 pt-4 text-[0.75rem] sm:grid-cols-2 lg:grid-cols-3">
                  <Campo etiqueta="Categoría" valor={categoria?.titulo ?? '—'} />
                  <Campo etiqueta="Entidades" valor={formatearNumero(capa.entidades)} />
                  <Campo etiqueta="Tamaño" valor={capa.pesoKb ? `${capa.pesoKb} KB` : '—'} />
                  <Campo etiqueta="Geometría" valor={capa.geometria} />
                  <Campo etiqueta="Fecha de descarga" valor={formatearFecha(capa.fechaDescarga)} />
                  <Campo
                    etiqueta="Fuente"
                    valor={capa.fuente}
                    enlace={capa.fuenteUrl}
                  />
                  <Campo etiqueta="Licencia" valor={capa.licencia} />
                  <Campo etiqueta="Atribución" valor={capa.attribution} />
                </dl>

                {capa.limitaciones && (
                  <div className="mt-4 rounded-md bg-oceano-950/50 p-3">
                    <p className="dato-mono mb-1 text-grafito-500">LIMITACIONES</p>
                    <p className="text-[0.75rem] leading-relaxed text-grafito-400">
                      {capa.limitaciones}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Manifiestos de procedencia */}
      <section className="mt-8 rounded-lg border border-hueso-100/10 bg-hueso-100/[0.03] p-5">
        <h2 className="text-sm font-semibold text-hueso-200">Manifiestos de procedencia</h2>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-grafito-400">
          Los archivos que documentan de forma automatizada el origen de cada capa: entidad
          productora, sistema de coordenadas original, fecha y recuento de entidades. Se generan
          junto con los datos, no se escriben a mano.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`${BASE}/datos/osm/manifiesto.json`}
            download
            className="inline-flex items-center gap-1.5 rounded-md bg-hueso-100/10 px-3 py-1.5 text-[0.75rem] text-hueso-200 transition hover:bg-hueso-100/20"
          >
            <Download className="size-3.5" aria-hidden />
            OpenStreetMap
          </a>
          <a
            href={`${BASE}/datos/oficial/manifiesto.json`}
            download
            className="inline-flex items-center gap-1.5 rounded-md bg-hueso-100/10 px-3 py-1.5 text-[0.75rem] text-hueso-200 transition hover:bg-hueso-100/20"
          >
            <Download className="size-3.5" aria-hidden />
            Catastro oficial
          </a>
        </div>
      </section>

      {/* Capas sin datos */}
      {sinDatos.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl text-hueso-100">Capas definidas sin datos</h2>
          <p className="mt-1 text-sm text-grafito-400">
            Estas capas están previstas en el catálogo, pero su archivo aún no se ha generado. No
            aparecen en el visor.
          </p>
          <ul className="mt-4 space-y-2">
            {sinDatos.map((capa) => (
              <li key={capa.id} className="panel flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-[0.8125rem] text-grafito-400">{capa.titulo}</span>
                <span className="dato-mono text-pendiente">sin archivo</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Fuentes oficiales pendientes */}
      <section className="mt-12">
        <h2 className="font-display text-2xl text-hueso-100">Fuentes oficiales por integrar</h2>
        <p className="mt-1 text-sm text-grafito-400">
          La plataforma incorporará datos oficiales cuando se obtengan y se verifique su licencia de
          uso.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-hueso-100/10">
          <table className="w-full text-left text-[0.8125rem]">
            <thead className="bg-hueso-100/[0.05]">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium text-hueso-200">Fuente</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-hueso-200">Aporta</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-hueso-200">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hueso-100/10">
              <FilaFuente
                fuente="IGAC"
                aporta="Cartografía base, catastro, modelo digital de elevación"
                estado="pendiente"
              />
              <FilaFuente
                fuente="DANE"
                aporta="Censo de población y vivienda, necesidades básicas insatisfechas"
                estado="pendiente"
              />
              <FilaFuente
                fuente="POT Cartagena"
                aporta="Clasificación del suelo, tratamientos urbanísticos, áreas de riesgo"
                estado="pendiente"
              />
              <FilaFuente
                fuente="CARDIQUE"
                aporta="Ecosistemas, manglares, áreas protegidas, calidad del agua"
                estado="pendiente"
              />
              <FilaFuente
                fuente="DIMAR / CIOH"
                aporta="Erosión costera, batimetría, nivel del mar"
                estado="pendiente"
              />
              <FilaFuente
                fuente="Levantamiento propio (tesis)"
                aporta="Topografía detallada y modelo arquitectónico del equipamiento"
                estado="parcial"
                nota="El modelo BIM está publicado; la topografía está en proceso de integración."
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* Nota legal */}
      <section className="mt-12 rounded-lg border border-hueso-100/10 p-5">
        <h2 className="text-sm font-semibold text-hueso-200">Atribución obligatoria</h2>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-grafito-400">
          Los datos de OpenStreetMap se publican bajo licencia{' '}
          <a
            href="https://opendatacommons.org/licenses/odbl/1-0/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-turquesa-400 underline decoration-dotted underline-offset-2"
          >
            ODbL 1.0
          </a>
          . Cualquier producto derivado debe citar{' '}
          <strong className="text-hueso-200">© OpenStreetMap contributors</strong> y mantener la
          misma licencia. Las teselas de elevación provienen de{' '}
          <a
            href="https://registry.opendata.aws/terrain-tiles/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-turquesa-400 underline decoration-dotted underline-offset-2"
          >
            AWS Terrain Tiles
          </a>{' '}
          y la cartografía base de{' '}
          <a
            href="https://openfreemap.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-turquesa-400 underline decoration-dotted underline-offset-2"
          >
            OpenFreeMap
          </a>
          .
        </p>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------
//  Piezas de la página
// ------------------------------------------------------------------

function TarjetaResumen({
  icono,
  etiqueta,
  valor,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-turquesa-500" aria-hidden>
        {icono}
      </div>
      <p className="mt-2 text-[0.6875rem] uppercase tracking-wider text-grafito-500">{etiqueta}</p>
      <p className="mt-0.5 font-display text-xl text-hueso-100">{valor}</p>
    </div>
  );
}

function Campo({
  etiqueta,
  valor,
  enlace,
}: {
  etiqueta: string;
  valor: string;
  enlace?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-grafito-500">{etiqueta}</dt>
      <dd className="min-w-0 truncate text-right text-hueso-200">
        {enlace ? (
          <a
            href={enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-turquesa-400 underline decoration-dotted underline-offset-2"
          >
            {valor}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : (
          valor
        )}
      </dd>
    </div>
  );
}

function FilaFuente({
  fuente,
  aporta,
  estado,
  nota,
}: {
  fuente: string;
  aporta: string;
  estado: 'disponible' | 'parcial' | 'pendiente';
  nota?: string;
}) {
  const color =
    estado === 'disponible'
      ? 'text-verificado'
      : estado === 'parcial'
        ? 'text-pendiente'
        : 'text-grafito-500';

  const texto =
    estado === 'disponible' ? 'Integrada' : estado === 'parcial' ? 'Parcial' : 'Pendiente';

  return (
    <tr>
      <td className="px-4 py-3 align-top text-hueso-100">{fuente}</td>
      <td className="px-4 py-3 align-top text-grafito-400">
        {aporta}
        {nota && <span className="mt-1 block text-[0.6875rem] text-grafito-500">{nota}</span>}
      </td>
      <td className="px-4 py-3 align-top">
        <span className={`dato-mono inline-flex items-center gap-1.5 ${color}`}>
          {estado === 'parcial' ? (
            <AlertTriangle className="size-3" aria-hidden />
          ) : estado === 'pendiente' ? (
            <AlertTriangle className="size-3" aria-hidden />
          ) : (
            <CheckCircle2 className="size-3" aria-hidden />
          )}
          {texto}
        </span>
      </td>
    </tr>
  );
}
