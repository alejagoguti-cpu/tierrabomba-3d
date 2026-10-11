# -*- coding: utf-8 -*-
"""
exportar_capas_para_kepler.py
==================================================================
Prepara las capas de la tesis para cargarlas en kepler.gl.

POR QUE HACE FALTA ESTE PASO
----------------------------
kepler.gl SOLO acepta WGS 84 (EPSG:4326) o Web Mercator (EPSG:3857).
Los scripts de analisis del proyecto trabajan en UTM 18N (EPSG:32618),
que es el huso metrico correcto para calcular areas y pendientes en
Cartagena. Cargar un archivo en UTM directamente en kepler.gl da un
mapa mal situado, casi siempre fuera de Colombia.

Este script reprojecta y deja todo listo.

QUE GENERA
----------
En data/ligero/, con sufijo _kepler para no confundir con las capas
de analisis:

  limite_isla_kepler.geojson      Poligono
  zona_segura_kepler.geojson      Poligono
  usos_suelo_kepler.geojson       Poligono
  curvas_1m_kepler.geojson        Linea
  puntos_control_kepler.csv       Puntos con columnas lat/lng

RECORDATORIO IMPORTANTE SOBRE GEOJSON EN KEPLER.GL
--------------------------------------------------
kepler.gl crea UNA SOLA capa de tipo Polygon por archivo GeoJSON,
aunque el archivo mezcle puntos, lineas y poligonos. Por eso este
script separa cada tipo de geometria en su propio archivo: es la
unica forma de poder estilarlos por separado en la interfaz.

DONDE EJECUTARLO
----------------
  QGIS -> Complementos -> Consola de Python -> Editor
  Abrir este archivo y pulsar "Ejecutar script".

  Requiere haber ejecutado antes 01_preparar_terreno.py.
==================================================================
"""

import csv
import os
import sys

# ------------------------------------------------------------------
#  CONFIGURACION
# ------------------------------------------------------------------
RAIZ = os.getcwd()
ENTRADA = os.path.join(RAIZ, "data", "ligero")
SALIDA = os.path.join(RAIZ, "data", "ligero")

# kepler.gl admite 4326 y 3857. Usamos 4326 (grados) porque es el
# formato nativo de GeoJSON y no pierde precision al exportar.
CRS_DESTINO = "EPSG:4326"

# Capas a exportar: nombre del archivo de entrada -> (nombre salida, tipo)
CAPAS = {
    "limite_isla": ("limite_isla_kepler", "poligono"),
    "zona_segura": ("zona_segura_kepler", "poligono"),
    "usos_suelo": ("usos_suelo_kepler", "poligono"),
    "curvas_1m": ("curvas_1m_kepler", "linea"),
    "curvas_nivel": ("curvas_nivel_kepler", "linea"),
}


def _log(msg):
    print(f"[tierrabomba-3d] {msg}")


def _exigir_qgis():
    try:
        from qgis.core import QgsApplication  # noqa: F401
    except ImportError:
        sys.exit(
            "\n  ERROR: este script necesita PyQGIS.\n"
            "  Ejecutalo desde la Consola de Python de QGIS.\n"
        )


def _cargar(ruta):
    """Carga una capa vectorial y comprueba que sea valida."""
    from qgis.core import QgsVectorLayer

    capa = QgsVectorLayer(ruta, os.path.basename(ruta), "ogr")
    if not capa.isValid():
        return None
    return capa


def reproyectar(capa, processing):
    """Reprojecta al CRS que entiende kepler.gl."""
    from qgis.core import QgsCoordinateReferenceSystem

    destino = QgsCoordinateReferenceSystem(CRS_DESTINO)
    if capa.crs() == destino:
        _log(f"  {capa.name()}: ya esta en {CRS_DESTINO}")
        return capa

    origen = capa.crs().authid() or "desconocido"
    salida = processing.run(
        "native:reprojectlayer",
        {"INPUT": capa, "TARGET_CRS": destino, "OUTPUT": "memory:"},
    )["OUTPUT"]
    _log(f"  {capa.name()}: {origen} -> {CRS_DESTINO}")
    return salida


def exportar_geojson(capa, destino, tipo):
    """
    Exporta a GeoJSON.

    Se fuerza GeoJSON 2008 (RFC 7946) con coordenadas en grados y
    sin envolver en un CRS explicito, que es lo que kepler.gl espera.
    """
    opciones = (
        "RFC7946=YES",          # GeoJSON 2008: obliga a WGS84
        "COORDINATE_PRECISION=6",  # ~11 cm, mas que suficiente
        "WRITE_NAME=NO",
    )

    from qgis.core import QgsVectorFileWriter

    error = QgsVectorFileWriter.writeAsVectorFormat(
        capa,
        destino,
        "UTF-8",
        capa.crs(),
        "GeoJSON",
        layerOptions=opciones,
    )

    if error[0] != QgsVectorFileWriter.NoError:
        _log(f"  ERROR al escribir {os.path.basename(destino)}: {error[1]}")
        return False

    kb = os.path.getsize(destino) / 1024
    _log(f"  {tipo:9} -> {os.path.basename(destino):34} {kb:8.1f} KB")
    return True


def exportar_csv_puntos(capa, destino):
    """
    Exporta los vertices como CSV con columnas lat/lng.

    kepler.gl detecta automaticamente los pares de columnas
    acabados en _lat / _lng y crea una capa de puntos sin configurar
    nada. Es la via mas comoda para datos tabulares.
    """
    if capa is None:
        return False

    from qgis.core import QgsCoordinateReferenceSystem
    from qgis.core import QgsCoordinateTransform, QgsProject

    # Asegurar grados antes de leer coordenadas
    if capa.crs() != QgsCoordinateReferenceSystem(CRS_DESTINO):
        return False

    filas = []
    for entidad in capa.getFeatures():
        geom = entidad.geometry()
        if geom.isMultipart():
            partes = geom.asMultiPoint()
            puntos = partes if partes else []
        else:
            p = geom.asPoint()
            puntos = [p] if p else []

        for punto in puntos:
            fila = {"nombre": entidad["nombre"] if "nombre" in entidad.fields().names() else "",
                    "longitud": round(punto.x(), 6),
                    "latitud": round(punto.y(), 6),
                    # kepler.gl detecta estos pares automaticamente
                    "punto_lng": round(punto.x(), 6),
                    "punto_lat": round(punto.y(), 6)}
            filas.append(fila)

    if not filas:
        _log("  CSV: la capa no tiene puntos")
        return False

    campos = ["nombre", "longitud", "latitud", "punto_lng", "punto_lat"]
    with open(destino, "w", newline="", encoding="utf-8") as f:
        escritor = csv.DictWriter(f, fieldnames=campos)
        escritor.writeheader()
        escritor.writerows(filas)

    kb = os.path.getsize(destino) / 1024
    _log(f"  puntos    -> {os.path.basename(destino):34} {kb:8.1f} KB  ({len(filas)} filas)")
    return True


def main():
    _exigir_qgis()

    import processing

    print()
    print("=" * 66)
    print("  TIERRA BOMBA 3D - Exportacion para kepler.gl")
    print("=" * 66)
    _log(f"origen  : {ENTRADA}")
    _log(f"destino : {SALIDA}")
    _log(f"CRS     : {CRS_DESTINO}  (kepler.gl solo admite 4326 o 3857)")
    print()

    if not os.path.isdir(ENTRADA):
        sys.exit(f"  ERROR: no existe {ENTRADA}. Ejecuta antes 01_preparar_terreno.py\n")

    exportadas = 0
    faltantes = []

    for base, (nombre_salida, tipo) in CAPAS.items():
        ruta = os.path.join(ENTRADA, f"{base}.geojson")
        if not os.path.exists(ruta):
            faltantes.append(base)
            continue

        capa = _cargar(ruta)
        if capa is None:
            _log(f"  IGNORADA (invalida): {base}.geojson")
            continue

        capa_4326 = reproyectar(capa, processing)
        destino = os.path.join(SALIDA, f"{nombre_salida}.geojson")

        if exportar_geojson(capa_4326, destino, tipo):
            exportadas += 1

    # --- CSV de puntos, si hay alguna capa puntual ---------------
    print()
    for base in ("puntos_control", "actores", "pozos"):
        ruta = os.path.join(ENTRADA, f"{base}.geojson")
        if not os.path.exists(ruta):
            continue
        capa = _cargar(ruta)
        if capa is None:
            continue
        capa_4326 = reproyectar(capa, processing)
        destino = os.path.join(SALIDA, f"{base}_kepler.csv")
        exportar_csv_puntos(capa_4326, destino)

    print()
    print("=" * 66)

    if exportadas == 0:
        _log("No se exporto ninguna capa.")
        _log("Ejecuta primero 01_preparar_terreno.py para generarlas.")
    else:
        _log(f"Listo: {exportadas} capa(s) exportada(s) a {CRS_DESTINO}")
        print()
        _log("Siguiente paso, elige una:")
        _log("  A) Arrastra los *_kepler.geojson a https://kepler.gl/demo")
        _log("  B) python scripts/kepler/generar_mapa_kepler.py")

    if faltantes:
        print()
        _log("Capas no encontradas (se omiten): " + ", ".join(faltantes))

    print()
    _log("AVISO: kepler.gl hace UNA capa Polygon por archivo GeoJSON.")
    _log("Por eso cada tipo de geometria va en su propio archivo.")
    print()


if __name__ == "__main__" or True:
    main()
