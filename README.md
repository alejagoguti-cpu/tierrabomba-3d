# 🏝️ Tierra Bomba 3D

> **Pipeline geoespacial y modelo 3D web para la tesis de reubicación y resiliencia costera.**
> Isla de Tierra Bomba, Cartagena de Indias, Colombia.

[![QGIS](https://img.shields.io/badge/QGIS-3.x-589632?style=flat&logo=qgis)](https://qgis.org/)
[![Qgis2threejs](https://img.shields.io/badge/Qgis2threejs-plugin-blue)](https://github.com/minorua/Qgis2threejs)
[![FreeCAD](https://img.shields.io/badge/FreeCAD-1.x-CB333B?style=flat&logo=freecad)](https://www.freecad.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=flat&logo=three.js)](https://threejs.org/)
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
Revit (BIM)  ──►  OBJ / STL  ──►  GLB optimizado  ──►  visor three.js
                     │
QGIS (GIS)   ──►  Qgis2threejs  ──►  escena HTML         (web pública)
                     │
FreeCAD      ──►  sólidos del terreno, aljibe y cubierta
```

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
├── assets/
│   ├── modelos/          Modelos 3D listos para web (GLB)          [LFS]
│   └── estilos-qgis/     Estilos .qml de las capas temáticas
├── data/
│   ├── ligero/           GeoJSON, CSV y capas pequeñas versionables
│   └── pesado/           GPKG, LAS y rásters                  [LFS / Releases]
├── docs/                 Metodología, fichas técnicas y notas
├── scripts/
│   ├── qgis/             Preparación del terreno y export Qgis2threejs
│   ├── freecad/          Macros de modelado de sólidos
│   └── web/              Visor three.js y utilidades del GLB
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

```bash
# Copiar los scripts a tu perfil de QGIS y ejecutarlos desde la Consola de Python
python scripts/qgis/01_preparar_terreno.py
```

Luego, en QGIS: **Web ▸ Qgis2threejs ▸ Qgis2threejs Exporter** y usar la configuración
descrita en [`docs/metodologia.md`](docs/metodologia.md).

### 2. FreeCAD — sólidos del terreno

```bash
# Macros ▸ Macros… ▸ crear ▸ pegar el contenido de:
scripts/freecad/terreno_a_solido.FCMacro
```

### 3. Web — ver el modelo

```bash
npm run dev            # sirve scripts/web/viewer.html en localhost
```

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
| Código, scripts, `.qml`, `.geojson`, CSV | Git normal |
| GLB, GPKG, STL, DAE, SHP | **Git LFS** |
| `.rvt` canónicos, rásters grandes | **GitHub Releases** (sin cuota LFS) |
| Backups `*.0001.rvt` … `*.0052.rvt` | ❌ **No se suben** (redundantes) |

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

**Herramientas de terceros utilizadas** (no se redistribuyen aquí):

* [QGIS](https://qgis.org/) — GPL-3.0
* [Qgis2threejs](https://github.com/minorua/Qgis2threejs) de Minoru Akagi — GPL-3.0
* [FreeCAD](https://github.com/FreeCAD/FreeCAD) — LGPL-2.1
* [three.js](https://threejs.org/) — MIT
* [obj2gltf](https://github.com/CesiumGS/obj2gltf) — Apache-2.0

---

**Autoras:** Alejandra Gómez & Ana Casas
**Tesis de Grado en Arquitectura & Urbanismo — 2026**
