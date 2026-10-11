#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
generar_texturas.py
==================================================================
Genera las texturas procedurales de la plataforma.

POR QUE PROCEDURALES Y NO FOTOGRAFIAS
  1. Licencia: no hay que pedir permiso a nadie ni citar autor.
  2. Peso: cada textura pesa unos pocos KB, frente a cientos de KB de
     una fotografia.
  3. Repetibilidad: el mismo script produce siempre el mismo resultado,
     asi que el aspecto del visor es reproducible y versionable.

TODAS LAS TEXTURAS SON SIN COSTURA (tileables)
   Se construyen con funciones trigonometricas de frecuencia entera
   sobre la anchura de la imagen. Al repetirse, el patron encaja
   exactamente en los bordes y no aparecen lineas visibles en el mapa.

SALIDA
   public/texturas/*.png   (128 x 128 px)
     teja.png         Teja de barro: cubiertas del caserio
     muro.png         Muro encalado: paramentos
     vegetacion.png   Matorral y arbolado
     arena.png        Playas
     agua.png         Cuerpo de agua
     adoquin.png      Superficie vial pavimentada
     tierra.png       Suelo desnudo y caminos

USO
   python scripts/datos/generar_texturas.py
   (requiere Pillow; ya disponible en el entorno del proyecto)
==================================================================
"""

import math
import os
import random
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit(
        "\n  ERROR: falta Pillow.\n"
        "  Instalalo con:  pip install Pillow\n"
    )

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SALIDA = os.path.join(RAIZ, "public", "texturas")

LADO = 128
SEMILLA = 20261011  # fija: el resultado es reproducible


# ------------------------------------------------------------------
#  Utilidades de ruido periodico (sin costura)
# ------------------------------------------------------------------
def ruido_periodico(x, y, lado, componentes, semilla):
    """
    Suma de armonicas de frecuencia entera.

    Al usar frecuencias enteras sobre el lado de la imagen, la funcion
    vale lo mismo en x=0 y x=lado: el mosaico encaja sin costura.
    """
    rnd = random.Random(semilla)
    valor = 0.0
    amplitud_total = 0.0

    for (kx, ky, amplitud) in componentes:
        fase = rnd.uniform(0, 2 * math.pi)
        valor += amplitud * math.sin(2 * math.pi * kx * x / lado + fase) * math.cos(
            2 * math.pi * ky * y / lado + fase * 0.7
        )
        amplitud_total += abs(amplitud)

    return valor / amplitud_total if amplitud_total else 0.0


def mezclar(c1, c2, t):
    """Interpola entre dos colores RGB."""
    t = max(0.0, min(1.0, t))
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3))


def aplicar_grano(imagen, intensidad, semilla):
    """Anade grano fino, tambien periodico, para que no se note el mosaico."""
    rnd = random.Random(semilla)
    pixeles = imagen.load()
    for y in range(LADO):
        for x in range(LADO):
            r, g, b = pixeles[x, y][:3]
            d = rnd.randint(-intensidad, intensidad)
            pixeles[x, y] = (
                max(0, min(255, r + d)),
                max(0, min(255, g + d)),
                max(0, min(255, b + d)),
            )
    return imagen


# ------------------------------------------------------------------
#  Texturas
# ------------------------------------------------------------------
def textura_acero():
    """
    Lamina de acero corrugado (zinc): la cubierta real de Tierra Bomba.

    El caserio de la isla no usa teja de barro sino lamina de zinc
    corrugada. El canalon es sinusoidal y mucho mas estrecho que el de
    una teja: aqui, 16 canales por lado.

    Se anaden manchas de oxidacion calida —habituales en el Caribe por
    la salinidad— para que no quede un gris plano y artificial.
    """
    img = Image.new("RGB", (LADO, LADO), (150, 154, 156))
    pixeles = img.load()

    canales = 16
    ancho_canal = LADO / canales

    for y in range(LADO):
        for x in range(LADO):
            # Perfil sinusoidal del canal
            fase = (x % ancho_canal) / ancho_canal
            perfil = math.sin(2 * math.pi * fase)

            # Cresta iluminada, valle en sombra
            t = 0.5 + 0.5 * perfil
            base = mezclar((104, 110, 114), (186, 190, 192), t)

            # Junta entre laminas cada 8 canales: linea mas oscura
            if int(x / ancho_canal) % 8 == 0 and fase < 0.06:
                base = mezclar(base, (72, 76, 80), 0.55)

            # Oxidacion: manchas calidas de baja frecuencia
            oxido = ruido_periodico(
                x, y, LADO, [(2, 3, 0.6), (5, 4, 0.3)], SEMILLA + 71
            )
            if oxido > 0.25:
                fuerza = min(1.0, (oxido - 0.25) / 0.5) * 0.5
                base = mezclar(base, (150, 96, 62), fuerza)

            # Suciedad y variacion por lamina
            variacion = ruido_periodico(
                x, y, LADO, [(7, 3, 0.4), (13, 9, 0.2)], SEMILLA + 73
            )
            pixeles[x, y] = mezclar(base, (128, 132, 134), abs(variacion) * 0.25)

    return aplicar_grano(img, 5, SEMILLA + 7)


def textura_teja():
    """Teja de barro: filas de canalones con sombra entre ellas."""
    img = Image.new("RGB", (LADO, LADO), (150, 82, 58))
    pixeles = img.load()

    filas = 8           # filas de tejas
    alto_fila = LADO / filas
    ancho_teja = LADO / 16  # 16 tejas por fila

    for y in range(LADO):
        for x in range(LADO):
            # Posicion dentro de la fila y desplazamiento alterno
            fila = int(y / alto_fila)
            desplazamiento = (fila % 2) * (ancho_teja / 2)
            fx = ((x + desplazamiento) % ancho_teja) / ancho_teja
            fy = (y % alto_fila) / alto_fila

            # Perfil curvo de la teja: claro en el centro, oscuro al borde
            perfil = math.sin(math.pi * fx)
            # Sombra en la parte baja de cada fila (solape)
            sombra = 1.0 - 0.35 * max(0.0, fy - 0.6) / 0.4

            t = perfil * sombra
            base = mezclar((104, 54, 38), (186, 108, 74), t)

            # Variacion por teja, determinista
            variacion = ruido_periodico(
                x, y, LADO, [(3, 5, 0.6), (7, 2, 0.3)], SEMILLA + fila
            )
            pixeles[x, y] = mezclar(base, (120, 62, 44), abs(variacion) * 0.35)

    return aplicar_grano(img, 6, SEMILLA)


def textura_muro():
    """Muro encalado: blanco calido con manchas suaves."""
    img = Image.new("RGB", (LADO, LADO), (238, 232, 220))
    pixeles = img.load()

    for y in range(LADO):
        for x in range(LADO):
            n = ruido_periodico(
                x, y, LADO,
                [(2, 3, 0.5), (5, 4, 0.3), (9, 11, 0.15)],
                SEMILLA + 11,
            )
            pixeles[x, y] = mezclar((228, 220, 204), (250, 247, 240), (n + 1) / 2)

    return aplicar_grano(img, 4, SEMILLA + 1)


def textura_vegetacion():
    """Matorral: verde con matas mas oscuras y claros."""
    img = Image.new("RGB", (LADO, LADO), (98, 118, 82))
    pixeles = img.load()

    for y in range(LADO):
        for x in range(LADO):
            n = ruido_periodico(
                x, y, LADO,
                [(3, 2, 0.5), (6, 7, 0.3), (13, 9, 0.2), (19, 17, 0.1)],
                SEMILLA + 23,
            )
            t = (n + 1) / 2
            pixeles[x, y] = mezclar((74, 96, 62), (132, 150, 104), t)

    return aplicar_grano(img, 10, SEMILLA + 2)


def textura_arena():
    """Arena de playa: beige calido con grano fino."""
    img = Image.new("RGB", (LADO, LADO), (222, 205, 172))
    pixeles = img.load()

    for y in range(LADO):
        for x in range(LADO):
            n = ruido_periodico(
                x, y, LADO, [(4, 3, 0.4), (11, 8, 0.25)], SEMILLA + 37
            )
            pixeles[x, y] = mezclar((212, 193, 158), (238, 226, 200), (n + 1) / 2)

    return aplicar_grano(img, 14, SEMILLA + 3)


def textura_agua():
    """Agua: turquesa profundo con ondulacion suave."""
    img = Image.new("RGB", (LADO, LADO), (32, 92, 112))
    pixeles = img.load()

    for y in range(LADO):
        for x in range(LADO):
            # Ondas cruzadas: frecuencia entera, sin costura
            onda = (
                math.sin(2 * math.pi * 2 * x / LADO) * 0.5
                + math.sin(2 * math.pi * 3 * y / LADO) * 0.5
            )
            brillo = 0.5 + 0.25 * onda
            pixeles[x, y] = mezclar((22, 74, 96), (72, 148, 158), brillo)

    return aplicar_grano(img, 5, SEMILLA + 4)


def textura_adoquin():
    """Superficie vial: losas grises con junta."""
    img = Image.new("RGB", (LADO, LADO), (128, 126, 122))
    dibujo = ImageDraw.Draw(img)

    lado_losa = LADO // 4
    for fila in range(4):
        for col in range(4):
            x0 = col * lado_losa
            y0 = fila * lado_losa
            tono = 118 + ((fila * 4 + col) * 7) % 22
            dibujo.rectangle(
                [x0 + 1, y0 + 1, x0 + lado_losa - 2, y0 + lado_losa - 2],
                fill=(tono, tono - 2, tono - 6),
            )

    return aplicar_grano(img, 8, SEMILLA + 5)


def textura_tierra():
    """Suelo desnudo y caminos de tierra."""
    img = Image.new("RGB", (LADO, LADO), (156, 132, 102))
    pixeles = img.load()

    for y in range(LADO):
        for x in range(LADO):
            n = ruido_periodico(
                x, y, LADO, [(2, 2, 0.5), (7, 6, 0.3), (15, 13, 0.2)], SEMILLA + 53
            )
            pixeles[x, y] = mezclar((138, 114, 86), (178, 156, 124), (n + 1) / 2)

    return aplicar_grano(img, 12, SEMILLA + 6)


TEXTURAS = {
    # Cubierta real de Tierra Bomba y de los barrios populares de Cartagena
    "acero": textura_acero,
    # Teja de barro: centro historico y sectores consolidados
    "teja": textura_teja,
    "muro": textura_muro,
    "vegetacion": textura_vegetacion,
    "arena": textura_arena,
    "agua": textura_agua,
    "adoquin": textura_adoquin,
    "tierra": textura_tierra,
}


def main():
    os.makedirs(SALIDA, exist_ok=True)

    print("\n  Generacion de texturas procedurales")
    print("  " + "=" * 58)
    print(f"  Tamano: {LADO} x {LADO} px   Semilla: {SEMILLA}")
    print(f"  Destino: {SALIDA}\n")

    total = 0
    for nombre, funcion in TEXTURAS.items():
        imagen = funcion()
        destino = os.path.join(SALIDA, f"{nombre}.png")
        # optimize=True reduce el peso sin perdida apreciable
        imagen.save(destino, "PNG", optimize=True)
        kb = os.path.getsize(destino) / 1024
        total += kb
        print(f"  {nombre + '.png':<18} {kb:6.1f} KB")

    print("  " + "-" * 58)
    print(f"  Total: {total:.1f} KB en {len(TEXTURAS)} texturas")
    print("\n  Todas son sin costura y de licencia libre: generadas aqui.\n")


if __name__ == "__main__":
    main()
