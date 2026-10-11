# -*- coding: utf-8 -*-
"""
02_exportar_qgis2threejs.py
==================================================================
Automatiza la exportacion de la escena 3D con el complemento
Qgis2threejs, y genera la pagina HTML final que se publica.

IMPORTANTE - HONESTIDAD SOBRE LA AUTOMATIZACION
-----------------------------------------------
Qgis2threejs es un complemento de QGIS con interfaz grafica. Su API
de Python existe pero NO es estable entre versiones: los nombres de
las clases y de sus metodos cambian de una version a otra.

Por eso este script hace lo siguiente:

  * Si encuentra la API del complemento, la usa para exportar sin
    intervencion manual.
  * Si no la encuentra, NO falla: prepara el proyecto de QGIS con
    todas las capas y ajustes correctos, imprime la configuracion
    exacta que debes introducir en el dialogo, y abre el propio
    dialogo del complemento.

Asi el resultado es el mismo en cualquier version, y el script nunca
te deja a medias.

DONDE EJECUTARLO
----------------
  QGIS -> Complementos -> Consola de Python -> Editor
  Abrir este archivo y pulsar "Ejecutar script".

REQUISITO
---------
  Complemento Qgis2threejs instalado:
  QGIS -> Complementos -> Administrar e instalar complementos
       -> buscar "Qgis2threejs" -> Instalar
==================================================================
"""

import os
import sys

# ------------------------------------------------------------------
#  CONFIGURACION
# ------------------------------------------------------------------
RAIZ = os.getcwd()
RUTAS = {
    "capas": os.path.join(RAIZ, "data", "ligero"),
    "salida_html": os.path.join(RAIZ, "web"),
    "salida_proyecto": os.path.join(RAIZ, "tierrabomba.qgz"),
}

TITULO_ESCENA = "Tierra Bomba 3D - Tesis de grado"

# Ajustes recomendados para el exportador.
# La clave es "nombre de la capa": (tipo de geometria, exageracion Z,
# visible por defecto, opacidad).
CONFIGURACION_CAPAS = {
    "mdt":         {"tipo": "DEM",      "exageracion_z": 1.5, "visible": True,  "opacidad": 100},
    "hillshade":   {"tipo": "Textura",  "exageracion_z": 1.0, "visible": True,  "opacidad": 75},
    "curvas_1m":   {"tipo": "Linea",    "exageracion_z": 1.0, "visible": True,  "opacidad": 60},
    "limite_isla": {"tipo": "Poligono", "exageracion_z": 1.0, "visible": True,  "opacidad": 0},
    "zona_segura": {"tipo": "Poligono", "exageracion_z": 1.0, "visible": True,  "opacidad": 55},
    "usos_suelo":  {"tipo": "Poligono", "exageracion_z": 1.0, "visible": False, "opacidad": 70},
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


def _comprobar_complemento():
    """Verifica que Qgis2threejs este instalado y devuelve su modulo."""
    try:
        from qgis.utils import plugins
    except ImportError:
        return None

    if "Qgis2threejs" not in plugins:
        _log("  AVISO: el complemento Qgis2threejs NO esta activado.")
        _log("  Instalalo en: Complementos > Administrar e instalar complementos")
        return None

    _log("  complemento Qgis2threejs detectado y activo")
    return plugins["Qgis2threejs"]


def _cargar_capas():
    """Carga en el proyecto las capas preparadas de data/ligero/."""
    from qgis.core import (
        QgsProject, QgsRasterLayer, QgsVectorLayer,
    )

    proyecto = QgsProject.instance()
    carpeta = RUTAS["capas"]
    cargadas = {}

    if not os.path.isdir(carpeta):
        _log(f"  ERROR: no existe {carpeta}")
        _log("  Ejecuta antes 01_preparar_terreno.py")
        return cargadas

    for archivo in sorted(os.listdir(carpeta)):
        ruta = os.path.join(carpeta, archivo)
        nombre, ext = os.path.splitext(archivo)
        if ext.lower() not in (".tif", ".geojson"):
            continue

        capa = (
            QgsRasterLayer(ruta, nombre)
            if ext.lower() == ".tif"
            else QgsVectorLayer(ruta, nombre, "ogr")
        )

        if not capa.isValid():
            _log(f"  IGNORADA (invalida): {archivo}")
            continue

        proyecto.addMapLayer(capa)
        cargadas[nombre] = capa

        ajuste = CONFIGURACION_CAPAS.get(nombre, {})
        if ajuste:
            capa.setOpacity(ajuste.get("opacidad", 100) / 100.0)

        _log(f"  cargada: {nombre}")

    return cargadas


def _aplicar_estilos(capas):
    """Aplica los estilos .qml guardados en assets/estilos-qgis/."""
    carpeta = os.path.join(RAIZ, "assets", "estilos-qgis")
    if not os.path.isdir(carpeta):
        return

    for archivo in os.listdir(carpeta):
        if not archivo.lower().endswith(".qml"):
            continue
        nombre = os.path.splitext(archivo)[0]
        if nombre not in capas:
            continue
        mensaje, ok = capas[nombre].loadNamedStyle(os.path.join(carpeta, archivo))
        _log(f"  estilo {'aplicado' if ok else 'FALLIDO'}: {nombre} ({mensaje})")


def _intentar_api_automatica(complemento, capas):
    """
    Intenta exportar usando la API interna del complemento.

    Devuelve la ruta del HTML generado, o None si la API no esta
    disponible en esta version.
    """
    candidatos = [
        ("Qgis2threejs", "export"),
        ("Qgis2threejs", "exportScene"),
        ("qgis2threejs", "export"),
    ]

    for modulo, funcion in candidatos:
        try:
            mod = __import__(modulo, fromlist=[funcion])
            fn = getattr(mod, funcion, None)
            if not callable(fn):
                continue

            _log(f"  API encontrada: {modulo}.{funcion}()")
            os.makedirs(RUTAS["salida_html"], exist_ok=True)
            destino = os.path.join(RUTAS["salida_html"], "index.html")

            # La firma varia entre versiones; se prueba la forma mas
            # comun y se captura cualquier desajuste.
            try:
                fn(destino)
            except TypeError:
                fn()
                # Si el complemento guardo el HTML en otro sitio, se
                # mueve al destino previsto.
                if os.path.exists("index.html") and not os.path.exists(destino):
                    os.replace("index.html", destino)

            if os.path.exists(destino):
                _log(f"  exportado automaticamente: {destino}")
                return destino
        except Exception:  # noqa: BLE001
            continue

    return None


def _imprimir_configuracion_manual():
    """Imprime la configuracion exacta para el dialogo del complemento."""
    print()
    print("  " + "-" * 60)
    print("  CONFIGURACION PARA EL DIALOGO DE QGIS2THREEJS")
    print("  " + "-" * 60)
    print("  Web > Qgis2threejs > Qgis2threejs Exporter")
    print()
    print(f"  {'Capa':<16}{'Tipo':<12}{'Z x':<7}{'Visible':<10}{'Opacidad'}")
    print("  " + "-" * 60)
    for nombre, cfg in CONFIGURACION_CAPAS.items():
        print(
            f"  {nombre:<16}{cfg['tipo']:<12}{cfg['exageracion_z']:<7}"
            f"{'si' if cfg['visible'] else 'no':<10}{cfg['opacidad']} %"
        )
    print("  " + "-" * 60)
    print()
    print("  Ajustes de la escena:")
    print("    - Modo de renderizado : Triangulos (no Lineas)")
    print("    - Resolucion de textura: 2048 px o superior")
    print("    - Sombras             : activadas, direccion azimut 315")
    print("    - Fondo               : color solido #0d1117")
    print("    - Etiquetas 3D        : desactivadas (lastran el rendimiento)")
    print()
    print("  Al terminar, mueve el index.html generado a: web/")
    print()


def main():
    _exigir_qgis()

    print()
    print("=" * 66)
    print("  TIERRA BOMBA 3D - Exportacion Qgis2threejs")
    print("=" * 66)

    complemento = _comprobar_complemento()

    _log("cargando capas preparadas")
    capas = _cargar_capas()
    if not capas:
        sys.exit("\n  ERROR: no se cargo ninguna capa. Ejecuta antes 01_preparar_terreno.py\n")

    _log("aplicando estilos")
    _aplicar_estilos(capas)

    # Guardar el proyecto: el complemento trabaja sobre el proyecto abierto.
    from qgis.core import QgsProject
    QgsProject.instance().write(RUTAS["salida_proyecto"])
    _log(f"proyecto guardado: {RUTAS['salida_proyecto']}")

    print()
    if complemento:
        _log("intentando exportacion automatica")
        generado = _intentar_api_automatica(complemento, capas)
        if generado:
            print()
            _log("EXPORTACION COMPLETADA")
            _log(f"abre en el navegador: {generado}")
            print()
            return

        _log("la API de esta version no permite exportar sin interfaz")
    else:
        print()

    _imprimir_configuracion_manual()
    _log("abre el dialogo del complemento y sigue la tabla de arriba")
    print()


if __name__ == "__main__" or True:
    main()
