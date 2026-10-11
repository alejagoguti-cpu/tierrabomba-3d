# TerriaMap — globo 3D con catálogo de datos

Integración de [TerriaMap](https://github.com/TerriaJS/TerriaMap) con los datos de la tesis.
TerriaMap es una plataforma de visualización geoespacial **basada en catálogo**: se define un
archivo JSON que declara las capas, y la aplicación las presenta en un globo 3D (Cesium) o en 2D (Leaflet).

* **Licencia:** Apache-2.0
* **Documentación oficial:** <https://docs.terria.io>
* **Repositorio:** <https://github.com/TerriaJS/TerriaMap>

---

## Por qué TerriaMap en esta tesis

| Necesidad | Cómo la cubre TerriaMap |
|---|---|
| Ver el territorio en su contexto geográfico real | Globo 3D con coordenadas absolutas, a diferencia del visor propio de `scripts/web/` |
| Reunir capas de distinta fuente | Un único catálogo agrupa GeoJSON, glTF, 3D Tiles, WMS, CSV, CZML… |
| Contar una narrativa al jurado | Soporta *stories*: recorridos guiados con cámara y capas que se activan por pasos |
| Compartir el estado de la vista | Enlaces de *share* que reproducen exactamente la cámara y las capas activas |

**Reparto de funciones con el visor propio:**

| Herramienta | Para qué |
|---|---|
| `scripts/web/viewer.html` (three.js) | Presentación **arquitectónica** del equipamiento. Control total del aspecto, sin dependencias externas |
| **TerriaMap** (este directorio) | Presentación **territorial**. Precisión geográfica, muchas capas y comparación entre ellas |
| **kepler.gl** (`scripts/kepler/`) | **Análisis** de datos tabulares y grandes volúmenes |

---

## Archivo incluido

`catalogo-tierrabomba.json` — archivo de inicialización (*init file*) de Terria con:

* Grupos **Diagnóstico territorial** y **Modelo 3D propuesto**.
* La capa real del límite insular descargado de OpenStreetMap
  (generada con `node scripts/datos/obtener_limite_osm.mjs`).
* El modelo BIM `TIERRABOMBA.glb` del repositorio.
* `homeCamera` y `initialCamera` encuadrados sobre la isla:
  caja **10,31803 – 10,38149 N** y **−75,59341 – −75,53745 O**.

---

## Cómo usarlo

### Opción A — Sin instalar nada (la más rápida)

TerriaMap acepta un archivo de inicialización alojado en cualquier servidor con CORS,
pasándolo en la URL después de `#`:

```
https://terria.io/#https://alejagoguti-cpu.github.io/tierrabomba-3d/scripts/terria/catalogo-tierrabomba.json
```

También puedes **arrastrar el JSON** sobre la ventana de TerriaMap.

### Opción B — TerriaMap propio

```bash
git clone https://github.com/TerriaJS/TerriaMap.git
cd TerriaMap
npm install
# Copia el catálogo dentro del proyecto
cp <ruta-a-este-repo>/scripts/terria/catalogo-tierrabomba.json wwwroot/init/
npm run start
```

Para que se cargue automáticamente, añádelo a `wwwroot/config.json`:

```json
{
  "initializationUrls": ["catalogo-tierrabomba"]
}
```

O cárgalo puntualmente con `http://localhost:3001/#catalogo-tierrabomba`.

### Opción C — Docker

```bash
docker run -d -p 3001:3001 terriajs/terriamap
```

---

## Georreferenciación del modelo BIM (importante)

El OBJ que exporta Revit está en **coordenadas internas del proyecto**: no lleva ninguna
referencia geográfica. Eso significa que Terria no puede saber dónde colocarlo.

El catálogo lo sitúa provisionalmente en el centro de la isla
(**10,34975 N, −75,57050 O, +22 m**) y muestra un aviso al añadirlo.

**Para georreferenciarlo correctamente:**

1. Abre el modelo en Revit y localiza un punto cuya coordenada real conozcas
   (por ejemplo, una esquina del lote levantado).
2. Averigua sus coordenadas en el modelo OBJ: son las unidades internas del proyecto.
3. Calcula la diferencia y sustitúyela en el campo `origin` del catálogo:

```json
"origin": {
  "longitude": -75.57,
  "latitude": 10.35,
  "height": 22
}
```

4. **`upAxis` debe quedarse en `"Z"`.** Es el detalle que más falla: según la especificación
   glTF los modelos son *Y-arriba*, pero las exportaciones de Revit y otros programas CAD
   son *Z-arriba*. Si el modelo aparece tumbado, este es el campo que hay que revisar.
   Valores admitidos: `X`, `Y`, `Z`.
5. Ajusta `scale` si el modelo sale desproporcionado.

**Alternativa recomendada:** usa el sistema de coordenadas compartidas de Revit
(*Manage ▸ Coordinates ▸ Specify Coordinates at Point*) para que la exportación salga ya
en coordenadas absolutas. Es más robusto que corregirlo a mano después.

---

## Añadir las capas que genera QGIS

Los archivos de `data/ligero/` se crean al ejecutar
`scripts/qgis/01_preparar_terreno.py`. Cuando existan, añade sus entradas al catálogo:

```json
{
  "type": "geojson",
  "name": "Zona segura sobre +22,00 m",
  "id": "zona-segura",
  "url": "https://alejagoguti-cpu.github.io/tierrabomba-3d/data/ligero/zona_segura.geojson",
  "description": "Meseta por encima de la cota de reubicacion."
}
```

> **Aviso:** un elemento del catálogo cuya `url` no exista dará error al activarlo.
> Añade cada capa **solo después** de generarla y subirla al repositorio.

### Otros tipos de catálogo útiles

Documentados en <https://docs.terria.io/guide/connecting-to-data/catalog-type-details/>:

| Tipo | Para qué sirve aquí |
|---|---|
| `geojson` | Capas vectoriales del diagnóstico (límite, usos, zona segura) |
| `gltf` | Modelos 3D georreferenciados (el equipamiento) |
| `3d-tiles` | Mallas urbanas optimizadas de gran tamaño |
| `csv` | Tablas con coordenadas (matriz de actores) |
| `czml` | Animaciones temporales (evolución de la erosión costera) |
| `cesium-terrain` | Modelo digital del terreno como terreno real de Cesium |
| `wms` / `wmts` | Servicios de mapas publicados desde GeoServer |

> **`assimp`**: existe un tipo de catálogo que convierte formatos 3D a glTF en el navegador,
> pero es experimental y con mallas grandes falla. Para el STL de topografía es preferible
> convertirlo a GLB antes, como se hace con el OBJ principal.

---

## Publicar TerriaMap en GitHub Pages

TerriaMap es una aplicación de Node, no un sitio estático: **no se puede publicar
directamente en GitHub Pages** sin compilarla.

Alternativas:

1. **Usar la instancia pública** `https://terria.io` con la Opción A de arriba. Suficiente
   para el jurado y no requiere nada.
2. **Compilar y publicar en un servicio estático**: `npm run build` genera `wwwroot/build/`,
   que sí puede servirse como sitio estático (Netlify, Vercel, Cloudflare Pages).
3. **Mantenerlo en local** y presentarlo desde tu equipo.

---

## Atribución

* Datos del límite insular: **(c) OpenStreetMap contributors**, licencia ODbL 1.0
  — <https://www.openstreetmap.org/copyright>
* TerriaMap: Apache-2.0
* TerriaJS: Apache-2.0
* CesiumJS: Apache-2.0
