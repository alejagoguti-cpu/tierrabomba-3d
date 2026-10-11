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

## 7. Reproducibilidad

Para regenerar todo desde cero:

```bash
git clone https://github.com/alejagoguti-cpu/tierrabomba-3d.git
cd tierrabomba-3d
npm install
npm run convert      # requiere el OBJ original de Revit
npm run inspector    # verifica el GLB
npm run dev          # abre el visor
```

Los pasos de QGIS y FreeCAD se ejecutan sobre sus propias aplicaciones,
según lo descrito en las secciones 4 y 5.

---

## 8. Referencias de las herramientas

* QGIS — <https://qgis.org/> (GPL-3.0)
* Qgis2threejs, Minoru Akagi — <https://github.com/minorua/Qgis2threejs> (GPL-3.0)
* FreeCAD — <https://github.com/FreeCAD/FreeCAD> (LGPL-2.1)
* three.js — <https://threejs.org/> (MIT)
* obj2gltf, Cesium GS — <https://github.com/CesiumGS/obj2gltf> (Apache-2.0)
* Especificación glTF 2.0 — <https://registry.khronos.org/glTF/> (Khronos Group)
