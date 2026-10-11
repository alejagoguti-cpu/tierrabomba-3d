#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
generar_mapa_kepler.py
==================================================================
Construye un mapa de kepler.gl con las capas de la tesis y lo guarda
como un archivo HTML autonomo, listo para abrir en cualquier navegador
o adjuntar a la entrega.

POR QUE ESTE SCRIPT Y NO UN JSON DE CONFIGURACION
-------------------------------------------------
La configuracion de kepler.gl esta acoplada a los datos: el dataId de
cada capa debe coincidir exactamente con el id de su dataset. Escribir
ese JSON a mano es fragil. La libreria de Python lo genera de forma
coherente, asi que este script es la via reproducible.

DIFERENCIA CON LA INTERFAZ WEB
------------------------------
  kepler.gl/demo  ->  explorar y ajustar a mano, exportar imagen
  este script     ->  resultado repetible, versionable en Git

REQUISITOS
----------
  pip install keplergl

USO
---
  python scripts/kepler/generar_mapa_kepler.py

  Genera: scripts/kepler/mapa-tierrabomba.html

  Antes conviene haber ejecutado, dentro de QGIS:
    scripts/qgis/01_preparar_terreno.py
    scripts/kepler/exportar_capas_para_kepler.py

NOTA SOBRE EL TOKEN DE MAPBOX
-----------------------------
kepler.gl usa Mapbox para los mapas base. La libreria suele funcionar
con el estilo por defecto sin token. Si el mapa base sale en blanco,
necesitas una cuenta gratuita de Mapbox y su token:

    export MAPBOX_API_KEY="pk.tu_token"

o editar el HTML generado. Es la limitacion principal de kepler.gl
frente al visor propio o TerriaMap, que no piden ninguna cuenta.
==================================================================
"""

import json
import os
import sys

# ------------------------------------------------------------------
#  CONFIGURACION
# ------------------------------------------------------------------
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CARPETA_DATOS = os.path.join(RAIZ, "data", "ligero")
SALIDA = os.path.join(RAIZ, "scripts", "kepler", "mapa-tierrabomba.html")

# Encuadre sobre la isla (WGS 84, datos de OpenStreetMap)
CENTRO = {"latitude": 10.34975, "longitude": -75.5705}
ZOOM = 13
ALTURA_PX = 760

# Capas a incluir, en orden de dibujo (la primera queda debajo).
# Solo se cargan las que existan: el script no falla si faltan.
CAPAS = [
    "limite_isla_kepler",
    "usos_suelo_kepler",
    "zona_segura_kepler",
    "curvas_1m_kepler",
]


def _log(msg):
    print(f"[tierrabomba-3d] {msg}")


def _comprobar_dependencia():
    """Comprueba que keplergl este instalado, con un mensaje util si no."""
    try:
        import keplergl  # noqa: F401
    except ImportError:
        print()
        _log("ERROR: falta la libreria keplergl.")
        print()
        _log("Instalala con:")
        _log("    pip install keplergl")
        print()
        _log("Si usas un entorno virtual, activalo antes.")
        _log("Alternativa sin instalar nada: arrastra los archivos")
        _log("*_kepler.geojson a https://kepler.gl/demo")
        print()
        sys.exit(1)


def cargar_capas():
    """
    Lee los GeoJSON preparados.

    keplergl acepta el GeoJSON como cadena de texto, que es la forma
    mas directa y evita depender de geopandas.

    Devuelve un diccionario {nombre: contenido_geojson}.
    """
    datos = {}

    if not os.path.isdir(CARPETA_DATOS):
        _log(f"ERROR: no existe la carpeta {CARPETA_DATOS}")
        return datos

    for nombre in CAPAS:
        ruta = os.path.join(CARPETA_DATOS, f"{nombre}.geojson")
        if not os.path.exists(ruta):
            _log(f"  no encontrada (se omite): {nombre}.geojson")
            continue

        try:
            with open(ruta, "r", encoding="utf-8") as f:
                contenido = json.load(f)
        except (OSError, json.JSONDecodeError) as exc:
            _log(f"  ERROR al leer {nombre}.geojson: {exc}")
            continue

        # Validacion minima: kepler.gl necesita un FeatureCollection.
        tipo = contenido.get("type")
        if tipo not in ("FeatureCollection", "Feature"):
            _log(f"  IGNORADA: {nombre}.geojson no es GeoJSON valido (type={tipo})")
            continue

        if tipo == "FeatureCollection":
            n = len(contenido.get("features", []))
            if n == 0:
                _log(f"  IGNORADA: {nombre}.geojson no tiene entidades")
                continue
            _log(f"  cargada: {nombre}  ({n} entidad(es))")
        else:
            _log(f"  cargada: {nombre}  (1 entidad)")

        datos[nombre] = contenido

    return datos


def construir_config():
    """
    Configuracion inicial del mapa: encuadre sobre la isla.

    Se mantiene minima a proposito. El resto de ajustes (colores,
    filtros, capas) conviene hacerlos en la interfaz y volver a
    exportar, en lugar de intentar adivinarlos aqui.
    """
    return {
        "version": "v1",
        "config": {
            "mapState": {
                "latitude": CENTRO["latitude"],
                "longitude": CENTRO["longitude"],
                "zoom": ZOOM,
                "pitch": 0,
                "bearing": 0,
                "dragRotate": False,
                "isSplit": False,
            },
            "visState": {
                "filters": [],
                "layers": [],
                "interactionConfig": {},
                "layerBlending": "normal",
                "splitMaps": [],
            },
        },
    }


def main():
    _comprobar_dependencia()

    from keplergl import KeplerGl

    print()
    print("=" * 66)
    print("  TIERRA BOMBA 3D - Mapa de kepler.gl")
    print("=" * 66)
    _log(f"datos   : {CARPETA_DATOS}")
    _log(f"salida  : {SALIDA}")
    _log(f"centro  : {CENTRO['latitude']}, {CENTRO['longitude']}  (zoom {ZOOM})")
    print()

    _log("cargando capas")
    datos = cargar_capas()

    if not datos:
        print()
        _log("ERROR: no se cargo ninguna capa.")
        _log("Ejecuta primero, dentro de QGIS:")
        _log("  1) scripts/qgis/01_preparar_terreno.py")
        _log("  2) scripts/kepler/exportar_capas_para_kepler.py")
        print()
        sys.exit(1)

    print()
    _log(f"construyendo el mapa con {len(datos)} capa(s)")

    mapa = KeplerGl(height=ALTURA_PX, data=datos, config=construir_config())

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)

    try:
        mapa.save_to_html(file_name=SALIDA)
    except Exception as exc:  # noqa: BLE001
        _log(f"  AVISO: fallo con la configuracion inicial ({exc})")
        _log("  Reintentando sin configuracion...")
        try:
            mapa = KeplerGl(height=ALTURA_PX, data=datos)
            mapa.save_to_html(file_name=SALIDA)
        except Exception as exc2:  # noqa: BLE001
            _log(f"  ERROR: no se pudo guardar el HTML: {exc2}")
            sys.exit(1)

    if not os.path.exists(SALIDA):
        _log("ERROR: no se genero el archivo HTML")
        sys.exit(1)

    kb = os.path.getsize(SALIDA) / 1024
    print()
    print("=" * 66)
    _log(f"LISTO: {SALIDA}  ({kb:.0f} KB)")
    print("=" * 66)
    print()
    _log("Abre el HTML en el navegador. Si el mapa base sale en blanco,")
    _log("necesitas un token de Mapbox (ver la cabecera de este script).")
    print()
    _log("ATRIBUCION: la capa del limite insular proviene de OpenStreetMap.")
    _log("Cita siempre: (c) OpenStreetMap contributors - ODbL 1.0")
    print()


if __name__ == "__main__":
    main()
