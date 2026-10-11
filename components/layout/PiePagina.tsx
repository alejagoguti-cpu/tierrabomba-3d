import Link from 'next/link';
import { RUTAS } from '@/lib/rutas';

/**
 * Pie de página común a las secciones de contenido.
 * Incluye las atribuciones obligatorias de las fuentes de datos, que
 * no pueden omitirse por licencia (ODbL de OpenStreetMap).
 */
export function PiePagina() {
  return (
    <footer className="border-t border-hueso-100/10 bg-oceano-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-3">
          {/* Identidad */}
          <div>
            <p className="font-display text-lg tracking-tight text-hueso-100">
              TIERRA BOMBA <span className="text-turquesa-500">3D</span>
            </p>
            <p className="mt-2 max-w-xs text-[0.8125rem] leading-relaxed text-grafito-400">
              Plataforma de información territorial, arquitectura y transformación de la isla de
              Tierra Bomba, Cartagena de Indias.
            </p>
            <p className="mt-4 text-[0.75rem] leading-relaxed text-grafito-500">
              Tesis de Grado en Arquitectura &amp; Urbanismo, 2026
              <br />
              Alejandra Gómez &amp; Ana Casas
            </p>
          </div>

          {/* Secciones */}
          <nav aria-label="Secciones de la plataforma">
            <h2 className="dato-mono mb-3 text-grafito-500">SECCIONES</h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {RUTAS.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="text-[0.8125rem] text-grafito-400 transition hover:text-turquesa-400"
                  >
                    {r.titulo}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Fuentes y atribución */}
          <div>
            <h2 className="dato-mono mb-3 text-grafito-500">FUENTES DE DATOS</h2>
            <ul className="space-y-1.5 text-[0.8125rem] text-grafito-400">
              <li>
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-turquesa-400"
                >
                  © OpenStreetMap contributors
                </a>{' '}
                <span className="text-grafito-500">(ODbL 1.0)</span>
              </li>
              <li>
                <a
                  href="https://registry.opendata.aws/terrain-tiles/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-turquesa-400"
                >
                  AWS Terrain Tiles
                </a>{' '}
                <span className="text-grafito-500">(elevación)</span>
              </li>
              <li>
                <a
                  href="https://openfreemap.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-turquesa-400"
                >
                  OpenFreeMap
                </a>{' '}
                <span className="text-grafito-500">(cartografía base)</span>
              </li>
            </ul>

            <p className="mt-4 text-[0.6875rem] leading-relaxed text-grafito-500">
              Los datos de OpenStreetMap son colaborativos y no equivalen a un levantamiento
              oficial. Consulta las limitaciones de cada capa en la sección de datos.
            </p>
          </div>
        </div>

        <div className="regla my-8" />

        <div className="flex flex-col gap-2 text-[0.6875rem] text-grafito-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Código bajo licencia MIT. Modelo BIM y datos del territorio © 2026 Alejandra Gómez &amp;
            Ana Casas.
          </p>
          <p className="dato-mono">
            ISLA 10.34975° N, 75.57050° O · OSM relation/11226348
          </p>
        </div>
      </div>
    </footer>
  );
}
