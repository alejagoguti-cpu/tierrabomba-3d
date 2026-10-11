# 🏝️ Tierra Bomba 3D

> **Pipeline geoespacial y modelo 3D web para la tesis de reubicación y resiliencia costera.**
> Isla de Tierra Bomba, Cartagena de Indias, Colombia.

[![QGIS](https://img.shields.io/badge/QGIS-3.x-589632?style=flat&logo=qgis)](https://qgis.org/)
[![Qgis2threejs](https://img.shields.io/badge/Qgis2threejs-plugin-blue)](https://github.com/minorua/Qgis2threejs)
[![FreeCAD](https://img.shields.io/badge/FreeCAD-1.x-CB333B?style=flat&logo=freecad)](https://www.freecad.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=flat&logo=three.js)](https://threejs.org/)
[![kepler.gl](https://img.shields.io/badge/kepler.gl-an%C3%A1lisis-6A5ACD)](https://github.com/keplergl/kepler.gl)
[![TerriaMap](https://img.shields.io/badge/TerriaMap-globo%203D-2E8B57)](https://github.com/TerriaJS/TerriaMap)
[![Git LFS](https://img.shields.io/badge/Git-LFS-F64935?style=flat&logo=git-lfs)](https://git-lfs.com/)

---

## 📌 Qué es este repositorio

Este repositorio es el **componente geoespacial y tridimensional** del proyecto de grado.
Es el gemelo técnico del repositorio [`tesis`](https://github.com/alejagoguti-cpu/tesis), que contiene la plataforma web.

| Repositorio | Responsabilidad |
|---|---|
| [`tesis`](https://github.com/alejagoguti-cpu/tesis) | Plataforma web interactiva, visor BIM, planimetría, ciclo hídrico |
| **`tierrabomba-3d`** (este) | **Terreno, topografía, análisis GIS, modelado 3D y exportación web** |

**Cadena de trabajo:**

```
                        ┌──►  GLB optimizado  ──►  visor three.js      (presentación)
Revit (BIM) ──► OBJ ────┤
                        └──►  glTF georreferenciado ──►  TerriaMap    (territorio 3D)

QGIS (GIS)  ──►  análisis en UTM 18N  ──┬──►  Qgis2threejs  ──►  escena HTML
                                        ├──►  GeoJSON 4326  ──►  kepler.gl   (análisis)
                                        └──►  catálogo JSON ──►  TerriaMap

FreeCAD     ──►  sólidos del terreno, aljibe y cubierta
```

**Tres visores, tres propósitos distintos** (no son alternativas, se complementan):

| Herramienta | Pregunta que responde | Precisión geográfica | Requiere cuenta |
|---|---|---|---|
| Visor propio (three.js) | ¿Cómo es el edificio? | Ninguna (coordenadas locales) | No |
| **kepler.gl** | ¿Qué dicen los datos? | WGS 84 / Web Mercator | Mapbox (a veces) |
| **TerriaMap** | ¿Dónde está todo esto? | Coordenadas absolutas + globo 3D | No |

---

## 🌊 Contexto del proyecto

* **Ubicación:** Isla de Tierra Bomba, Cartagena de Indias, Colombia.
* **Problemática:** ausencia de red pública de acueducto, salinización de pozos subterráneos
  y retroceso costero por erosión de hasta **1,8 m/año**.
* **Propuesta:** reubicación del equipamiento comunal a una cota segura (**+22,00 m s. n. m.**),
  diseño bioclimático caribeño, cubierta captadora de pluviales (**1.850 m²**) y aljibe
  subterráneo de **450.000 litros** con desinfección solar y fitodepuración de aguas grises.

---

## 📂 Estructura

```
tierrabomba-3d/
├── index.html            Página de entrada publicada en GitHub Pages
├── assets/
│   ├── modelos/          Modelos 3D listos para web (GLB, STL)
│   └── estilos-qgis/     Estilos .qml de las capas temáticas
├── data/
│   ├── ligero/           GeoJSON, CSV y capas pequeñas versionables
│   │   └── limite_isla.geojson     Límite insular (OpenStreetMap, ODbL)
│   └── pesado/           GPKG, LAS y rásters                [Releases]
├── docs/                 Metodología, fichas técnicas y notas
├── scripts/
│   ├── datos/            Descarga de datos abiertos (límite OSM)
│   ├── qgis/             Preparación del terreno y export Qgis2threejs
│   ├── freecad/          Macros de modelado de sólidos
│   ├── web/              Visor three.js y utilidades del GLB
│   ├── kepler/           Exportación y mapas de análisis (kepler.gl)
│   └── terria/           Catálogo de datos para el globo 3D (TerriaMap)
├── .gitattributes        Reglas de Git LFS
└── .gitignore            Exclusiones (backups de Revit, cachés, secretos)
```

---

## 🧩 El modelo 3D principal

`assets/modelos/TIERRABOMBA.glb` — exportado desde Revit (Autodesk ATF) y convertido a glTF binario.

| Métrica | Valor |
|---|---|
| Vértices | 552.705 |
| Caras | 1.087.522 |
| Grupos de geometría | 4.472 |
| OBJ original | 148,6 MB |
| **GLB optimizado** | **40,3 MB** |
| Reducción | **−73 %** |

El modelo incluye el *Toposolid* del terreno y las edificaciones, con materiales por color
(sin texturas), por lo que el GLB es autocontenido y no requiere archivos externos.

### Regenerar el GLB

```bash
npm install
npm run convert        # OBJ -> GLB
```

---

## 🚀 Uso rápido

### 1. QGIS — preparar el terreno

Los scripts de QGIS **se ejecutan dentro de QGIS**, no con el Python del sistema:
necesitan PyQGIS. Ábrelos en **Complementos ▸ Consola de Python ▸ Editor**.

1. `scripts/qgis/01_preparar_terreno.py` → genera el MDT, la pendiente y la zona segura.
2. **Web ▸ Qgis2threejs ▸ Qgis2threejs Exporter** con la configuración que imprime
   `scripts/qgis/02_exportar_qgis2threejs.py`.

### 2. FreeCAD — sólidos del terreno

**Macros ▸ Macros… ▸ Crear** y pegar el contenido de
[`scripts/freecad/terreno_a_solido.FCMacro`](scripts/freecad/terreno_a_solido.FCMacro).
Modela el aljibe de 450.000 L y la cubierta captadora de 1.850 m².

### 3. Visor propio — presentación arquitectónica

```bash
npm install
npm run dev            # -> http://localhost:5180
```

### 4. Datos abiertos — límite insular

```bash
npm run limite-osm     # descarga el límite de la isla desde OpenStreetMap
```

Genera `data/ligero/limite_isla.geojson` (2.431 → 447 vértices, −82 %), la capa base
que usan tanto kepler.gl como TerriaMap.

### 5. kepler.gl — análisis de datos

```bash
python scripts/kepler/generar_mapa_kepler.py   # requiere: pip install keplergl
```

O, sin instalar nada: arrastra los `*_kepler.geojson` a
[kepler.gl/demo](https://kepler.gl/demo). Detalles en
[`scripts/kepler/README.md`](scripts/kepler/README.md).

### 6. TerriaMap — globo 3D territorial

Sin instalar nada, abre el catálogo en la instancia pública:

```
https://terria.io/#https://alejagoguti-cpu.github.io/tierrabomba-3d/scripts/terria/catalogo-tierrabomba.json
```

Detalles de despliegue en [`scripts/terria/README.md`](scripts/terria/README.md).

---

## ⚠️ Política de archivos pesados

GitHub tiene límites duros que condicionan qué se puede versionar:

| Límite | Valor |
|---|---|
| Tamaño máximo por archivo (rechazo) | **100 MB** |
| Aviso de archivo grande | 50 MB |
| Almacenamiento Git LFS (plan gratuito) | 1 GB |
| Ancho de banda Git LFS (plan gratuito) | 1 GB / mes |

**Regla del repositorio:**

| Tipo de archivo | Destino |
|---|---|
| Código, scripts, `.qml`, `.geojson`, CSV, `.glb`, `.stl` | Git normal |
| GPKG, SHP, rásters, LIDAR, `.ai`, `.psd` (originales pesados) | **Git LFS** |
| `.rvt` canónicos, rásters grandes | **GitHub Releases** (sin cuota LFS) |
| Backups `*.0001.rvt` … `*.0052.rvt` | ❌ **No se suben** (redundantes) |

> **Por qué el GLB no está en Git LFS.** Es deliberado: pesa 40 MB, está por debajo del
> límite de 50 MB, y dejándolo en Git normal **cualquiera puede clonar el repositorio y ver
> el visor sin instalar `git-lfs`**. Para un repositorio público de tesis eso vale más que
> ahorrar unos megabytes.

> Los ~40 backups numerados de Revit (`TIERRABOMBA.00xx.rvt`, `TOPOGRAFIA1.00xx.rvt`)
> pesan entre 60 y 100 MB **cada uno**. Son copias automáticas de versiones anteriores
> que Revit genera sola: subirlos supondría varios GB sin aportar información nueva.
> Solo se conserva la versión canónica de cada modelo.

---

## 📜 Licencia y créditos

* **Código y scripts:** MIT — ver [`LICENSE`](LICENSE).
* **Modelo BIM, datos geoespaciales y documentos:** © 2026 Alejandra Gómez & Ana Casas.
  Todos los derechos reservados. El modelo 3D y los datos del territorio **no** están
  cubiertos por la licencia MIT.
* **Capa del límite insular** (`data/ligero/limite_isla.geojson`): © OpenStreetMap
  contributors, licencia [ODbL 1.0](https://www.openstreetmap.org/copyright).
  **Esta atribución es obligatoria** en cualquier publicación que use la capa.

**Herramientas de terceros utilizadas** (no se redistribuyen aquí):

| Herramienta | Licencia |
|---|---|
| [QGIS](https://qgis.org/) | GPL-3.0 |
| [Qgis2threejs](https://github.com/minorua/Qgis2threejs) de Minoru Akagi | GPL-3.0 |
| [FreeCAD](https://github.com/FreeCAD/FreeCAD) | LGPL-2.1 |
| [three.js](https://threejs.org/) | MIT |
| [obj2gltf](https://github.com/CesiumGS/obj2gltf) | Apache-2.0 |
| [kepler.gl](https://github.com/keplergl/kepler.gl) | MIT |
| [TerriaMap](https://github.com/TerriaJS/TerriaMap) / [TerriaJS](https://github.com/TerriaJS/terriajs) | Apache-2.0 |
| [CesiumJS](https://cesium.com/platform/cesiumjs/) | Apache-2.0 |
| [deck.gl](https://deck.gl/) | MIT |
| Datos de [OpenStreetMap](https://www.openstreetmap.org/copyright) | ODbL 1.0 |

---

**Autoras:** Alejandra Gómez & Ana Casas
**Tesis de Grado en Arquitectura & Urbanismo — 2026**
