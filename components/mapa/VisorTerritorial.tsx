'use client';

/**
 * Visor territorial 3D de TIERRA BOMBA 3D
 * ==================================================================
 * Componente central de la plataforma. Monta MapLibre GL JS con:
 *   - terreno real (AWS Terrain Tiles, sin token)
 *   - las capas del catálogo servidas como GeoJSON
 *   - extrusión 3D de edificaciones con altura declarada como aproximada
 *   - selección de elementos, medición de distancias y áreas
 *   - guardado de vistas en el navegador
 *
 * Decisiones de rendimiento:
 *   - Las capas se añaden una sola vez y se muestran u ocultan con
 *     `setLayoutProperty`, en lugar de destruirlas y recrearlas.
 *   - Las etiquetas se añaden en una segunda pasada para que queden
 *     por encima de todos los rellenos.
 *   - La extrusión solo se activa en modo 3D y solo para edificaciones.
 * ==================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
// MapLibre GL v6 no expone un export por defecto: se importa el modulo completo.
import * as maplibregl from 'maplibre-gl';
import type { Map as MapaML, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { length as longitudTurf } from '@turf/length';
import { area as areaTurf } from '@turf/area';
import { point as puntoTurf, lineString, polygon as poligonoTurf } from '@turf/helpers';

import { AREA_ESTUDIO, type DefinicionCapa } from '@/lib/catalogo';
import {
  CAPAS_CON_EXTRUSION,
  CAMPO_ID_VIVIENDA,
  ESTILOS_BASE,
  EXAGERACION_TERRENO,
  FUENTE_TERRENO,
  TEXTURAS,
  especificacionesDeCapa,
  esEditable,
  idExtrusion,
  idPunto,
  idRelleno,
  idLinea,
  idFuente,
  idsDeCapa,
  type NombreTextura,
} from '@/lib/geo/estilos';
import {
  borrarEdicion,
  contarEdiciones,
  exportarEdiciones,
  guardarEdicion,
  leerEdiciones,
  type EdicionVivienda,
  type MapaEdiciones,
} from '@/lib/viviendas';

/** Carga las texturas procedurales en el mapa antes de dibujar capas. */
async function cargarTexturas(mapa: MapaML) {
  const entradas = Object.entries(TEXTURAS);
  await Promise.all(
    entradas.map(async ([nombre, ruta]) => {
      if (mapa.hasImage(nombre)) return;
      try {
        const img = await mapa.loadImage(`${BASE}${ruta}`);
        // addImage puede fallar si otra carga simultánea ya lo añadió
        if (img?.data && !mapa.hasImage(nombre)) mapa.addImage(nombre, img.data);
      } catch {
        // Una textura que no carga no debe impedir ver el mapa:
        // la capa usará su color de respaldo.
      }
    })
  );
}

import { PanelCapas } from './PanelCapas';
import { FichaElemento } from './FichaElemento';
import { ControlesMapa } from './ControlesMapa';
import type { ElementoSeleccionado, ModoHerramienta, PuntoMedicion, ResultadoMedicion } from './tipos';

/**
 * Orden de dibujo de abajo arriba. Lo que no está en la lista va al
 * final. Las capas oficiales de delimitación van abajo; las
 * construcciones, encima; el límite insular, arriba del todo.
 */
const ORDEN_DIBUJO = [
  'catastro-sectores',
  'catastro-veredas',
  'catastro-barrios',
  'usos-suelo',
  'natural',
  'hidrografia',
  'catastro-manzanas',
  'catastro-predios',
  'catastro-unidades',
  'edificaciones',
  'catastro-construccion',
  'catastro-vias',
  'vias',
  'equipamientos',
  'limite-isla',
];

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * El editor de vivienda se carga solo cuando se abre.
 * Arrastra three.js (~600 kB), y no tiene sentido pagarlo al entrar al
 * visor si la mayoría de visitas solo van a mirar el mapa.
 */
const EditorVivienda = dynamic(
  () => import('./EditorVivienda').then((m) => m.EditorVivienda),
  { ssr: false }
);

/**
 * Vuelca las ediciones guardadas sobre el mapa.
 *
 * Se aplican como `feature-state`, no reescribiendo los GeoJSON: así el
 * color de una vivienda es una capa de información aparte, y borrar la
 * edición devuelve el mapa a su estado original sin reimportar nada.
 */
function aplicarEdiciones(mapa: MapaML, ediciones: MapaEdiciones) {
  const fuente = idFuente('catastro-construccion');
  if (!mapa.getSource(fuente)) return;

  for (const [codigo, e] of Object.entries(ediciones)) {
    try {
      mapa.setFeatureState({ source: fuente, id: codigo }, { colorMuro: e.colorMuro });
    } catch {
      // Un código que ya no exista en los datos no debe romper nada
    }
  }
}

/** Añade el prefijo de despliegue a una ruta pública. */
const urlPublica = (ruta: string) => `${BASE}${ruta}`;

export function VisorTerritorial({
  catalogo,
  className = 'h-[calc(100dvh-3.5rem)]',
}: {
  catalogo: DefinicionCapa[];
  /** Altura del contenedor. Permite incrustarlo en una tarjeta del panel. */
  className?: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapaML | null>(null);

  // Estado accesible desde los manejadores de MapLibre sin re-suscribir
  const visiblesRef = useRef<Set<string>>(new Set());
  const modo3dRef = useRef(true);
  const conTexturasRef = useRef(true);
  const herramientaRef = useRef<ModoHerramienta>('navegar');
  const catalogoRef = useRef(catalogo);
  const medicionRef = useRef<PuntoMedicion[]>([]);

  const [cargando, setCargando] = useState(true);
  const [errorMapa, setErrorMapa] = useState<string | null>(null);
  const [visibles, setVisibles] = useState<Set<string>>(
    () => new Set(catalogo.filter((c) => c.visibleInicial).map((c) => c.id))
  );
  const [modo3d, setModo3d] = useState(true);
  const [conTexturas, setConTexturas] = useState(true);
  const [pendienteTerreno, setPendienteTerreno] = useState(true);
  const [estiloBase, setEstiloBase] = useState<string>(ESTILOS_BASE[0].id);
  const [seleccion, setSeleccion] = useState<ElementoSeleccionado | null>(null);
  const [herramienta, setHerramienta] = useState<ModoHerramienta>('navegar');
  const [medicion, setMedicion] = useState<ResultadoMedicion | null>(null);
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null);
  const [zoom, setZoom] = useState(AREA_ESTUDIO.zoomInicial);
  const [panelMovilAbierto, setPanelMovilAbierto] = useState(false);
  /** Ediciones de vivienda guardadas en este navegador. */
  const [ediciones, setEdiciones] = useState<MapaEdiciones>({});
  /** Vivienda en edición, con los datos que el editor necesita. */
  const [objetivoEdicion, setObjetivoEdicion] = useState<{
    codigo: string;
    alturaOficial: number | null;
    areaHuella: number | null;
  } | null>(null);

  // El catálogo, ordenado para dibujar
  const catalogoOrdenado = useMemo(() => {
    const indice = (id: string) => {
      const i = ORDEN_DIBUJO.indexOf(id);
      return i === -1 ? ORDEN_DIBUJO.length : i;
    };
    return [...catalogo].sort((a, b) => indice(a.id) - indice(b.id));
  }, [catalogo]);

  useEffect(() => {
    catalogoRef.current = catalogoOrdenado;
  }, [catalogoOrdenado]);

  useEffect(() => {
    visiblesRef.current = visibles;
  }, [visibles]);

  useEffect(() => {
    herramientaRef.current = herramienta;
  }, [herramienta]);

  useEffect(() => {
    conTexturasRef.current = conTexturas;
  }, [conTexturas]);

  // ------------------------------------------------------------------
  //  Montaje de fuentes y capas
  // ------------------------------------------------------------------
  const montarCapas = useCallback((mapa: MapaML) => {
    // Pasada 1: geometrías
    for (const capa of catalogoRef.current) {
      const fuente = idFuente(capa.id);
      if (!mapa.getSource(fuente)) {
        mapa.addSource(fuente, {
          type: 'geojson',
          data: urlPublica(capa.archivo),
          // `promoteId` expone el código catastral como identificador de
          // elemento, que es lo que permite colorear cada vivienda por
          // separado con `setFeatureState` sin tocar los datos.
          ...(esEditable(capa) ? { promoteId: CAMPO_ID_VIVIENDA } : {}),
        });
      }
      const visible = visiblesRef.current.has(capa.id);
      for (const spec of especificacionesDeCapa(capa, modo3dRef.current, conTexturasRef.current)) {
        if (spec.type === 'symbol') continue;
        if (!mapa.getLayer(spec.id)) {
          mapa.addLayer({
            ...spec,
            layout: { ...(spec.layout ?? {}), visibility: visible ? 'visible' : 'none' },
          } as never);
        }
      }
    }

    // Pasada 2: etiquetas, siempre por encima
    for (const capa of catalogoRef.current) {
      const visible = visiblesRef.current.has(capa.id);
      for (const spec of especificacionesDeCapa(capa, modo3dRef.current, conTexturasRef.current)) {
        if (spec.type !== 'symbol') continue;
        if (!mapa.getLayer(spec.id)) {
          mapa.addLayer({
            ...spec,
            layout: { ...(spec.layout ?? {}), visibility: visible ? 'visible' : 'none' },
          } as never);
        }
      }
    }
  }, []);

  // ------------------------------------------------------------------
  //  Inicialización (una sola vez)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;

    let mapa: MapaML;
    try {
      mapa = new maplibregl.Map({
        container: contenedorRef.current,
        style: ESTILOS_BASE[0].url,
        center: [AREA_ESTUDIO.centro.lng, AREA_ESTUDIO.centro.lat],
        zoom: AREA_ESTUDIO.zoomInicial,
        pitch: 52,
        bearing: -18,
        maxPitch: 85,
        minZoom: 9,
        maxZoom: 19,
        attributionControl: { compact: true },
        // En MapLibre v6 el antialiasing se configura en los atributos
        // del contexto de canvas, no como opción directa del mapa.
        canvasContextAttributes: { antialias: true },
      });
    } catch (e) {
      setErrorMapa(
        'No se pudo inicializar el visor 3D. Tu navegador o tarjeta gráfica puede no soportar WebGL.'
      );
      setCargando(false);
      return;
    }

    mapaRef.current = mapa;
    mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    mapa.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 120 }), 'bottom-left');

    // --- Terreno -----------------------------------------------------
    const activarTerreno = () => {
      try {
        if (!mapa.getSource('terreno-dem')) {
          mapa.addSource('terreno-dem', {
            type: 'raster-dem',
            tiles: FUENTE_TERRENO.tiles,
            encoding: FUENTE_TERRENO.encoding,
            tileSize: FUENTE_TERRENO.tileSize,
            maxzoom: FUENTE_TERRENO.maxzoom,
            attribution: FUENTE_TERRENO.attribution,
          });
        }
        if (modo3dRef.current) {
          mapa.setTerrain({ source: 'terreno-dem', exaggeration: EXAGERACION_TERRENO });
        }
        // Cielo atmosférico: da profundidad sin coste apreciable
        if (!mapa.getLayer('cielo')) {
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
        }
      } catch {
        // Sin terreno el visor sigue siendo utilizable en 2D
        setPendienteTerreno(false);
      }
    };

    mapa.on('load', async () => {
      activarTerreno();
      // Las texturas deben existir ANTES de crear las capas que las
      // usan: MapLibre rechaza una capa cuyo patrón no esté cargado.
      await cargarTexturas(mapa);
      montarCapas(mapa);
      // Las ediciones guardadas se vuelcan en cuanto hay capas
      const guardadas = leerEdiciones();
      setEdiciones(guardadas);
      aplicarEdiciones(mapa, guardadas);
      setCargando(false);
    });

    // Al cambiar de estilo base, MapLibre elimina tanto las capas
    // propias como las imágenes: hay que volver a montar todo.
    let estiloInicial = true;
    mapa.on('style.load', async () => {
      if (estiloInicial) {
        estiloInicial = false;
        return;
      }
      activarTerreno();
      await cargarTexturas(mapa);
      montarCapas(mapa);
      aplicarEdiciones(mapa, leerEdiciones());
    });

    mapa.on('error', (e) => {
      // Errores de teselas ajenas no deben romper la interfaz
      if (process.env.NODE_ENV === 'development') {
        console.warn('[visor] error de tesela:', e?.error?.message ?? e);
      }
    });

    // --- Interacción -------------------------------------------------
    mapa.on('mousemove', (e: MapMouseEvent) => {
      setCursor({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });

    mapa.on('mouseout', () => setCursor(null));

    mapa.on('moveend', () => setZoom(mapa.getZoom()));

    mapa.on('click', (e: MapMouseEvent) => {
      // Modo medición: cada clic añade un vértice
      if (herramientaRef.current !== 'navegar') {
        medicionRef.current = [...medicionRef.current, { lng: e.lngLat.lng, lat: e.lngLat.lat }];
        actualizarMedicion(mapa, herramientaRef.current, medicionRef.current, setMedicion);
        return;
      }

      const capasConsultables = catalogoRef.current
        .filter((c) => visiblesRef.current.has(c.id))
        .flatMap((c) => [idRelleno(c.id), idLinea(c.id), idPunto(c.id)])
        .filter((id) => mapa.getLayer(id));

      if (!capasConsultables.length) return;

      const encontrados = mapa.queryRenderedFeatures(e.point, { layers: capasConsultables });
      if (!encontrados.length) {
        setSeleccion(null);
        return;
      }

      const f = encontrados[0];

      // Correspondencia exacta: el id de la capa dibujada es
      // `<prefijo>-<id de capa del catálogo>`, así que se comprueba
      // contra los ids concretos de esa capa, no por subcadena.
      const capaOrigen = catalogoRef.current.find((c) =>
        [idRelleno(c.id), idLinea(c.id), idPunto(c.id)].includes(f.layer.id)
      );

      const props = (f.properties ?? {}) as Record<string, unknown>;
      let areaM2: number | undefined;
      let longitudM: number | undefined;

      try {
        if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
          areaM2 = areaTurf(f as never);
        } else if (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString') {
          longitudM = longitudTurf(f as never, { units: 'kilometers' }) * 1000;
        }
      } catch {
        // La medición es un extra: si falla, la ficha sigue mostrándose
      }

      // Punto de anclaje de la ficha: el centro del elemento si es
      // puntual, o el punto donde se hizo clic en cualquier otro caso.
      const coords =
        f.geometry.type === 'Point'
          ? (f.geometry.coordinates as [number, number])
          : (e.lngLat.toArray() as [number, number]);

      setSeleccion({
        capaId: capaOrigen?.id ?? 'desconocida',
        propiedades: props,
        lng: coords[0],
        lat: coords[1],
        geometria: f.geometry.type,
        areaM2,
        longitudM,
      });
    });

    // Cursor de mano sobre elementos consultables
    const cambiarCursor = (e: MapMouseEvent) => {
      if (herramientaRef.current !== 'navegar') {
        mapa.getCanvas().style.cursor = 'crosshair';
        return;
      }
      const capasConsultables = catalogoRef.current
        .filter((c) => visiblesRef.current.has(c.id))
        .flatMap((c) => [idRelleno(c.id), idLinea(c.id), idPunto(c.id)])
        .filter((id) => mapa.getLayer(id));

      const hay = capasConsultables.length
        ? mapa.queryRenderedFeatures(e.point, { layers: capasConsultables }).length > 0
        : false;
      mapa.getCanvas().style.cursor = hay ? 'pointer' : '';
    };
    mapa.on('mousemove', cambiarCursor);

    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
  }, [montarCapas]);

  // ------------------------------------------------------------------
  //  Sincronizar visibilidad de capas
  // ------------------------------------------------------------------
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapa.isStyleLoaded()) return;

    for (const capa of catalogo) {
      const valor = visibles.has(capa.id) ? 'visible' : 'none';
      for (const spec of especificacionesDeCapa(capa, modo3d, conTexturas)) {
        if (mapa.getLayer(spec.id)) {
          mapa.setLayoutProperty(spec.id, 'visibility', valor);
        }
      }
    }
  }, [visibles, modo3d, catalogo]);

  // ------------------------------------------------------------------
  //  Sincronizar modo 3D (extrusión y terreno)
  // ------------------------------------------------------------------
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapa.isStyleLoaded()) return;

    // Extrusión: se añade o se quita según el modo, para todas las capas
    // que la admiten (OpenStreetMap y catastro oficial).
    for (const capa of catalogo) {
      if (!CAPAS_CON_EXTRUSION.has(capa.id)) continue;

      const extrusion = especificacionesDeCapa(capa, modo3d, conTexturas).find(
        (s) => s.type === 'fill-extrusion'
      );
      const visible = visibles.has(capa.id) ? 'visible' : 'none';
      const idExtr = idExtrusion(capa.id);

      if (extrusion && !mapa.getLayer(extrusion.id)) {
        mapa.addLayer({
          ...extrusion,
          layout: { ...(extrusion.layout ?? {}), visibility: visible },
        } as never);
      } else if (!extrusion && mapa.getLayer(idExtr)) {
        mapa.removeLayer(idExtr);
      } else if (extrusion && mapa.getLayer(extrusion.id)) {
        mapa.setLayoutProperty(extrusion.id, 'visibility', visible);
      }
    }

    try {
      if (modo3d) {
        mapa.setTerrain({ source: 'terreno-dem', exaggeration: EXAGERACION_TERRENO });
        mapa.easeTo({ pitch: Math.max(mapa.getPitch(), 50), duration: 700 });
      } else {
        mapa.setTerrain(null);
        mapa.easeTo({ pitch: 0, bearing: 0, duration: 700 });
      }
    } catch {
      setPendienteTerreno(false);
    }
  }, [modo3d, visibles, catalogo]);

  // ------------------------------------------------------------------
  //  Cambio de estilo base
  // ------------------------------------------------------------------
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    const estilo = ESTILOS_BASE.find((e) => e.id === estiloBase);
    if (!estilo) return;
    mapa.setStyle(estilo.url);
  }, [estiloBase]);

  // ------------------------------------------------------------------
  //  Limpiar medición al cambiar de herramienta
  // ------------------------------------------------------------------
  useEffect(() => {
    medicionRef.current = [];
    setMedicion(null);
    const mapa = mapaRef.current;
    if (mapa?.getSource('medicion')) {
      (mapa.getSource('medicion') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  }, [herramienta]);

  // ------------------------------------------------------------------
  //  Acciones
  // ------------------------------------------------------------------
  const alternarCapa = useCallback((id: string) => {
    setVisibles((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }, []);

  const soloEstaCapa = useCallback((id: string) => {
    setVisibles(new Set([id]));
  }, []);

  const encuadrar = useCallback(() => {
    mapaRef.current?.fitBounds(AREA_ESTUDIO.bounds, { padding: 60, duration: 1200 });
  }, []);

  const centrarEn = useCallback((lng: number, lat: number) => {
    mapaRef.current?.easeTo({ center: [lng, lat], zoom: 17, duration: 900 });
  }, []);

  const manejarGuardarVista = useCallback(
    (nombre: string) => {
      const mapa = mapaRef.current;
      if (!mapa) return;
      const c = mapa.getCenter();
      const vista = {
        nombre,
        lng: c.lng,
        lat: c.lat,
        zoom: mapa.getZoom(),
        pitch: mapa.getPitch(),
        bearing: mapa.getBearing(),
        capas: [...visibles],
        fecha: new Date().toISOString(),
      };
      try {
        const previas = JSON.parse(localStorage.getItem('tb3d:vistas') ?? '[]');
        localStorage.setItem('tb3d:vistas', JSON.stringify([...previas, vista].slice(-20)));
      } catch {
        // Sin almacenamiento disponible: no es crítico
      }
    },
    [visibles]
  );

  return (
    <div className={`relative w-full overflow-hidden bg-oceano-950 ${className}`}>
      <div
        ref={contenedorRef}
        className="absolute inset-0"
        aria-label="Visor territorial 3D de la isla de Tierra Bomba"
        role="application"
      />

      {/* Aviso de error de WebGL */}
      {errorMapa && (
        <div className="absolute inset-0 z-50 grid place-items-center p-6">
          <div className="panel max-w-md p-6 text-center">
            <h2 className="font-display text-xl text-hueso-100">No se pudo cargar el visor 3D</h2>
            <p className="mt-2 text-sm text-grafito-400">{errorMapa}</p>
            <p className="mt-4 text-xs text-grafito-500">
              La información sigue disponible en las secciones de equipamientos, construcciones y
              datos.
            </p>
          </div>
        </div>
      )}

      {/* Carga inicial */}
      {cargando && !errorMapa && (
        <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center">
          <div className="panel flex items-center gap-3 px-5 py-3">
            <span className="size-2 animate-pulse rounded-full bg-turquesa-500" />
            <span className="text-sm text-hueso-200">Cargando territorio…</span>
          </div>
        </div>
      )}

      {/* Panel de capas — fijo en escritorio, deslizante en móvil */}
      <div className={clasesPanel(panelMovilAbierto)}>
        <PanelCapas
          catalogo={catalogo}
          visibles={visibles}
          alAlternar={alternarCapa}
          alSoloEsta={soloEstaCapa}
          alCerrar={() => setPanelMovilAbierto(false)}
        />
      </div>

      {/* Velo para cerrar el panel en móvil */}
      {panelMovilAbierto && (
        <button
          type="button"
          aria-label="Cerrar el panel de capas"
          onClick={() => setPanelMovilAbierto(false)}
          className="absolute inset-0 z-20 bg-oceano-950/60 backdrop-blur-[2px] md:hidden"
        />
      )}

      {/* Controles: 2D/3D, estilo base, medición, vistas */}
      <ControlesMapa
        modo3d={modo3d}
        alCambiarModo3d={setModo3d}
        estiloBase={estiloBase}
        alCambiarEstilo={setEstiloBase}
        herramienta={herramienta}
        alCambiarHerramienta={setHerramienta}
        medicion={medicion}
        alLimpiarMedicion={() => {
          medicionRef.current = [];
          setMedicion(null);
          const mapa = mapaRef.current;
          if (mapa?.getSource('medicion')) {
            (mapa.getSource('medicion') as maplibregl.GeoJSONSource).setData({
              type: 'FeatureCollection',
              features: [],
            });
          }
        }}
        alGuardarVista={manejarGuardarVista}
        alEncuadrar={encuadrar}
        alRestaurarVista={(v) => {
          mapaRef.current?.easeTo({
            center: [v.lng, v.lat],
            zoom: v.zoom,
            pitch: v.pitch,
            bearing: v.bearing,
            duration: 1100,
          });
          if (v.capas?.length) setVisibles(new Set(v.capas));
        }}
        pendienteTerreno={pendienteTerreno}
        alAbrirPanel={() => setPanelMovilAbierto(true)}
        viviendasEditadas={Object.keys(ediciones).length}
        alExportarViviendas={exportarEdiciones}
      />

      {/* Ficha del elemento seleccionado */}
      {seleccion && (
        <FichaElemento
          elemento={seleccion}
          capa={catalogo.find((c) => c.id === seleccion.capaId)}
          alCerrar={() => setSeleccion(null)}
          alCentrar={() => centrarEn(seleccion.lng, seleccion.lat)}
          alEditar={
            seleccion.capaId === 'catastro-construccion'
              ? () => {
                  const codigo = String(seleccion.propiedades[CAMPO_ID_VIVIENDA] ?? '');
                  if (!codigo) return;
                  const altura = Number(seleccion.propiedades.altura_tot);
                  setObjetivoEdicion({
                    codigo,
                    alturaOficial: Number.isFinite(altura) && altura > 0 ? altura : null,
                    areaHuella: seleccion.areaM2 ?? null,
                  });
                }
              : undefined
          }
        />
      )}

      {/* Editor de vivienda: se carga solo al abrirse */}
      {objetivoEdicion && (
        <EditorVivienda
          codigo={objetivoEdicion.codigo}
          alturaOficial={objetivoEdicion.alturaOficial}
          areaHuella={objetivoEdicion.areaHuella}
          edicion={ediciones[objetivoEdicion.codigo] ?? null}
          alGuardar={(e) => {
            setEdiciones(guardarEdicion(e));
            const mapa = mapaRef.current;
            const fuente = idFuente('catastro-construccion');
            if (mapa?.getSource(fuente)) {
              try {
                mapa.setFeatureState({ source: fuente, id: e.codigo }, { colorMuro: e.colorMuro });
              } catch {
                // El elemento puede no estar en el estilo actual
              }
            }
          }}
          alBorrar={() => {
            const codigo = objetivoEdicion.codigo;
            setEdiciones(borrarEdicion(codigo));
            const mapa = mapaRef.current;
            const fuente = idFuente('catastro-construccion');
            if (mapa?.getSource(fuente)) {
              try {
                mapa.removeFeatureState({ source: fuente, id: codigo }, 'colorMuro');
              } catch {
                // Nada que revertir
              }
            }
            setObjetivoEdicion(null);
          }}
          alCerrar={() => setObjetivoEdicion(null)}
        />
      )}

      {/* Lectura de coordenadas */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 md:block">
        <div className="panel dato-mono flex items-center gap-4 px-3 py-1.5 text-grafito-400">
          <span className="text-turquesa-400">TIERRA BOMBA</span>
          <span>
            {cursor
              ? `${cursor.lat.toFixed(5)}° N  ${Math.abs(cursor.lng).toFixed(5)}° O`
              : 'Mueve el cursor sobre el mapa'}
          </span>
          <span>Z{zoom.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Clases del contenedor del panel lateral.
 * En escritorio siempre visible; en móvil entra y sale de pantalla.
 * `pointer-events-none` cuando está oculto evita capturar clics sobre
 * el mapa en móvil.
 */
function clasesPanel(abierto: boolean) {
  return [
    'absolute left-0 top-0 z-30 h-full w-[19rem] max-w-[85vw] p-3',
    'transition-transform duration-300 ease-out',
    'md:translate-x-0 md:pointer-events-auto',
    abierto ? 'translate-x-0' : '-translate-x-full pointer-events-none md:pointer-events-auto',
  ].join(' ');
}

/**
 * Recalcula la medición en curso, la dibuja en el mapa y publica el
 * resultado en el estado de React.
 *
 * Se define fuera del componente para no recrear el mapa, por lo que
 * recibe los vértices y el actualizador de estado como argumentos en
 * lugar de depender del cierre del componente.
 */
function actualizarMedicion(
  mapa: MapaML,
  herramienta: ModoHerramienta,
  puntos: PuntoMedicion[],
  setMedicion: (r: ResultadoMedicion) => void
) {
  if (puntos.length === 0) return;

  const coords = puntos.map((p) => [p.lng, p.lat]) as [number, number][];
  const features: GeoJSON.Feature[] = [];

  if (herramienta === 'medir-distancia' && coords.length >= 2) {
    const linea = lineString(coords);
    const km = longitudTurf(linea, { units: 'kilometers' });
    features.push(linea as never);
    for (const c of coords) features.push(puntoTurf(c) as never);

    pintarMedicion(mapa, features);
    setMedicion({ puntos, distanciaM: km * 1000 });
    return;
  }

  if (herramienta === 'medir-area' && coords.length >= 3) {
    const anillo = [...coords, coords[0]] as [number, number][];
    const poly = poligonoTurf([anillo]);
    const m2 = areaTurf(poly);
    const perimetro = longitudTurf(lineString(anillo), { units: 'kilometers' }) * 1000;

    features.push(poly as never);
    for (const c of coords) features.push(puntoTurf(c) as never);

    pintarMedicion(mapa, features);
    setMedicion({ puntos, areaM2: m2, perimetroM: perimetro });
    return;
  }

  // Aún no hay suficientes vértices: dibujar solo los puntos
  for (const c of coords) features.push(puntoTurf(c) as never);
  pintarMedicion(mapa, features);
  setMedicion({ puntos });
}

/** Vuelca las geometrías de medición en el mapa. */
function pintarMedicion(mapa: MapaML, features: GeoJSON.Feature[]) {
  const datos: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

  try {
    if (!mapa.getSource('medicion')) {
      mapa.addSource('medicion', { type: 'geojson', data: datos });
      mapa.addLayer({
        id: 'medicion-relleno',
        type: 'fill',
        source: 'medicion',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#39B8B0', 'fill-opacity': 0.22 },
      });
      mapa.addLayer({
        id: 'medicion-linea',
        type: 'line',
        source: 'medicion',
        filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'LineString']]],
        paint: {
          'line-color': '#39B8B0',
          'line-width': 2,
          'line-dasharray': [2, 1],
        },
      });
      mapa.addLayer({
        id: 'medicion-vertices',
        type: 'circle',
        source: 'medicion',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 4,
          'circle-color': '#08171f',
          'circle-stroke-color': '#39B8B0',
          'circle-stroke-width': 2,
        },
      });
    } else {
      (mapa.getSource('medicion') as maplibregl.GeoJSONSource).setData(datos);
    }
  } catch {
    // El mapa puede estar cambiando de estilo: la medición se reintenta
  }
}
