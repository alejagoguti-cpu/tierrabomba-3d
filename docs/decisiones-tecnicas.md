# Decisiones técnicas

Registro de las decisiones de arquitectura de **TIERRA BOMBA 3D**, con el problema que resolvían
y las alternativas descartadas. Se documenta lo que se eligió y, sobre todo, **por qué no se
eligió lo demás**.

---

## DT-01 · Un solo motor de mapas: MapLibre GL JS

**Contexto.** La consigna pedía CesiumJS y TerriaMap, y también advertía de no integrar
bibliotecas de forma indiscriminada ni duplicar visores.

**Decisión.** Un único motor dentro de la aplicación: **MapLibre GL JS**.

| Alternativa | Por qué se descartó |
|---|---|
| CesiumJS | Globo 3D completo y 3D Tiles, pero ~3 MB de librería y el terreno de calidad exige token de Cesium Ion. Para una isla de 19 km², el globo no aporta nada que no dé MapLibre. |
| TerriaMap | No es una librería sino una **aplicación** completa con su propio catálogo. Incrustarla en Next.js sería duplicar visores. Se mantiene como despliegue independiente en [`scripts/terria/`](../scripts/terria/README.md). |
| deck.gl | Excelente para millones de puntos. Con 13.000 entidades reales no se justifica la capa extra; añadirlo sería peso sin función. |

**Consecuencia.** El visor cubre globo, terreno, extrusión 3D, capas vectoriales, medición y
selección con un solo motor, sin credenciales y con la mitad de peso.

---

## DT-02 · Compilación como sitio estático

**Contexto.** El destino es GitHub Pages, que solo sirve archivos estáticos.

**Decisión.** `output: 'export'` en Next.js. El mismo `npm run build` genera el artefacto que se
publica: sin servidor Node, sin contenedor.

**Consecuencia asumida.** No hay API routes ni Server Actions. Esto condiciona directamente la
DT-03.

**Alternativa descartada.** Servidor Node en Vercel o similar. Añade una dependencia de
infraestructura sin resolver ninguna necesidad actual: todo el visor es cliente.

---

## DT-03 · Participación ciudadana sin backend: informe descargable

**Contexto.** La consigna pide un sistema de aportes ciudadanos con moderación, pero también
prohíbe sustituir funciones ausentes por botones decorativos.

**El problema.** Sin servidor, un formulario de envío no puede hacer nada. Ponerlo sería
exactamente el botón decorativo que la consigna prohíbe.

**Decisión.** El formulario construye un **informe estructurado en JSON** que la persona descarga
o copia, y lo remite por correo o como incidencia en el repositorio. El informe incluye el estado
`pendiente-de-validacion` y la nota de que no debe publicarse sin contrastar.

**Por qué es mejor que un formulario falso.** La información no se pierde, queda constancia
verificable del aporte y el flujo de validación está declarado. Cuando exista backend (Supabase,
Directus o una API propia), el componente se conecta a él **sin cambiar la interfaz**.

---

## DT-04 · Traducción del catálogo a MapLibre en una capa intermedia

**Contexto.** El visor necesitaba dibujar capas de geometría mixta con atribución de origen y
recuentos reales.

**Decisión.** Tres niveles separados:

1. `lib/catalogo.ts` — metadatos de cada capa (fuente, licencia, limitaciones, estado).
2. `lib/geo/estilos.ts` — traduce el catálogo a especificaciones de MapLibre.
3. `components/mapa/` — interfaz, sin conocimiento de dónde vienen los datos.

**Consecuencia.** Añadir una capa al catálogo la propaga al visor, al panel, a las leyendas y a la
página de datos. La interfaz nunca contiene identificadores de capa codificados a mano... salvo en
los tres puntos donde el orden de dibujo importa, que están declarados explícitamente en
`ORDEN_DIBUJO`.

---

## DT-05 · Recorte del catastro por polígono, no por caja envolvente

**Contexto.** El ZIP del catastro cubre todo el municipio de Cartagena (185.161 construcciones).

**Error cometido y corregido.** La primera versión filtró por caja envolvente generosa
(10,285–10,415 N). Capturó **77.284 construcciones**: el casco urbano de Cartagena, que queda a
menos de 5 km al norte de la isla.

**Decisión.** Dos filtros en serie:

1. **Prefiltro en coordenadas nativas** contra una caja ajustada. Descarta 350.677 de 375.048
   entidades **sin coste de reproyección**, porque se evalúa antes de convertir.
2. **Recorte contra el polígono real de la isla**, con un margen efectivo de 250 m implementado
   probando ocho puntos alrededor del centroide.

**Resultado.** 2.714 construcciones: las de la isla.

**Lección.** Una caja envolvente es una aproximación peligrosa cuando el área de estudio es una
isla rodeada de territorio densamente urbanizado.

---

## DT-06 · Reproyección con proj4 en lugar de GDAL

**Contexto.** Los shapefiles del catastro vienen en **EPSG:9377** (MAGNA-SIRGAS Origen Nacional).
Sin convertir, los datos aparecen a cientos de kilómetros de su posición.

**Restricción.** No hay GDAL ni ogr2ogr en el entorno, ni `osgeo`/`fiona`/`geopandas` en Python.

**Alternativas evaluadas.**

| Opción | Veredicto |
|---|---|
| Instalar GDAL | No disponible como paquete en este entorno |
| Implementar la Transversa de Mercator a mano | Funciona, pero es código de geodesia que hay que validar; `proj4` ya lo tiene resuelto y probado |
| **proj4** | ✅ 3 paquetes, definición explícita tomada del propio `.prj` |

**Validación.** Se comprobó que las cajas envolventes resultantes caen dentro de los límites
conocidos de la isla (10,318–10,381 N; −75,593 a −75,537 O). La conversión está verificada de
extremo a extremo, no solo ejecutada.

---

## DT-07 · Altura de extrusión calibrada con dato oficial

**Contexto.** Para extruir las edificaciones de OpenStreetMap hacía falta una altura, y solo **1 de
827** la tenía registrada.

**Decisión inicial (incorrecta).** 6 m: dos plantas, valor por defecto razonable en entorno urbano.

**Corrección tras importar el catastro.** El catastro registra `altura_tot` para **2.687 de 2.714**
construcciones (99,0 %), con media de **2,97 m** y máximo de 3 m. El caserío de Tierra Bomba es
abrumadoramente de una planta.

**Decisión final.** **3,2 m** (una planta), calibrada con el dato catastral y documentada como
aproximación declarada en el propio código.

**Consecuencia en la interfaz.** Las dos capas de construcción se distinguen visualmente y la ficha
del elemento explica en cada caso si la altura es un dato registrado o una estimación.

---

## DT-08 · Comprobación de tipos fuera del build

**Contexto.** El entorno de desarrollo impide lanzar procesos hijos con tuberías, y la compilación
de Next.js los necesita. Se probó `experimental.workerThreads: true` para sustituirlos por hilos,
pero rompe la generación estática con `DataCloneError`.

**Decisión.** `typescript.ignoreBuildErrors` activado, y comprobación obligatoria con
`npm run typecheck` antes de cada entrega.

**Justificación.** No se pierde seguridad de tipos: se ejecuta el mismo `tsc`, solo que en un paso
aparte. Encadenar dos compilaciones completas en cada iteración no aportaba nada.

---

## DT-09 · Datos en Git, originales pesados en Releases

**Contexto.** El ZIP del catastro pesa 1,16 GB; la geodatabase interna, 3 GB.

**Decisión.**

| Tipo | Destino |
|---|---|
| GeoJSON procesados (7,2 MB en total) | Git normal |
| ZIP original y shapefiles crudos | Fuera del repositorio |
| Modelo BIM y capturas | Release de GitHub |
| `public/datos/` y `public/modelos/` | Generados en `prebuild`, ignorados por Git |

**Consecuencia.** El repositorio se clona sin necesidad de `git-lfs` ni de descargar un gigabyte. La
receta completa para regenerar los datos está en el README.

---

## DT-10 · Fuentes sin credenciales

**Contexto.** La consigna permite dependencias externas si se explican y se ofrece alternativa.

**Decisión.** Ninguna herramienta de la plataforma requiere cuenta ni token:

| Función | Fuente | Credencial |
|---|---|---|
| Cartografía base | OpenFreeMap | Ninguna |
| Elevación | AWS Terrain Tiles (SRTM/GMTED) | Ninguna |
| Datos vectoriales | OpenStreetMap vía Overpass | Ninguna |
| Catastro | ZIP local aportado por las autoras | Ninguna |

**Alternativa descartada.** Mapbox o MapTiler para la base. Mejor acabado en algunos estilos, pero
introduce una clave de API, cuotas y una dependencia de servicio para un proyecto académico que
debe seguir funcionando dentro de dos años.

---

## DT-11 · Participación: privacidad por defecto

**Decisión.** En el módulo de participación, los datos personales son **opcionales**, no se publican
y el aporte puede ser anónimo. Se advierte explícitamente de que no se admiten fotografías con
personas identificables sin consentimiento.

**Motivo.** La consigna pide controles de privacidad y protección de información sensible. Sin
backend no hay almacenamiento que asegurar, pero el diseño del informe ya evita recoger más datos de
los necesarios.
