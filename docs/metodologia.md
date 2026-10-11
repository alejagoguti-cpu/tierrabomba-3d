# Metodología del pipeline 3D

Documento técnico del flujo de trabajo geoespacial de la tesis
**Reubicación & Resiliencia en Tierra Bomba (Cartagena)**.

---

## 1. Por qué un pipeline y no un solo programa

El proyecto necesita tres cosas que ninguna herramienta resuelve sola:

| Necesidad | Herramienta | Por qué esa |
|---|---|---|
| Precisión geográfica real (coordenadas, áreas, pendientes) | **QGIS** | Es el único eslabón que trabaja en coordenadas absolutas y calcula derivadas del terreno con rigor |
| Modelado de sólidos y volumetría | **FreeCAD** | Permite operaciones booleanas exactas (aljibe, cubierta) que una malla no soporta |
| Visualización web sin instalar nada | **three.js / Qgis2threejs** | El jurado abre un enlace, no un programa |

La cadena es: **Revit** (modelo BIM) → **exportación de malla** → **QGIS** (contexto territorial)
→ **FreeCAD** (sólidos) → **GLB** → **three.js / Qgis2threejs** (web).

---

## 2. Fase 1 — Extracción desde Revit

### 2.1 Exportación de la malla

1. Abrir `TIERRABOMBA.rvt`.
2. Seleccionar la vista 3D `{3D}`.
3. **Archivo ▸ Exportar ▸ CAD ▸ (formato OBJ)**.
4. En el diálogo, marcar:
   * *Caras* y *Materiales*.
   * **Desmarcar** *Elementos internos* y *Elementos de habitación*.
   * Sistema de coordenadas: **Interno del proyecto**.
5. Guardar como `TIERRABOMBA - 3D View - {3D}.obj`.

> **Por qué OBJ y no FBX o DWG:** el OBJ es texto plano, universal y no
> requiere licencias. Además `obj2gltf` lo convierte a glTF sin pérdidas
> ni programas de pago.

### 2.2 Resultado de la exportación

| Métrica | Valor medido |
|---|---|
| Vértices | 552.705 |
| Caras | 1.087.522 |
| Grupos de geometría | 4.472 |
| Materiales | 6 |
| Peso (OBJ + MTL) | 148,6 MB |

Los materiales son colores planos (`Kd`), **sin texturas**: eso hace que
el GLB resultante sea autocontenido.

| Material | Uso | Color |
|---|---|---|
| `Material_for_Toposolid_Terrain` | Terreno | `#614b3e` |
| `Forma_Material_for_Category_building` | Volumetría construida | `#7f7f7f` |
| `Tablero_de_muro_de_yeso` | Tabiques interiores | `#f9f9f9` |
| `Muro_por_defecto` | Muros | `#808080` |
| `MATERIAL_NOT_DEFINED` | Sin asignar | `#808080` |
| `default` | Por defecto | `#808080` |

---

## 3. Fase 2 — Conversión a glTF binario

```bash
npm install          # instala obj2gltf
npm run convert      # OBJ -> GLB
npm run inspector    # verifica el resultado
```

### 3.1 Por qué es obligatorio convertir

| Motivo | Detalle |
|---|---|
| Límite de GitHub | Rechaza archivos **> 100 MB**; el OBJ pesa 148,6 MB |
| Eficiencia web | El OBJ es texto: se descarga y se parsea línea a línea |
| Autocontención | El GLB lleva geometría + materiales en un solo archivo |
| Compatibilidad | glTF 2.0 es el «JPEG del 3D»: lo lee cualquier motor |

### 3.2 Resultado

| | OBJ original | GLB optimizado |
|---|---|---|
| Peso | 148,6 MB | **40,3 MB** |
| Reducción | — | **−73 %** |
| Triángulos | 1.087.522 | 1.087.522 (sin pérdida) |
| Extensiones glTF | — | **ninguna** |

Comprobación con `npm run inspector`:

```
Bloques:  JSON 7,98 MB  |  BIN 32,34 MB
Mallas: 4.472   Primitivas: 7.926   Materiales: 6
Vertices: 855.712   Triangulos: 1.087.522
Extensiones usadas: (ninguna) -> compatible con cualquier visor glTF 2.0
```

> **Nota de optimización pendiente.** El bloque JSON pesa 7,98 MB porque
> conserva los 4.472 nombres de malla de Revit. Si se fusionan las mallas
> por material (6 en total), el archivo baja aproximadamente a 33 MB y el
> visor renderiza en muchísimas menos llamadas de dibujo. Es la mejora de
> mayor impacto si el rendimiento en móvil importa.

---

## 4. Fase 3 — Contexto territorial en QGIS

### 4.1 Sistema de coordenadas

Todo el análisis se hace en **EPSG:32618 — WGS 84 / UTM zona 18N**, que es
el huso métrico correcto para Cartagena (≈ 75,5° O).

> Trabajar en `EPSG:4326` (grados) para calcular pendientes o áreas es un
> error frecuente: los grados no son unidades métricas y el resultado sale
> distorsionado según la latitud.

### 4.2 Scripts

| Script | Función |
|---|---|
| `scripts/qgis/01_preparar_terreno.py` | Reproyecta, recorta, interpola el MDT, deriva pendiente y sombreado, clasifica la cota segura |
| `scripts/qgis/02_exportar_qgis2threejs.py` | Carga las capas con los ajustes correctos y exporta la escena 3D |

Ambos se ejecutan **dentro de QGIS** (Complementos ▸ Consola de Python),
nunca con el Python del sistema: necesitan PyQGIS.

### 4.3 Parámetros clave

| Parámetro | Valor | Justificación |
|---|---|---|
| CRS métrico | EPSG:32618 | Huso UTM correcto para Cartagena |
| Resolución del MDT | 5 m | Isla de ~3 × 2 km: detalle suficiente sin rasters gigantes |
| Cota segura | +22,00 m s. n. m. | Meseta de reubicación definida en el proyecto |
| Intervalo de curvas | 1 m | Lectura fina del relieve para el diseño |
| Exageración Z | 1,5× | El relieve insular es suave; sin exagerar no se lee |

### 4.4 Aviso sobre la automatización de Qgis2threejs

Qgis2threejs es un complemento **con interfaz gráfica** y su API de Python
**no es estable entre versiones**. Por eso `02_exportar_qgis2threejs.py`:

1. Intenta la exportación automática si encuentra la API.
2. Si no la encuentra, **no falla**: deja el proyecto preparado e imprime
   la configuración exacta para introducir en el diálogo.

Así el script funciona en cualquier versión del complemento.

---

## 5. Fase 4 — Sólidos en FreeCAD

Macro: `scripts/freecad/terreno_a_solido.FCMacro`

| Elemento | Dimensiones | Volumen / área |
|---|---|---|
| Aljibe subterráneo | 15,00 × 10,00 × 3,00 m | **450 m³ = 450.000 L** |
| Cubierta captadora | 61,67 × 30,00 m | **1.850 m²** |
| Pendiente de cubierta | 5° | Evacua hacia el aljibe |
| Espesor de muros | 0,30 m | — |

**Cota del aljibe:** fondo a **+14,00 m s. n. m.**
**Cota de la meseta:** **+22,00 m s. n. m.**

> **Advertencia de rendimiento.** Convertir la malla del terreno
> (1,1 millones de caras) en un sólido de Part puede tardar decenas de
> minutos y agotar la memoria. La macro lo trae **desactivado** por
> defecto (`CONVERTIR_MALLA_A_SOLIDO = False`). Si lo necesitas, decima
> la malla antes en el *Mesh Design* de FreeCAD.

---

## 6. Fase 5 — Publicación web

### 6.1 Visor propio (three.js)

```bash
npm run dev     # -> http://localhost:5180
```

`scripts/web/viewer.html` ofrece:

* Encuadre automático del modelo según su caja envolvente.
* **Filtro de capas por material** (las 6 familias del modelo).
* **Despiece vertical** para separar cubierta, aljibe y terreno.
* Iluminación caribeña (sol alto + rebote hemisférico del mar).
* Estadísticas en vivo: mallas, triángulos, FPS.

### 6.2 Qgis2threejs

Complementario: genera escenas con **coordenadas geográficas reales**,
etiquetas y terreno texturizado. El visor propio sacrifica esa precisión
geográfica a cambio de control total sobre la presentación.

**Recomendación:** usar Qgis2threejs para el mapa de diagnóstico territorial
y el visor propio para la presentación arquitectónica del equipamiento.

### 6.3 Publicación en GitHub Pages

El repositorio puede publicarse en:
`https://alejagoguti-cpu.github.io/tierrabomba-3d/`

Activación: **Settings ▸ Pages ▸ Source: GitHub Actions** (o rama `gh-pages`).

---

## 7. Fase 6 — Análisis y publicación territorial

Las dos fases anteriores producen visualizaciones de **presentación**. Para el **análisis**
y para situar el proyecto en su contexto geográfico real se añaden dos herramientas.

### 7.1 Criterio de elección

Las tres visualizaciones no compiten: responden a preguntas distintas.

| Herramienta | Pregunta | Sistema de coordenadas | Requiere cuenta |
|---|---|---|---|
| Visor propio (three.js) | ¿Cómo es el edificio? | Locales, sin referencia | No |
| kepler.gl | ¿Qué dicen los datos? | WGS 84 / Web Mercator | Mapbox (a veces) |
| TerriaMap | ¿Dónde está todo esto? | Absolutas + globo 3D | No |

### 7.2 Datos abiertos de partida

`scripts/datos/obtener_limite_osm.mjs` descarga el límite oficial de la isla desde
OpenStreetMap (vía Nominatim) y lo simplifica con Douglas-Peucker.

| Métrica | Valor |
|---|---|
| Consulta | `Isla Tierra Bomba, Cartagena de Indias, Colombia` |
| Identificador OSM | `relation/11226348` |
| Centro | 10,34975 N · −75,57050 O |
| Caja envolvente | 10,31803 – 10,38149 N · −75,59341 – −75,53745 O |
| Vértices descargados | 2.431 |
| Vértices tras simplificar | **447** (−81,6 %) |
| Tolerancia | 0,0001° (~11 m) |

> **Limitación que hay que declarar en la memoria.** Es un límite de la comunidad
> OpenStreetMap, **no un levantamiento topográfico**. Sirve para encuadrar y para el
> diagnóstico general, pero **no** para calcular áreas ni tasas de retroceso costero:
> para eso está el levantamiento propio. La capa va marcada con esta advertencia tanto
> en su propio GeoJSON como en el catálogo de Terria.

Licencia **ODbL 1.0**: la atribución «© OpenStreetMap contributors» es obligatoria.

### 7.3 kepler.gl

Herramienta de análisis para datos tabulares y vectoriales a gran escala (MIT, sobre deck.gl).

**Tres vías de uso, de menor a mayor esfuerzo:**

| Vía | Cómo | Cuándo usarla |
|---|---|---|
| Demo online | Arrastrar los archivos a <https://kepler.gl/demo> | Exploración rápida |
| Python | `python scripts/kepler/generar_mapa_kepler.py` | Resultado reproducible y versionable |
| React | `@kepler.gl/components` + Redux | Solo si hay que integrarlo en una web |

**Restricción crítica:** kepler.gl **solo acepta WGS 84 (EPSG:4326) o Web Mercator
(EPSG:3857)**. El análisis del proyecto se hace en UTM 18N (EPSG:32618) porque es el huso
métrico correcto para Cartagena. Por eso `exportar_capas_para_kepler.py` reproyecta antes de
exportar: cargar un archivo en UTM directamente produce un mapa mal situado.

**Segunda restricción:** kepler.gl genera **una sola capa Polygon por archivo GeoJSON**,
aunque el archivo mezcle puntos, líneas y polígonos. Por eso el script de exportación separa
cada tipo de geometría en su propio archivo.

**Formatos admitidos:** CSV, GeoJSON, GeoJSONL/NDJSON, KML (`.kmz` no), GPX, TCX, Shapefile,
Excel, FlatGeobuf, GeoArrow, Arrow y Parquet.

**Limitación:** los mapas base usan Mapbox, así que puede hacer falta un token gratuito.
Es la única herramienta de la cadena que puede pedir una cuenta.

### 7.4 TerriaMap

Plataforma de visualización **basada en catálogo** (Apache-2.0): se declara un archivo JSON
con las capas y la aplicación las presenta sobre un globo 3D (Cesium) o en 2D (Leaflet).

**El catálogo** vive en `scripts/terria/catalogo-tierrabomba.json` y contiene:

* `homeCamera` y `initialCamera` encuadrados sobre la isla.
* Grupo **Diagnóstico territorial** con la capa del límite insular.
* Grupo **Modelo 3D propuesto** con el modelo BIM.

**Uso sin instalar nada** — basta pasar el catálogo en la URL:

```
https://terria.io/#https://alejagoguti-cpu.github.io/tierrabomba-3d/scripts/terria/catalogo-tierrabomba.json
```

**Georreferenciación del modelo BIM.** Es el punto delicado de toda la fase:

1. El OBJ de Revit está en **coordenadas internas del proyecto**: no lleva referencia
   geográfica alguna, así que Terria no puede saber dónde colocarlo.
2. En el catálogo se sitúa provisionalmente en el centro de la isla, con un aviso visible.
3. Hay que sustituir `origin.longitude`, `origin.latitude` y `origin.height` por las
   coordenadas reales de un punto conocido del modelo.
4. **`upAxis` debe ser `"Z"`.** Según la especificación glTF los modelos son *Y-arriba*,
   pero las exportaciones de Revit y otros programas CAD son *Z-arriba*. Si el modelo
   aparece tumbado, este es el campo que hay que revisar.
5. Alternativa más robusta: usar el sistema de coordenadas compartidas de Revit
   (*Manage ▸ Coordinates ▸ Specify Coordinates at Point*) para que la exportación salga
   ya en coordenadas absolutas.

### 7.5 Tipo de catálogo según el dato

| Tipo | Para qué sirve aquí |
|---|---|
| `geojson` | Capas vectoriales del diagnóstico (límite, usos, zona segura) |
| `gltf` | Modelos 3D georreferenciados (el equipamiento) |
| `3d-tiles` | Mallas urbanas optimizadas de gran tamaño |
| `csv` | Tablas con coordenadas (matriz de actores) |
| `czml` | Animaciones temporales (evolución de la erosión) |
| `cesium-terrain` | MDT como terreno real de Cesium |
| `wms` / `wmts` | Servicios de mapas publicados desde GeoServer |

> **Publicación.** TerriaMap es una aplicación de Node, **no un sitio estático**: no se puede
> publicar directamente en GitHub Pages sin compilar. Para el jurado basta con usar la
> instancia pública de Terria con el catálogo en la URL.

---

## 8. Reproducibilidad

Para regenerar todo desde cero:

```bash
git clone https://github.com/alejagoguti-cpu/tierrabomba-3d.git
cd tierrabomba-3d
npm install
npm run convert        # OBJ -> GLB        (requiere el OBJ original de Revit)
npm run inspector      # verifica el GLB
npm run limite-osm     # descarga el limite insular de OpenStreetMap
npm run dev            # abre el visor propio

python scripts/kepler/generar_mapa_kepler.py   # requiere: pip install keplergl
```

Los pasos de QGIS y FreeCAD se ejecutan sobre sus propias aplicaciones,
según lo descrito en las secciones 4 y 5. El catálogo de Terria no necesita
compilación: se carga por URL.

---

## 9. Referencias de las herramientas

* QGIS — <https://qgis.org/> (GPL-3.0)
* Qgis2threejs, Minoru Akagi — <https://github.com/minorua/Qgis2threejs> (GPL-3.0)
* FreeCAD — <https://github.com/FreeCAD/FreeCAD> (LGPL-2.1)
* three.js — <https://threejs.org/> (MIT)
* obj2gltf, Cesium GS — <https://github.com/CesiumGS/obj2gltf> (Apache-2.0)
* kepler.gl — <https://github.com/keplergl/kepler.gl> (MIT) ·
  documentación: <https://docs.kepler.gl> ·
  demo: <https://kepler.gl/demo>
* keplergl para Python — <https://pypi.org/project/keplergl/>
* TerriaMap — <https://github.com/TerriaJS/TerriaMap> (Apache-2.0) ·
  documentación: <https://docs.terria.io>
* Tipos de catálogo de Terria — <https://docs.terria.io/guide/connecting-to-data/catalog-type-details/>
* CesiumJS — <https://cesium.com/platform/cesiumjs/> (Apache-2.0)
* deck.gl — <https://deck.gl/> (MIT)
* Especificación glTF 2.0 — <https://registry.khronos.org/glTF/> (Khronos Group)
* OpenStreetMap — <https://www.openstreetmap.org/copyright> (ODbL 1.0)
