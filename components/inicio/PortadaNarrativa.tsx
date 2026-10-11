'use client';

/**
 * Portada narrativa de TIERRA BOMBA 3D
 * ==================================================================
 * Experiencia de scroll: un mapa 3D fijo ocupa toda la pantalla y las
 * escenas de texto se desplazan por encima. Cada escena mueve la
 * cámara y activa capas reales.
 *
 * El mapa es el mismo motor que el visor (MapLibre GL + terreno AWS +
 * capas GeoJSON de OpenStreetMap). No es un vídeo ni una imagen: el
 * usuario puede arrastrar y hacer zoom en cualquier momento.
 *
 * Rendimiento: las capas se montan una sola vez y se muestran u
 * ocultan; la cámara se anima con `flyTo`, que MapLibre interpola en
 * la GPU.
 * ==================================================================
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapaML } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ArrowRight, Compass, Layers, MapPin, Ruler, Waves } from 'lucide-react';

import { AREA_ESTUDIO, type DefinicionCapa } from '@/lib/catalogo';
import {
  ESTILOS_BASE,
  EXAGERACION_TERRENO,
  FUENTE_TERRENO,
  especificacionesDeCapa,
  idFuente,
} from '@/lib/geo/estilos';
import { numero } from '@/lib/utils';
import type { ResumenDatos } from '@/lib/datos/servidor';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const urlPublica = (ruta: string) => `${BASE}${ruta}`;

/** Definición de cada escena: cámara, capas y texto. */
interface Escena {
  id: string;
  etiqueta: string;
  titulo: string;
  parrafo: string;
  camara: { center: [number, number]; zoom: number; pitch: number; bearing: number };
  capas: string[];
}

const ESCENAS: Escena[] = [
  {
    id: 'introduccion',
    etiqueta: 'Isla de Tierra Bomba',
    titulo: 'TIERRA BOMBA',
    parrafo:
      'Una isla de 19 km² frente a Cartagena de Indias. Sin red pública de acueducto, con pozos salinizados y una costa que retrocede por erosión.',
    camara: { center: [-75.5705, 10.34975], zoom: 11.6, pitch: 42, bearing: -20 },
    capas: ['limite-isla'],
  },
  {
    id: 'territorio',
    etiqueta: 'Descubrir el territorio',
    titulo: 'El territorio',
    parrafo:
      'El límite insular y los usos del suelo registrados dibujan un territorio bajo y arenoso, con la meseta interior como única cota segura frente al mar.',
    camara: { center: [-75.5705, 10.34975], zoom: 13.2, pitch: 52, bearing: -28 },
    capas: ['limite-isla', 'usos-suelo', 'edificaciones'],
  },
  {
    id: 'sistemas',
    etiqueta: 'Comprender sus sistemas',
    titulo: 'Movilidad y servicios',
    parrafo:
      'La red de vías y senderos conecta los asentamientos. Los equipamientos comunitarios son escasos y su distribución es desigual.',
    camara: { center: [-75.573, 10.352], zoom: 14.3, pitch: 58, bearing: 12 },
    capas: ['limite-isla', 'edificaciones', 'vias', 'equipamientos'],
  },
  {
    id: 'catastro',
    etiqueta: 'Medir con dato oficial',
    titulo: 'El catastro',
    parrafo:
      'La cartografía catastral del área metropolitana registra 2.714 construcciones y 2.584 predios en la isla, con altura y número de pisos. El 99 % de las construcciones tiene una sola planta, de 3 metros: el caserío de Tierra Bomba es abrumadoramente horizontal.',
    camara: { center: [-75.5705, 10.34975], zoom: 15.2, pitch: 68, bearing: -34 },
    capas: ['limite-isla', 'catastro-construccion', 'catastro-predios'],
  },
  {
    id: 'ambiente',
    etiqueta: 'Leer el litoral',
    titulo: 'El borde costero',
    parrafo:
      'Playas, humedales y elementos naturales cartografiados. El manglar solo aparece donde la comunidad lo ha documentado: no hay todavía datos oficiales de ecosistemas.',
    camara: { center: [-75.588, 10.336], zoom: 14.6, pitch: 62, bearing: -60 },
    capas: ['limite-isla', 'natural', 'hidrografia', 'usos-suelo'],
  },
  {
    id: 'visor',
    etiqueta: 'Acceder al visor',
    titulo: 'Explora el atlas completo',
    parrafo:
      'Levanta cada capa, mide distancias, consulta la ficha de cualquier edificación y guarda tus vistas. Todo sobre datos verificables y con su fuente declarada.',
    camara: { center: [-75.5705, 10.34975], zoom: 13.4, pitch: 52, bearing: -18 },
    capas: [
      'limite-isla',
      'usos-suelo',
      'catastro-construccion',
      'catastro-predios',
      'vias',
      'equipamientos',
      'natural',
    ],
  },
];

interface Props {
  catalogo: DefinicionCapa[];
  resumen: ResumenDatos;
}

export function PortadaNarrativa({ catalogo, resumen }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapaML | null>(null);
  const seccionesRef = useRef<Array<HTMLElement | null>>([]);
  const [escenaActiva, setEscenaActiva] = useState(0);
  const [mapaListo, setMapaListo] = useState(false);

  // Las capas que la portada puede mostrar, en orden de dibujo
  const capasPortada = catalogo.filter((c) =>
    [
      'catastro-sectores',
      'catastro-barrios',
      'usos-suelo',
      'natural',
      'hidrografia',
      'catastro-predios',
      'catastro-construccion',
      'edificaciones',
      'vias',
      'equipamientos',
      'limite-isla',
    ].includes(c.id)
  );

  // ------------------------------------------------------------------
  //  Montaje del mapa
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;

    const mapa = new maplibregl.Map({
      container: contenedorRef.current,
      style: ESTILOS_BASE[0].url,
      center: ESCENAS[0].camara.center,
      zoom: ESCENAS[0].camara.zoom,
      pitch: ESCENAS[0].camara.pitch,
      bearing: ESCENAS[0].camara.bearing,
      maxPitch: 80,
      minZoom: 9,
      maxZoom: 18,
      interactive: true,
      attributionControl: { compact: true },
      canvasContextAttributes: { antialias: true },
    });

    mapaRef.current = mapa;

    mapa.on('load', () => {
      // Terreno real
      try {
        mapa.addSource('terreno-dem', {
          type: 'raster-dem',
          tiles: FUENTE_TERRENO.tiles,
          encoding: FUENTE_TERRENO.encoding,
          tileSize: FUENTE_TERRENO.tileSize,
          maxzoom: FUENTE_TERRENO.maxzoom,
          attribution: FUENTE_TERRENO.attribution,
        });
        mapa.setTerrain({ source: 'terreno-dem', exaggeration: EXAGERACION_TERRENO });
        mapa.addLayer({
          id: 'cielo',
          type: 'sky',
          paint: {
            'sky-color': '#0c212d',
            'sky-horizon-blend': 0.6,
            'horizon-color': '#1e5068',
            'horizon-fog-blend': 0.5,
            'fog-color': '#102c3b',
            'fog-ground-blend': 0.85,
          },
        } as never);
      } catch {
        // Sin relieve la portada sigue siendo válida en 2D
      }

      // Capas, todas montadas y ocultas salvo las de la primera escena
      for (const capa of capasPortada) {
        mapa.addSource(idFuente(capa.id), {
          type: 'geojson',
          data: urlPublica(capa.archivo),
        });
        const visibles = new Set(ESCENAS[0].capas);
        for (const spec of especificacionesDeCapa(capa, true)) {
          mapa.addLayer({
            ...spec,
            layout: {
              ...(spec.layout ?? {}),
              visibility: visibles.has(capa.id) ? 'visible' : 'none',
            },
          } as never);
        }
      }

      aplicarEscena(mapa, 0);
      setMapaListo(true);
    });

    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Aplica la cámara y la visibilidad de capas de una escena. */
  const aplicarEscena = (mapa: MapaML, indice: number) => {
    const escena = ESCENAS[indice];
    if (!escena) return;

    mapa.flyTo({
      center: escena.camara.center,
      zoom: escena.camara.zoom,
      pitch: escena.camara.pitch,
      bearing: escena.camara.bearing,
      duration: 1800,
      essential: true,
      curve: 1.4,
    });

    const visibles = new Set(escena.capas);
    for (const capa of capasPortada) {
      for (const spec of especificacionesDeCapa(capa, true)) {
        if (mapa.getLayer(spec.id)) {
          mapa.setLayoutProperty(
            spec.id,
            'visibility',
            visibles.has(capa.id) ? 'visible' : 'none'
          );
        }
      }
    }
  };

  // ------------------------------------------------------------------
  //  Observar qué escena está en pantalla
  // ------------------------------------------------------------------
  useEffect(() => {
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          const indice = Number((entrada.target as HTMLElement).dataset.indice);
          if (Number.isNaN(indice)) continue;
          setEscenaActiva(indice);
          if (mapaRef.current) aplicarEscena(mapaRef.current, indice);
        }
      },
      { threshold: 0.55 }
    );

    for (const s of seccionesRef.current) if (s) observador.observe(s);
    return () => observador.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capasPortada.length]);

  return (
    <div className="relative">
      {/* Mapa fijo de fondo */}
      <div className="sticky top-0 z-0 h-dvh w-full overflow-hidden">
        <div ref={contenedorRef} className="absolute inset-0" aria-hidden />

        {/* Velo para garantizar la legibilidad del texto sobre el mapa */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-oceano-950/85 via-oceano-950/35 to-oceano-950/90"
          aria-hidden
        />

        {/* Indicador de escena */}
        <nav
          className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 md:flex"
          aria-label="Escenas de la portada"
        >
          {ESCENAS.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                seccionesRef.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              aria-label={`Ir a la escena: ${e.etiqueta}`}
              aria-current={escenaActiva === i ? 'true' : undefined}
              className="group flex items-center justify-end gap-2"
            >
              <span
                className={[
                  'dato-mono whitespace-nowrap transition-opacity',
                  escenaActiva === i
                    ? 'text-turquesa-400 opacity-100'
                    : 'text-grafito-400 opacity-0 group-hover:opacity-100',
                ].join(' ')}
              >
                {e.etiqueta}
              </span>
              <span
                className={[
                  'block rounded-full transition-all duration-300',
                  escenaActiva === i
                    ? 'h-6 w-1 bg-turquesa-500'
                    : 'h-1.5 w-1.5 bg-grafito-500 group-hover:bg-hueso-200',
                ].join(' ')}
              />
            </button>
          ))}
        </nav>

        {/* Barra inferior con datos reales */}
        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="panel flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2">
              <Dato icono={<MapPin className="size-3" />} etiqueta="Entidades reales" valor={numero(resumen.totalEntidades)} />
              <Dato icono={<Layers className="size-3" />} etiqueta="Capas" valor={numero(resumen.totalCapas)} />
              <Dato icono={<Waves className="size-3" />} etiqueta="Área" valor="~19 km²" />
              <Dato
                icono={<Ruler className="size-3" />}
                etiqueta="Actualizado"
                valor={resumen.fechaActualizacion ?? 'sin datos'}
              />
            </div>

            {mapaListo && (
              <div className="panel hidden items-center gap-2 px-3 py-2 sm:flex">
                <Compass className="size-3.5 text-turquesa-400" aria-hidden />
                <span className="dato-mono text-grafito-400">
                  Arrastra el mapa para explorar libremente
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Escenas de texto, por encima del mapa */}
      <div className="relative z-10 -mt-[100dvh]">
        {ESCENAS.map((escena, i) => (
          <section
            key={escena.id}
            ref={(el) => {
              seccionesRef.current[i] = el;
            }}
            data-indice={i}
            className="flex h-dvh items-center"
            aria-label={escena.etiqueta}
          >
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
              <div className="max-w-2xl">
                <p className="dato-mono text-turquesa-400 uppercase tracking-[0.18em]">
                  {escena.etiqueta}
                </p>

                {i === 0 ? (
                  <h1 className="mt-3 font-display text-display text-hueso-100">{escena.titulo}</h1>
                ) : (
                  <h2 className="mt-3 font-display text-titulo text-hueso-100">{escena.titulo}</h2>
                )}

                <p className="mt-4 max-w-xl text-base leading-relaxed text-hueso-200/85 sm:text-lg">
                  {escena.parrafo}
                </p>

                {i === 0 && (
                  <>
                    <p className="mt-2 max-w-xl text-base leading-relaxed text-arena-400 sm:text-lg">
                      Plataforma de información territorial, arquitectura y transformación.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <Link
                        href="/explorar"
                        className="group inline-flex items-center gap-2 rounded-lg bg-turquesa-500 px-6 py-3 text-sm font-semibold text-oceano-950 transition hover:bg-turquesa-400"
                      >
                        Explorar territorio
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                      <Link
                        href="/datos"
                        className="inline-flex items-center gap-2 rounded-lg border border-hueso-100/20 px-6 py-3 text-sm font-medium text-hueso-100 transition hover:border-hueso-100/40 hover:bg-hueso-100/5"
                      >
                        Ver las fuentes
                      </Link>
                    </div>
                  </>
                )}

                {i === ESCENAS.length - 1 && (
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Link
                      href="/explorar"
                      className="group inline-flex items-center gap-2 rounded-lg bg-turquesa-500 px-6 py-3 text-sm font-semibold text-oceano-950 transition hover:bg-turquesa-400"
                    >
                      Abrir el visor territorial
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <Link
                      href="/equipamientos"
                      className="inline-flex items-center gap-2 rounded-lg border border-hueso-100/20 px-6 py-3 text-sm font-medium text-hueso-100 transition hover:border-hueso-100/40 hover:bg-hueso-100/5"
                    >
                      Catálogo de equipamientos
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Dato con icono de la barra inferior. */
function Dato({
  icono,
  etiqueta,
  valor,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-turquesa-500" aria-hidden>
        {icono}
      </span>
      <span className="dato-mono text-grafito-400">{etiqueta}</span>
      <span className="dato-mono text-hueso-100">{valor}</span>
    </div>
  );
}
