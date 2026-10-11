'use client';

/**
 * Ficha interactiva de un elemento seleccionado en el mapa.
 *
 * REGLA DE ORO DE ESTA FICHA
 *   Solo se muestra información que existe en el dato. Los campos sin
 *   valor se muestran explícitamente como "Información no disponible":
 *   nunca se rellenan con estimaciones silenciosas.
 *
 *   Es el caso, por ejemplo, de la altura: de las 827 edificaciones de
 *   la isla, solo 1 tiene `height` y 2 tienen `building:levels`. La
 *   ficha lo dice, en lugar de inventar un número.
 */

import { Crosshair, ExternalLink, Ruler, Scan, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { ETIQUETA_ESTADO, type DefinicionCapa } from '@/lib/catalogo';
import { ALTURA_APROXIMADA_M } from '@/lib/geo/estilos';
import { area as formatearArea, coordenadas, longitud as formatearLongitud, siNo } from '@/lib/utils';
import type { ElementoSeleccionado } from './tipos';

interface Props {
  elemento: ElementoSeleccionado;
  capa?: DefinicionCapa;
  alCerrar: () => void;
  alCentrar: () => void;
}

/** Valor o el texto normalizado de ausencia de dato. */
const valor = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return 'Información no disponible';
  const s = String(v).trim();
  return s === '' ? 'Información no disponible' : s;
};

/** Título legible del elemento, a partir de sus etiquetas de OSM. */
function tituloDe(props: Record<string, unknown>): string {
  if (props.name) return String(props.name);

  const claves = [
    'building',
    'amenity',
    'shop',
    'leisure',
    'healthcare',
    'tourism',
    'office',
    'highway',
    'landuse',
    'natural',
    'waterway',
  ];
  for (const k of claves) {
    if (props[k]) {
      const v = String(props[k]);
      return v === 'yes' ? `${k}` : v.replace(/_/g, ' ');
    }
  }
  return 'Elemento sin nombre registrado';
}

/** Construye la lista de campos a mostrar, marcando los ausentes. */
function camposDe(
  elemento: ElementoSeleccionado
): Array<{ etiqueta: string; valor: string; ausente: boolean }> {
  const p = elemento.propiedades;

  const bruto: Array<[string, unknown]> = [
    ['Identificador OSM', p.osm_tipo && p.osm_id ? `${p.osm_tipo}/${p.osm_id}` : undefined],
    ['Código catastral', p.codigo],
    ['Nombre', p.name],
    ['Tipo de edificación', p.building],
    ['Equipamiento', p.amenity],
    ['Comercio', p.shop],
    ['Recreación', p.leisure],
    ['Salud', p.healthcare],
    ['Culto', p.religion],
    ['Tipo de vía', p.highway],
    ['Uso del suelo', p.landuse],
    ['Elemento natural', p.natural],
    // --- Atributos del catastro oficial ---
    ['Altura registrada', p.height ? `${p.height} m` : undefined],
    ['Altura total (catastro)', p.altura_tot ? `${p.altura_tot} m` : undefined],
    ['Número de pisos (catastro)', p.total_piso],
    ['Área construida (catastro)', p.area_total ? `${Number(p.area_total).toFixed(1)} m²` : undefined],
    ['Tipo de construcción', p.tipo_const],
    ['Tipo de planta', p.tipo_plant],
    ['Tipo de dominio', p.tipo_domin],
    // --- Atributos de OpenStreetMap ---
    ['Número de niveles', p['building:levels']],
    ['Material', p.material],
    ['Superficie', p.surface],
    ['Ancho', p.width ? `${p.width} m` : undefined],
    ['Dirección', p['addr:street'] && p['addr:housenumber'] ? `${p['addr:street']} ${p['addr:housenumber']}` : undefined],
    ['Acceso peatonal', p.foot ? siNo(String(p.foot)) : undefined],
    ['Acceso en moto', p.motorcycle ? siNo(String(p.motorcycle)) : undefined],
    ['Acceso', p.access],
    ['Pendiente', p.incline],
  ];

  return bruto.map(([etiqueta, v]) => ({
    etiqueta,
    valor: valor(v),
    ausente: v === undefined || v === null || v === '',
  }));
}

export function FichaElemento({ elemento, capa, alCerrar, alCentrar }: Props) {
  const campos = camposDe(elemento);
  const presentes = campos.filter((c) => !c.ausente);
  const ausentes = campos.filter((c) => c.ausente);

  const estado = capa ? ETIQUETA_ESTADO[capa.estadoValidacion] : null;

  // Distinguir tres casos, porque el mensaje al usuario es distinto:
  //   - construcción del catastro: la altura ES un dato oficial
  //   - edificación de OSM sin altura: se extruye con una aproximación
  //   - cualquier otra capa: no aplica
  const esCatastroConstruccion = elemento.capaId === 'catastro-construccion';
  const esEdificacionOSM = elemento.capaId === 'edificaciones';
  const alturaOficial = esCatastroConstruccion && Number(elemento.propiedades.altura_tot) > 0;
  const alturaAproximada = esEdificacionOSM && !elemento.propiedades.height;

  // Solo se listan los campos ausentes que tienen sentido para el tipo
  // de elemento: enumerar veinte ausencias en una vía sería ruido.
  const ausentesRelevantes = ausentes.filter((c) =>
    esCatastroConstruccion
      ? ['Nombre', 'Tipo de construcción', 'Tipo de dominio'].includes(c.etiqueta)
      : esEdificacionOSM
        ? ['Nombre', 'Número de niveles', 'Altura registrada', 'Material', 'Dirección'].includes(
            c.etiqueta
          )
        : ['Nombre', 'Superficie', 'Ancho', 'Acceso', 'Pendiente'].includes(c.etiqueta)
  );

  return (
    <section
      className="panel absolute right-3 top-3 z-30 flex max-h-[calc(100dvh-1.5rem)] w-[21rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden"
      aria-label="Ficha del elemento seleccionado"
    >
      {/* Cabecera */}
      <header className="border-b border-hueso-100/10 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="dato-mono text-turquesa-400 uppercase tracking-wider">
              {capa?.titulo ?? 'Elemento'}
            </p>
            <h2 className="mt-0.5 truncate font-display text-lg leading-tight text-hueso-100">
              {tituloDe(elemento.propiedades)}
            </h2>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            className="shrink-0 rounded-md p-1.5 text-grafito-400 transition hover:bg-hueso-100/10 hover:text-hueso-100"
            aria-label="Cerrar la ficha"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {estado && (
            <span
              className="dato-mono rounded-full px-2 py-0.5"
              style={{
                backgroundColor: `color-mix(in oklab, ${estado.color} 22%, transparent)`,
                color: estado.color,
              }}
            >
              {estado.texto}
            </span>
          )}
          <span className="dato-mono rounded-full bg-hueso-100/10 px-2 py-0.5 text-grafito-400">
            {elemento.geometria}
          </span>
        </div>
      </header>

      {/* Cuerpo */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {/* Altura con dato oficial del catastro */}
        {alturaOficial && (
          <div className="mb-3 flex gap-2 rounded-lg border border-verificado/30 bg-verificado/10 px-3 py-2">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-verificado" aria-hidden />
            <p className="text-[0.6875rem] leading-relaxed text-hueso-200">
              Altura y número de pisos <strong>registrados por el catastro oficial</strong>:{' '}
              {String(elemento.propiedades.altura_tot)} m,{' '}
              {String(elemento.propiedades.total_piso)} piso(s). La volumetría del visor 3D
              corresponde a este dato.
            </p>
          </div>
        )}

        {/* Edificación de OSM sin altura: se advierte de la aproximación */}
        {alturaAproximada && (
          <div className="mb-3 flex gap-2 rounded-lg border border-pendiente/30 bg-pendiente/10 px-3 py-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-pendiente" aria-hidden />
            <p className="text-[0.6875rem] leading-relaxed text-arena-300">
              Esta edificación <strong>no tiene altura registrada</strong> en OpenStreetMap. En el
              visor 3D se extruye con una altura aproximada de{' '}
              {ALTURA_APROXIMADA_M.toFixed(1)} m —una planta, calibrada con el catastro oficial—,
              meramente indicativa. Para la altura registrada, activa la capa de construcciones del
              catastro.
            </p>
          </div>
        )}

        {/* Magnitudes calculadas */}
        {(elemento.areaM2 !== undefined || elemento.longitudM !== undefined) && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {elemento.areaM2 !== undefined && (
              <div className="rounded-lg bg-hueso-100/[0.06] px-3 py-2">
                <div className="flex items-center gap-1.5 text-grafito-400">
                  <Scan className="size-3" aria-hidden />
                  <span className="dato-mono">ÁREA</span>
                </div>
                <p className="mt-0.5 text-sm text-hueso-100">{formatearArea(elemento.areaM2)}</p>
              </div>
            )}
            {elemento.longitudM !== undefined && (
              <div className="rounded-lg bg-hueso-100/[0.06] px-3 py-2">
                <div className="flex items-center gap-1.5 text-grafito-400">
                  <Ruler className="size-3" aria-hidden />
                  <span className="dato-mono">LONGITUD</span>
                </div>
                <p className="mt-0.5 text-sm text-hueso-100">
                  {formatearLongitud(elemento.longitudM)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Localización */}
        <div className="mb-3 rounded-lg bg-hueso-100/[0.06] px-3 py-2">
          <p className="dato-mono text-grafito-400">LOCALIZACIÓN</p>
          <p className="dato-mono mt-0.5 text-hueso-200">
            {coordenadas(elemento.lng, elemento.lat)}
          </p>
        </div>

        {/* Campos presentes */}
        <dl className="space-y-1.5">
          {presentes.map((c) => (
            <div key={c.etiqueta} className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-[0.75rem] text-grafito-400">{c.etiqueta}</dt>
              <dd className="min-w-0 truncate text-right text-[0.8125rem] text-hueso-100">
                {c.valor}
              </dd>
            </div>
          ))}
        </dl>

        {/* Campos ausentes declarados explícitamente */}
        {ausentesRelevantes.length > 0 && (
          <div className="mt-4 border-t border-hueso-100/10 pt-3">
            <p className="dato-mono mb-2 text-grafito-500">SIN DATO DISPONIBLE</p>
            <dl className="space-y-1.5">
              {ausentesRelevantes.map((c) => (
                <div key={c.etiqueta} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-[0.75rem] text-grafito-500">{c.etiqueta}</dt>
                  <dd className="text-right text-[0.75rem] italic text-grafito-500">
                    Información no disponible
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Limitaciones de la capa */}
        {capa?.limitaciones && (
          <div className="mt-4 border-t border-hueso-100/10 pt-3">
            <p className="dato-mono mb-1 text-grafito-500">LIMITACIONES DEL DATO</p>
            <p className="text-[0.6875rem] leading-relaxed text-grafito-400">{capa.limitaciones}</p>
          </div>
        )}

        {/* Procedencia */}
        {capa && (
          <div className="mt-4 border-t border-hueso-100/10 pt-3">
            <p className="dato-mono mb-1 text-grafito-500">PROCEDENCIA</p>
            <p className="text-[0.6875rem] leading-relaxed text-grafito-400">
              {capa.fuente}
              <br />
              {capa.attribution} · {capa.licencia}
              <br />
              Descarga: {capa.fechaDescarga ?? 'Información no disponible'}
            </p>
          </div>
        )}
      </div>

      {/* Acciones */}
      <footer className="flex items-center gap-2 border-t border-hueso-100/10 px-4 py-2.5">
        <button
          type="button"
          onClick={alCentrar}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-turquesa-500/15 px-3 py-1.5 text-[0.75rem] font-medium text-turquesa-300 transition hover:bg-turquesa-500/25"
        >
          <Crosshair className="size-3.5" aria-hidden />
          Centrar
        </button>
        <a
          href={`https://www.openstreetmap.org/${elemento.propiedades.osm_tipo}/${elemento.propiedades.osm_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-md bg-hueso-100/10 px-3 py-1.5 text-[0.75rem] text-hueso-200 transition hover:bg-hueso-100/20"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Ver en OSM
        </a>
      </footer>
    </section>
  );
}
