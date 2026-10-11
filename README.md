# 🏝️ TIERRA BOMBA 3D

> **Plataforma de información territorial, arquitectura y transformación.**
> Isla de Tierra Bomba · Cartagena de Indias, Colombia.

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![MapLibre](https://img.shields.io/badge/MapLibre_GL-6.x-295DAA?style=flat)](https://maplibre.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![OSM](https://img.shields.io/badge/Datos-OpenStreetMap-7EBC6F?style=flat&logo=openstreetmap)](https://www.openstreetmap.org/)
[![Catastro](https://img.shields.io/badge/Datos-Catastro_oficial-2F7DD1?style=flat)](#-origen-de-los-datos)

**Sitio publicado:** <https://alejagoguti-cpu.github.io/tierrabomba-3d/>

---

## 📌 Qué es

Un atlas digital tridimensional de la isla de Tierra Bomba. Permite explorar el territorio, sus
edificaciones, equipamientos, infraestructura y condiciones ambientales en un mismo entorno, con
datos **reales, georreferenciados y trazables**.

El principio que gobierna todo el proyecto: **no se inventa ningún dato**. Lo que no existe se
declara como ausente; lo que es una estimación se marca como estimación.

---

## ✅ Estado actual

### Funciona y está verificado

| Módulo | Ruta | Estado |
|---|---|---|
| Portada narrativa con scroll cinematográfico | `/` | ✅ 6 escenas, cámara y capas reales |
| Visor territorial 3D | `/explorar` | ✅ Terreno real, 13 capas, medición, fichas, vistas guardadas |
| Catálogo de datos y procedencia | `/datos` | ✅ Metadatos, licencias, descargas, manifiestos |
| Participación ciudadana | `/participa` | ✅ Genera informe estructurado descargable |

### Fases siguientes

| Módulo | Ruta | Qué falta |
|---|---|---|
| Equipamientos | `/equipamientos` | Inventario oficial (la descarga de Overpass está fallando por saturación) |
| Construcciones | `/construcciones` | Explorador tabular con filtros y exportación |
| Proyectos | `/proyectos` | Visor glTF/IFC del modelo arquitectónico |
| Ambiente | `/ambiente` | Línea de costa histórica y ecosistemas oficiales |
| Análisis | `/analisis` | Pendientes, cobertura y accesibilidad con Turf.js |

Las rutas aún no implementadas **no muestran botones decorativos**: explican qué harán, qué datos
necesitan y en qué estado están.

---

## 🌍 Origen de los datos

### 1. OpenStreetMap — colaborativo

Descargado vía Overpass API con `npm run datos:osm`. **1.287 entidades**:

| Capa | Entidades |
|---|---|
| Edificaciones | 827 |
| Vías y senderos | 304 |
| Elementos naturales | 100 |
| Hidrografía | 43 |
| Usos del suelo | 13 |

Licencia **ODbL 1.0**. Atribución obligatoria: **© OpenStreetMap contributors**.

### 2. Catastro oficial de Cartagena — institucional

Importado de `Cartografia_Catastro_AMB_Cartagena.zip` (1,16 GB) con `node scripts/datos/importar_catastro.mjs`.
**10.050 entidades** recortadas al ámbito de la isla:

| Capa | Entidades | De un total municipal de |
|---|---|---|
| Unidades de construcción | 4.505 | 375.048 |
| **Construcciones** | **2.714** | 185.161 |
| Predios | 2.584 | 161.696 |
| Manzanas | 238 | 9.526 |
| Barrios | 4 | 217 |
| Veredas | 4 | 251 |
| Sectores rurales | 1 | 254 |

### ⚠️ Dos trampas técnicas que hubo que resolver

**1. El sistema de coordenadas.** Los shapefiles no vienen en WGS 84. Su `.prj` declara
`MAGNA_SIRGAS_Origen_Nacional`: proyección Transversa de Mercator con meridiano central −73,
falso este 5.000.000 y falso norte 2.000.000 — **EPSG:9377**, el sistema oficial colombiano.
Cargarlos sin convertir los situaría a cientos de kilómetros de su posición real. Se reproyectan
con `proj4` (elipsoide GRS80).

**2. El recorte.** Los datos cubren todo el municipio de Cartagena. Un primer intento con una caja
envolvente generosa capturó **77.284 construcciones** — el casco urbano de Cartagena, no la isla.
La versión final filtra contra el polígono real de la isla con un margen de 250 m, y baja a las
2.714 que sí pertenecen a Tierra Bomba.

---

## 🔍 Hallazgo principal

Cruzando ambas fuentes aparece el dato más útil del proyecto:

> **El 99 % de las construcciones de Tierra Bomba es de una sola planta, con una altura media de
> 2,97 m.**

Lo dice el catastro oficial: 2.687 de 2.714 construcciones tienen `altura_tot` registrada, con un
máximo de 3 m. En OpenStreetMap, en cambio, solo **1 de 827** edificaciones tenía altura.

Esto obligó a corregir el visor 3D: la extrusión aproximada de las edificaciones de OpenStreetMap
estaba fijada en 6 m (dos plantas, valor por defecto razonable en un entorno urbano) y ahora es de
**3,2 m, calibrada con el dato catastral**. El caserío de la isla es abrumadoramente horizontal, y
ahora el modelo lo refleja.

En el visor, las dos capas de construcción se distinguen visualmente: la del catastro se extruye
con su altura real y opacidad alta; la de OpenStreetMap, con tonos apagados y opacidad reducida.

---

## 🏗️ Decisiones técnicas

Están documentadas con su razonamiento en [`docs/decisiones-tecnicas.md`](docs/decisiones-tecnicas.md).
Resumen:

| Decisión | Elección | Por qué |
|---|---|---|
| Motor del visor | **MapLibre GL JS, uno solo** | Ligero, sin token ni cuenta, con terreno real y extrusión nativa. Cesium y su globo 3D resultaban redundantes con TerriaMap para este ámbito insular |
| Compilación | **Exportación estática** | GitHub Pages solo sirve archivos estáticos. Consecuencia: sin API ni Server Actions |
| Participación | **Informe descargable** | Sin backend no hay envío posible. Se genera un informe estructurado en lugar de simular un formulario |
| Tipos | **Comprobación fuera del build** | `npm run typecheck` en lugar de encadenar dos compilaciones |
| Terreno | **AWS Terrain Tiles** | Elevación real (SRTM/GMTED) sin credenciales |
| Cartografía base | **OpenFreeMap** | Teselas vectoriales libres, sin clave de API |

**Ninguna herramienta de esta plataforma requiere cuenta ni token.**

---

## 🚀 Uso

```bash
git clone https://github.com/alejagoguti-cpu/tierrabomba-3d.git
cd tierrabomba-3d
npm install

# Datos (solo la primera vez; se versionan en el repositorio)
npm run datos:limite   # límite insular desde OpenStreetMap
npm run datos:osm      # capas vectoriales desde Overpass API
node scripts/datos/importar_catastro.mjs   # catastro oficial (requiere el ZIP)

# Desarrollo
npm run dev            # -> http://localhost:3000
npm run typecheck      # comprobación de tipos (obligatoria antes de entregar)
npm run build          # genera el sitio estático en out/
```

### Comandos disponibles

| Comando | Función |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila el sitio estático en `out/` |
| `npm run typecheck` | Comprueba tipos sin compilar |
| `npm run datos:limite` | Descarga el límite insular de OpenStreetMap |
| `npm run datos:osm` | Descarga las capas vectoriales de Overpass |
| `npm run datos:publico` | Copia los datos a `public/` (automático en dev y build) |
| `npm run convert` | Convierte el OBJ de Revit a GLB optimizado |
| `npm run inspector` | Verifica la estructura de un GLB |

---

## 📂 Estructura

```
tierrabomba-3d/
├── app/                          Rutas de Next.js (App Router)
│   ├── page.tsx                  Portada narrativa
│   ├── explorar/                 Visor territorial 3D
│   └── (sitio)/                  Secciones con navegación y pie comunes
│       ├── datos/                Catálogo de procedencia
│       ├── equipamientos/        (fase siguiente)
│       └── participa/            Participación ciudadana
├── components/
│   ├── mapa/                     Visor, panel de capas, fichas, controles
│   ├── inicio/                   Portada narrativa
│   └── layout/                   Navegación, pie, módulos en desarrollo
├── lib/
│   ├── catalogo.ts               Fuente única de las capas y sus metadatos
│   ├── datos/servidor.ts         Lectura de manifiestos en tiempo de compilación
│   ├── geo/estilos.ts            Catálogo -> especificaciones de MapLibre
│   └── utils.ts                  Formateo en español
├── data/
│   ├── osm/                      Capas de OpenStreetMap + manifiesto
│   ├── oficial/                  Capas del catastro + manifiesto
│   ├── ligero/                   Límite insular
│   └── pesado/                   (vacío; los originales van en Releases)
├── scripts/
│   ├── datos/                    Descarga, importación y publicación
│   ├── qgis/                     Preparación del terreno y Qgis2threejs
│   ├── freecad/                  Macro de modelado de sólidos
│   ├── terria/                   Catálogo para el globo 3D
│   ├── kepler/                   Exportación para análisis
│   └── web/                      Conversión de modelos y servidores locales
├── docs/                         Metodología y decisiones técnicas
└── assets/modelos/               Modelo 3D del equipamiento (GLB)
```

---

## 📐 Arquitectura del visor

```
data/                    manifiestos + GeoJSON
   │
   ├─► lib/datos/servidor.ts     lee en tiempo de compilación
   │        │
   │        └─► lib/catalogo.ts  metadatos + recuentos reales
   │                 │
   │                 └─► lib/geo/estilos.ts   expresiones de MapLibre
   │                          │
   └──────────────────────────┴─► components/mapa/VisorTerritorial.tsx
                                        │
                    MapLibre GL + OpenFreeMap + AWS Terrain + Turf.js
```

La separación es estricta: **los datos** viven en `data/`, **la lógica geoespacial** en `lib/geo/`,
**los metadatos** en `lib/catalogo.ts` y **la interfaz** en `components/`. Añadir una capa al
catálogo la propaga al visor, al panel de capas, a las leyendas y a la página de datos sin tocar
nada más.

### Rendimiento

- Las capas se montan una sola vez y se muestran u ocultan con `setLayoutProperty`; no se destruyen
  ni se recrean.
- La extrusión 3D solo se activa en modo 3D y solo para las dos capas de construcción.
- Las etiquetas se añaden en una segunda pasada para que queden sobre todos los rellenos.
- El filtro del catastro se hace en coordenadas nativas antes de reproyectar: descarta 350.000 de
  375.000 entidades sin coste de conversión.

---

## ♿ Accesibilidad

- Enlace de salto al contenido como primera parada del teclado.
- Foco visible y consistente en toda la interfaz.
- Interruptores de capa con `role="switch"` y `aria-checked`.
- `aria-current` en la navegación y `aria-pressed` en los controles con estado.
- Respeto de `prefers-reduced-motion`.
- Contraste verificado sobre los paneles translúcidos.

---

## 📜 Licencias y atribución

* **Código:** MIT — ver [`LICENSE`](LICENSE).
* **Datos de OpenStreetMap:** © OpenStreetMap contributors, **ODbL 1.0**. Atribución obligatoria.
* **Catastro oficial:** © Catastro municipal de Cartagena de Indias. Uso institucional; verificar
  condiciones con la entidad productora antes de redistribuir.
* **Modelo BIM y documentos de la tesis:** © 2026 Alejandra Gómez & Ana Casas. Todos los derechos
  reservados.
* **Elevación:** AWS Terrain Tiles (SRTM/GMTED). **Cartografía base:** OpenFreeMap.

---

**Autoras:** Alejandra Gómez & Ana Casas
**Tesis de Grado en Arquitectura & Urbanismo — 2026**
