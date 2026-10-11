# kepler.gl — análisis geoespacial

Integración de [kepler.gl](https://github.com/keplergl/kepler.gl) con los datos de la tesis.
kepler.gl es una herramienta de **análisis y visualización de datos geoespaciales** a gran escala,
construida sobre deck.gl. Está pensada para explorar datos tabulares y vectoriales, no para
presentar arquitectura.

* **Licencia:** MIT
* **Documentación:** <https://docs.kepler.gl>
* **Demo online:** <https://kepler.gl/demo>

---

## Por qué kepler.gl en esta tesis

| Necesidad | Cómo la cubre kepler.gl |
|---|---|
| Analizar la matriz de actores | Carga el CSV y colorea por tipo de actor, con filtros por atributo |
| Cruzar datos del acápite con el territorio | Capas múltiples con *blending* y filtros temporales |
| Detectar patrones de erosión | Escalas de color sobre el campo de retroceso costero |
| Producir mapas para la memoria | Exporta imagen en alta resolución y datos filtrados |

**Reparto de funciones:**

| Herramienta | Para qué |
|---|---|
| `scripts/web/viewer.html` (three.js) | Presentación arquitectónica del equipamiento |
| `scripts/terria/` (TerriaMap) | Presentación territorial en globo 3D |
| **kepler.gl** (este directorio) | **Análisis** de datos: filtros, escalas, agregaciones |

---

## Formatos que acepta

Según la [documentación oficial](https://docs.kepler.gl/docs/user-guides/b-kepler-gl-workflow/a-add-data-to-the-map),
acepta **CSV, GeoJSON, GeoJSONL/NDJSON, KML** (`.kmz` no), **GPX, TCX, Shapefile**
(`.shp` con sus sidecars, o `.zip`), **Excel** (`.xlsx`/`.xls`), **FlatGeobuf**, **GeoArrow**,
**Arrow** y **Parquet**.

**Sistema de coordenadas: solo WGS 84 (`EPSG:4326`) o Web Mercator (`EPSG:3857`).**
Si exportas desde QGIS en UTM 18N (como hace `01_preparar_terreno.py` para calcular),
**hay que reproyectar antes de cargar en kepler.gl**. El script de este directorio lo hace.

Dos detalles que ahorran tiempo:

* **GeoJSON:** genera **una sola capa Polygon por archivo**, aunque mezcles puntos, líneas y
  polígonos. Si necesitas tipos distintos, usa **archivos separados**.
* **CSV:** detecta coordenadas automáticamente si existen pares de columnas
  `algo_lat` / `algo_lng` (también `_latitude`/`_longitude` y `_lat`/`_lon`).
  Si una columna contiene WKT, crea directamente la capa geométrica.

---

## Archivos de este directorio

| Archivo | Función |
|---|---|
| `exportar_capas_para_kepler.py` | Script de QGIS: reproyecta a EPSG:4326 y exporta las capas listas para kepler.gl |
| `generar_mapa_kepler.py` | Script de Python: construye el mapa y lo guarda como HTML autónomo |

---

## Opción A — La más rápida: demo online, sin instalar nada

1. Abre <https://kepler.gl/demo>.
2. Arrastra los archivos de `data/ligero/` (`.geojson`) o los CSV generados.
3. Trabaja el mapa: colores, filtros, capas.
4. **Export Map → JSON** descarga un archivo con los datos y la configuración,
   reutilizable después.

> El `dataId` de cada capa en el JSON exportado debe coincidir con el `id` de su dataset.
> Si editas el JSON a mano y cambias un nombre, la capa dejará de encontrar sus datos.

---

## Opción B — Python, para un mapa reproducible

Instala la librería [`keplergl`](https://pypi.org/project/keplergl/):

```bash
pip install keplergl
```

Genera el mapa y expórtalo como HTML:

```bash
python scripts/kepler/generar_mapa_kepler.py
```

El script produce `scripts/kepler/mapa-tierrabomba.html`: un archivo autónomo que se abre
en cualquier navegador y se puede subir al repositorio o adjuntar a la entrega.

**Sobre el token de Mapbox:** kepler.gl usa Mapbox para los mapas base. La librería de Python
suele funcionar con el estilo por defecto sin token, pero si el mapa base aparece en blanco
necesitarás una cuenta gratuita de Mapbox y su token. Mira la consola del navegador para
confirmarlo. Es la limitación principal de kepler.gl frente al visor propio o TerriaMap,
que no requieren ninguna cuenta.

---

## Opción C — Incrustarlo en una web propia

kepler.gl es un **componente React** que gestiona su estado con **Redux**:

```bash
npm install --save @kepler.gl/components
```

```jsx
import KeplerGl from '@kepler.gl/components';
import { addDataToMap } from '@kepler.gl/actions';

// El componente necesita un store de Redux con keplerGlReducer
// y taskMiddleware, y un token de Mapbox.
<KeplerGl id="tierrabomba" mapboxApiAccessToken={TOKEN} width={800} height={600} />
```

Los datos se cargan despachando `addDataToMap` con `{ datasets, options, config }`.

**Recomendación para esta tesis:** la Opción A o la B cubren de sobra la necesidad de análisis.
Incrustar kepler.gl en la plataforma web exigiría añadir Redux y un token de Mapbox a
`alejagoguti-cpu/tesis`, y no aporta nada que el visor propio no haga ya para la presentación
arquitectónica. Úsalo como herramienta de análisis y exporta las imágenes para la memoria.

---

## Flujo de trabajo recomendado

```
QGIS  ──►  exportar_capas_para_kepler.py  ──►  data/ligero/*.geojson (EPSG:4326)
                                                        │
                            ┌───────────────────────────┴───────────────────────────┐
                            ▼                                                       ▼
                 kepler.gl/demo (arrastrar)                        generar_mapa_kepler.py
                            │                                                       │
                            ▼                                                       ▼
              Export Map → JSON / imagen                             mapa-tierrabomba.html
```

---

## Atribución

* Capa del límite insular: **(c) OpenStreetMap contributors**, ODbL 1.0
  — <https://www.openstreetmap.org/copyright>
* kepler.gl: MIT · deck.gl: MIT · Mapbox GL JS: licencia propia de Mapbox
