# -*- coding: utf-8 -*-
"""
01_preparar_terreno.py
==================================================================
Prepara las capas del terreno de Tierra Bomba para el exportador
Qgis2threejs.

QUE HACE
--------
  1. Reprojecta todas las capas a un CRS metrico (UTM 18N).
  2. Recorta al limite de la isla.
  3. Construye el Modelo Digital del Terreno (MDT) a partir de las
     curvas de nivel del levantamiento topografico.
  4. Deriva pendiente y sombreado (hillshade) del MDT.
  5. Reclasifica las cotas para identificar la meseta segura
     de reubicacion (+22,00 m s. n. m.).
  6. Guarda todo en data/ligero/, listo para abrir en QGIS.

DONDE EJECUTARLO
----------------
  QGIS -> Complementos -> Consola de Python -> Editor
  Abrir este archivo y pulsar "Ejecutar script" (Ctrl+Mayus+P).

  NO se ejecuta con `python` del sistema: necesita PyQGIS, que solo
  existe dentro de QGIS.

ANTES DE EMPEZAR
----------------
  Ajusta RUTAS['origen'] a la carpeta donde tengas los datos crudos.
  El script informa de cada capa que no encuentre en lugar de fallar
  en silencio.
==================================================================
"""

import os
import sys

# ------------------------------------------------------------------
#  CONFIGURACION  <- ajusta estas rutas
# ------------------------------------------------------------------
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if not os.path.isdir(os.path.join(RAIZ, "data")):
    # Cuando se ejecuta desde la consola de QGIS, __file__ puede no existir.
    RAIZ = os.getcwd()

RUTAS = {
    "origen": r"C:\Users\aleja\OneDrive\Documentos",
    "salida": os.path.join(RAIZ, "data", "ligero"),
}

# CRS metrico para Colombia continental / Caribe (Cartagena ~ 75,5 W)
CRS_METRICO = "EPSG:32618"          # WGS 84 / UTM zona 18N
CRS_GEOGRAFICO = "EPSG:4326"        # WGS 84

# Resolucion del MDT en metros. 5 m es buen equilibrio para una isla
# de ~3 x 2 km: detalle suficiente sin generar un raster gigante.
RESOLUCION_MDT = 5.0

# Cotas de interes para la tesis
COTA_SEGURA = 22.00                 # meseta de reubicacion (m s. n. m.)


# ------------------------------------------------------------------
#  Utilidades
# ------------------------------------------------------------------
def _log(msg):
    print(f"[tierrabomba-3d] {msg}")


def _exigir_qgis():
    """Comprueba que estamos dentro de QGIS antes de seguir."""
    try:
        from qgis.core import QgsApplication  # noqa: F401
    except ImportError:
        sys.exit(
            "\n  ERROR: este script necesita PyQGIS.\n"
            "  Ejecutalo desde la Consola de Python de QGIS:\n"
            "  QGIS > Complementos > Consola de Python\n"
        )


def _processing():
    """Devuelve el modulo processing, inicializandolo si hace falta."""
    try:
        import processing
        return processing
    except ImportError:
        from qgis.core import QgsApplication
        QgsApplication.processingRegistry().addProvider  # fuerza el registro
        import processing
        return processing


def _cargar_capa(rutas_candidatas, nombre):
    """
    Intenta cargar la primera capa que exista de una lista de rutas.
    Devuelve (capa, ruta) o (None, None) si no encuentra ninguna.
    """
    from qgis.core import QgsRasterLayer, QgsVectorLayer

    for ruta in rutas_candidatas:
        if not os.path.exists(ruta):
            continue
        ext = os.path.splitext(ruta)[1].lower()
        if ext in (".tif", ".tiff", ".asc", ".dem"):
            capa = QgsRasterLayer(ruta, nombre)
        else:
            capa = QgsVectorLayer(ruta, nombre, "ogr")
        if capa.isValid():
            _log(f"  cargada: {nombre}  <-  {os.path.basename(ruta)}")
            return capa, ruta
        _log(f"  IGNORADA (invalida): {ruta}")

    _log(f"  NO ENCONTRADA: {nombre} (se omite este paso)")
    return None, None


# ------------------------------------------------------------------
#  Pasos del pipeline
# ------------------------------------------------------------------
def reproyectar(capa, sufijo, processing):
    """Reprojecta una capa al CRS metrico."""
    if capa is None:
        return None

    from qgis.core import QgsCoordinateReferenceSystem

    destino = QgsCoordinateReferenceSystem(CRS_METRICO)
    if capa.crs() == destino:
        _log(f"  {capa.name()}: ya esta en {CRS_METRICO}")
        return capa

    salida = processing.run(
        "native:reprojectlayer",
        {"INPUT": capa, "TARGET_CRS": destino, "OUTPUT": "memory:"},
    )["OUTPUT"]
    salida.setName(f"{capa.name()}_{sufijo}")
    _log(f"  {capa.name()}: reproyectada a {CRS_METRICO}")
    return salida


def recortar(capa, mascara, processing):
    """Recorta una capa vectorial al poligono de la isla."""
    if capa is None or mascara is None:
        return capa
    try:
        salida = processing.run(
            "native:clip",
            {"INPUT": capa, "OVERLAY": mascara, "OUTPUT": "memory:"},
        )["OUTPUT"]
        _log(f"  {capa.name()}: recortada al limite de la isla")
        return salida
    except Exception as exc:  # noqa: BLE001
        _log(f"  AVISO: no se pudo recortar {capa.name()} ({exc})")
        return capa


def construir_mdt(curvas, mascara, processing):
    """
    Genera el MDT interpolando las curvas de nivel.

    TIN es mas fiel en terrenos de acantilado como el de Tierra Bomba
    (bordes duros), pero IDW es mas robusto cuando las curvas tienen
    huecos. Se usa TIN y se cae a IDW si falla.
    """
    if curvas is None:
        return None

    campo_cota = _campo_de_cota(curvas)
    if campo_cota is None:
        _log("  AVISO: no se detecto un campo de cota; se omite el MDT")
        return None

    extension = None
    if mascara is not None:
        e = mascara.extent()
        margen = 200
        extension = (
            f"{e.xMinimum() - margen},{e.xMaximum() + margen},"
            f"{e.yMinimum() - margen},{e.yMaximum() + margen} "
            f"[{CRS_METRICO}]"
        )

    _log(f"  interpolando MDT (TIN) con el campo '{campo_cota}' a {RESOLUCION_MDT} m")
    try:
        resultado = processing.run(
            "qgis:tininterpolation",
            {
                "INTERPOLATION_DATA": f"{curvas.source()}::~::0::~::1::~::0",
                "METHOD": 0,
                "EXTENT": extension,
                "PIXEL_SIZE": RESOLUCION_MDT,
                "OUTPUT": "TEMPORARY_OUTPUT",
            },
        )
        return resultado["OUTPUT"]
    except Exception as exc:  # noqa: BLE001
        _log(f"  TIN no disponible ({exc}); probando IDW")
        try:
            resultado = processing.run(
                "qgis:idwinterpolation",
                {
                    "INTERPOLATION_DATA": f"{curvas.source()}::~::0::~::1::~::0",
                    "DISTANCE_COEFFICIENT": 2.0,
                    "EXTENT": extension,
                    "PIXEL_SIZE": RESOLUCION_MDT,
                    "OUTPUT": "TEMPORARY_OUTPUT",
                },
            )
            return resultado["OUTPUT"]
        except Exception as exc2:  # noqa: BLE001
            _log(f"  ERROR: no se pudo interpolar el MDT ({exc2})")
            return None


def _campo_de_cota(capa):
    """Detecta el campo numerico que contiene la elevacion."""
    preferidos = ("cota", "elevacion", "elevación", "elev", "z", "altura", "contour")
    campos = [c for c in capa.fields() if c.isNumeric()]

    for campo in campos:
        if campo.name().lower() in preferidos:
            return campo.name()
    # Si no hay coincidencia por nombre, usar el primer numerico.
    return campos[0].name() if campos else None


def derivar(mdt, processing):
    """Calcula pendiente, sombreado y curvas del MDT."""
    derivadas = {}

    if mdt is None:
        return derivadas

    try:
        derivadas["sombreado"] = processing.run(
            "gdal:hillshade",
            {"INPUT": mdt, "Z_FACTOR": 1.5, "AZIMUTH": 315, "ALTITUDE": 45,
             "OUTPUT": "TEMPORARY_OUTPUT"},
        )["OUTPUT"]
        _log("  sombreado (hillshade) generado")
    except Exception as exc:  # noqa: BLE001
        _log(f"  AVISO: fallo el sombreado ({exc})")

    try:
        derivadas["pendiente"] = processing.run(
            "gdal:slope",
            {"INPUT": mdt, "BAND": 1, "SCALE": 1.0, "OUTPUT": "TEMPORARY_OUTPUT"},
        )["OUTPUT"]
        _log("  pendiente generada")
    except Exception as exc:  # noqa: BLE001
        _log(f"  AVISO: fallo la pendiente ({exc})")

    try:
        derivadas["curvas"] = processing.run(
            "gdal:contour",
            {"INPUT": mdt, "BAND": 1, "INTERVAL": 1.0,
             "FIELD_NAME": "cota", "OUTPUT": "TEMPORARY_OUTPUT"},
        )["OUTPUT"]
        _log("  curvas de nivel regeneradas cada 1 m")
    except Exception as exc:  # noqa: BLE001
        _log(f"  AVISO: fallaron las curvas ({exc})")

    return derivadas


def clasificar_cota_segura(mdt, processing):
    """
    Reclasifica el MDT en dos clases:
      0 -> por debajo de la cota segura (zona de riesgo)
      1 -> igual o por encima de +22,00 m (meseta de reubicacion)
    """
    if mdt is None:
        return None

    try:
        salida = processing.run(
            "native:reclassifybytable",
            {
                "INPUT_RASTER": mdt,
                "RASTER_BAND": 1,
                "TABLE": [-9999, COTA_SEGURA, 0, COTA_SEGURA, 9999, 1],
                "NO_DATA": -9999,
                "RANGE_BOUNDARIES": 0,
                "OUTPUT": "TEMPORARY_OUTPUT",
            },
        )["OUTPUT"]
        _log(f"  zona segura (>= {COTA_SEGURA:.2f} m) clasificada")
        return salida
    except Exception as exc:  # noqa: BLE001
        _log(f"  AVISO: no se pudo clasificar la cota segura ({exc})")
        return None


def guardar(capa, nombre, carpeta):
    """Guarda una capa con el nombre indicado."""
    if capa is None:
        return None

    os.makedirs(carpeta, exist_ok=True)
    from qgis.core import QgsRasterLayer

    es_raster = isinstance(capa, QgsRasterLayer)
    ext = ".tif" if es_raster else ".geojson"
    destino = os.path.join(carpeta, f"{nombre}{ext}")

    if es_raster:
        from qgis.core import QgsRasterFileWriter, QgsRasterPipe
        tubo = QgsRasterPipe()
        tubo.set(capa.dataProvider().clone())
        escritor = QgsRasterFileWriter(destino)
        escritor.writeRaster(tubo, capa.width(), capa.height(),
                             capa.extent(), capa.crs())
    else:
        from qgis.core import QgsVectorFileWriter
        error = QgsVectorFileWriter.writeAsVectorFormat(
            capa, destino, "UTF-8", capa.crs(), "GeoJSON"
        )
        if error[0] != QgsVectorFileWriter.NoError:
            _log(f"  ERROR al guardar {nombre}: {error[1]}")
            return None

    _log(f"  guardado: {os.path.basename(destino)}")
    return destino


# ------------------------------------------------------------------
#  Principal
# ------------------------------------------------------------------
def main():
    _exigir_qgis()
    processing = _processing()

    origen = RUTAS["origen"]
    salida = RUTAS["salida"]

    print()
    print("=" * 66)
    print("  TIERRA BOMBA 3D - Preparacion del terreno")
    print("=" * 66)
    _log(f"origen de datos : {origen}")
    _log(f"carpeta salida  : {salida}")
    _log(f"CRS metrico     : {CRS_METRICO}")
    print()

    # --- 1. Cargar las fuentes disponibles -----------------------
    _log("1) Cargando fuentes")

    limite, _ = _cargar_capa(
        [
            os.path.join(origen, "LOTE.gpkg"),
            os.path.join(origen, "10", "tesis", "LOTE.gpkg"),
        ],
        "limite_isla",
    )

    curvas, _ = _cargar_capa(
        [
            os.path.join(origen, "curvas_nivel.gpkg"),
            os.path.join(origen, "TOPOGRAFIA1.gpkg"),
        ],
        "curvas_nivel",
    )

    usos, _ = _cargar_capa(
        [os.path.join(origen, "Usos_Kennedy.gpkg")], "usos_suelo"
    )

    print()

    # --- 2. Reprojectar y recortar -------------------------------
    _log(f"2) Reprojectando a {CRS_METRICO} y recortando")
    limite_m = reproyectar(limite, "utm18n", processing)
    curvas_m = reproyectar(curvas, "utm18n", processing)
    usos_m = reproyectar(usos, "utm18n", processing)

    curvas_m = recortar(curvas_m, limite_m, processing)
    usos_m = recortar(usos_m, limite_m, processing)
    print()

    # --- 3. MDT y derivadas --------------------------------------
    _log("3) Construyendo el MDT y sus derivadas")
    mdt = construir_mdt(curvas_m, limite_m, processing)
    derivadas = derivar(mdt, processing)
    print()

    # --- 4. Meseta segura ----------------------------------------
    _log(f"4) Identificando la meseta segura (+{COTA_SEGURA:.2f} m s. n. m.)")
    zona_segura = clasificar_cota_segura(mdt, processing)
    print()

    # --- 5. Guardar ----------------------------------------------
    _log("5) Guardando resultados")
    resultados = {
        "limite_isla": limite_m,
        "curvas_nivel": curvas_m,
        "usos_suelo": usos_m,
        "mdt": mdt,
        "hillshade": derivadas.get("sombreado"),
        "pendiente": derivadas.get("pendiente"),
        "curvas_1m": derivadas.get("curvas"),
        "zona_segura": zona_segura,
    }
    for nombre, capa in resultados.items():
        guardar(capa, nombre, salida)

    print()
    print("=" * 66)
    print("  LISTO")
    print("=" * 66)
    _log("Siguiente paso: 02_exportar_qgis2threejs.py")
    _log("Antes, carga el MDT en QGIS y comprueba las cotas del terreno.")
    print()


if __name__ == "__main__" or True:
    # `or True` permite ejecutarlo tambien pegandolo en la consola de QGIS.
    main()
