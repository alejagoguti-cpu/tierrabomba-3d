# Datos del repositorio

## `data/ligero/` — versionable en Git

Salidas de `scripts/qgis/01_preparar_terreno.py`, en GeoJSON y GeoTIFF.
Son archivos de texto o rásters pequeños: se versionan normalmente y
permiten ver los cambios del análisis en el historial de Git.

| Archivo | Contenido | Formato |
|---|---|---|
| `limite_isla.geojson` | Polígono del límite de Tierra Bomba | GeoJSON |
| `curvas_nivel.geojson` | Curvas del levantamiento topográfico | GeoJSON |
| `curvas_1m.geojson` | Curvas regeneradas cada 1 m desde el MDT | GeoJSON |
| `usos_suelo.geojson` | Usos del suelo | GeoJSON |
| `mdt.tif` | Modelo Digital del Terreno (5 m/píxel) | GeoTIFF |
| `hillshade.tif` | Sombreado del relieve | GeoTIFF |
| `pendiente.tif` | Pendiente en grados | GeoTIFF |
| `zona_segura.tif` | Clasificación binaria de la cota +22,00 m | GeoTIFF |

> Esta carpeta se crea al ejecutar el script. Si está vacía, aún no has
> corrido `01_preparar_terreno.py` dentro de QGIS.

---

## `data/pesado/` — Git LFS o GitHub Releases

Datos crudos que **superan los límites de Git** y no deben versionarse
en el historial normal.

| Archivo | Peso | Destino recomendado |
|---|---|---|
| `LOTE.gpkg` | **425 MB** | GitHub Releases |
| `TIERRABOMBA.rvt` | **133 MB** | GitHub Releases |
| `TOPOGRAFIA1.rvt` | **99 MB** | GitHub Releases |
| `Usos_Kennedy.gpkg` | 44 MB | Git LFS |

### Por qué no van a Git LFS directamente

GitHub aplica límites que conviene tener presentes:

| Límite | Valor |
|---|---|
| Archivo máximo (rechazo duro) | 100 MB |
| Aviso de archivo grande | 50 MB |
| Almacenamiento Git LFS (gratuito) | 1 GB |
| Ancho de banda Git LFS (gratuito, mensual) | 1 GB |

Subir los cuatro archivos sumaría **~700 MB de almacenamiento** y, sobre
todo, **~700 MB de ancho de banda en cada clonación**: un solo `git clone`
consumiría el 70 % de la cuota mensual gratuita.

### Alternativa recomendada: GitHub Releases

Los archivos adjuntos a un *Release*:

* **No** consumen la cuota de Git LFS.
* Admiten hasta **2 GB por archivo**.
* Se descargan por enlace directo, sin clonar el repositorio.

```bash
gh release create v1.0-datos \
  "C:/Users/aleja/OneDrive/Documentos/LOTE.gpkg" \
  "C:/Users/aleja/OneDrive/Documentos/TIERRABOMBA.rvt" \
  "C:/Users/aleja/OneDrive/Documentos/TOPOGRAFIA1.rvt" \
  --title "Datos base de la tesis" \
  --notes "GPKG y modelos de Revit del levantamiento de Tierra Bomba."
```

### Backups numerados de Revit: NO se suben

En `Documentos` hay unos **40 archivos** del tipo `TIERRABOMBA.0001.rvt` …
`TIERRABOMBA.0017.rvt` y `TOPOGRAFIA1.0033.rvt` … `TOPOGRAFIA1.0052.rvt`,
de **60 a 100 MB cada uno**.

Son copias automáticas que **Revit genera sola** en cada guardado: no
contienen información que no esté ya en el archivo canónico. Subirlos
supondría **varios GB** y no aporta nada al proyecto.

`.gitignore` ya los excluye con el patrón `*.[0-9][0-9][0-9][0-9].rvt`.

---

## Cómo trabajar con archivos pesados en local

Mantén los datos crudos **fuera** del repositorio y referéncialos por ruta:

```
C:\Users\aleja\OneDrive\Documentos\   <- datos crudos (fuera del repo)
C:\...\tierrabomba-3d\               <- repositorio
```

Los scripts ya apuntan a esa ubicación mediante la constante `RUTAS['origen']`
en `01_preparar_terreno.py` y `RUTA_MALLA` en la macro de FreeCAD.

> **Aviso sobre OneDrive.** Este repositorio vive dentro de una carpeta
> sincronizada con OneDrive. OneDrive no entiende de Git: sincronizar la
> carpeta `.git` puede corromper el repositorio o generar conflictos.
> Si el repositorio crece, considera moverlo a una ruta **fuera** de
> OneDrive, por ejemplo `C:\dev\tierrabomba-3d`.
