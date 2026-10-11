'use client';

/**
 * Tipología de vivienda del caserío de Tierra Bomba.
 * ==================================================================
 * Vivienda paramétrica con TEJADO A DOS AGUAS, ventanas, puerta y color
 * configurables, construida con geometría procedural en three.js.
 *
 * POR QUÉ GEOMETRÍA PROCEDURAL Y NO UN MODELO IMPORTADO
 *   MapLibre solo genera prismas de tapa plana: no puede representar un
 *   tejado a dos aguas. Aquí la casa se construye vértice a vértice, así
 *   que la pendiente, el alero, los huecos y los materiales son reales y
 *   editables.
 *
 * BASE TIPOLÓGICA (dato del catastro oficial)
 *   Las 2.714 construcciones de la isla tienen altura registrada de
 *   3,00 m y una sola planta (mediana de pisos = 1). La autora confirma
 *   que todas son a dos aguas. Por eso los valores iniciales son:
 *   3,00 m de muro, una planta y cubierta de lámina de acero corrugado.
 *
 *   Las dimensiones en planta son ajustables porque el catastro no
 *   registra el ancho y el fondo de cada construcción: el área media
 *   construida es de 72,5 m².
 * ==================================================================
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Boxes, DoorOpen, Grid3x3, Home, Paintbrush, RotateCcw } from 'lucide-react';
import { numero } from '@/lib/utils';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Valores iniciales derivados del catastro oficial. */
const INICIAL = {
  ancho: 7.2,
  largo: 9.0,
  altoMuro: 3.0,
  alturaCumbrera: 1.6,
  colorMuro: '#efe7d7',
  colorTecho: '#b9bec2',
  ventanasFrente: 2,
  ventanasLateral: 1,
  puerta: true,
  voladizo: 0.5,
  conTexturas: true,
};

type Config = typeof INICIAL;

export function TipologiaVivienda() {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const escenaRef = useRef<THREE.Scene | null>(null);
  const casaRef = useRef<THREE.Group | null>(null);
  const texturasRef = useRef<{ muro?: THREE.Texture; acero?: THREE.Texture }>({});

  const [config, setConfig] = useState<Config>(INICIAL);
  const [cargando, setCargando] = useState(true);

  // ------------------------------------------------------------------
  //  Escena (una sola vez)
  // ------------------------------------------------------------------
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || escenaRef.current) return;

    let renderizador: THREE.WebGLRenderer;
    try {
      renderizador = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setCargando(false);
      return;
    }

    renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderizador.setSize(contenedor.clientWidth, contenedor.clientHeight);
    renderizador.outputColorSpace = THREE.SRGBColorSpace;
    renderizador.toneMapping = THREE.ACESFilmicToneMapping;
    renderizador.toneMappingExposure = 1.08;
    renderizador.shadowMap.enabled = true;
    renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    contenedor.appendChild(renderizador.domElement);

    const escena = new THREE.Scene();
    escena.background = new THREE.Color('#0d1a22');
    escenaRef.current = escena;

    const camara = new THREE.PerspectiveCamera(
      42,
      contenedor.clientWidth / contenedor.clientHeight,
      0.1,
      800
    );
    camara.position.set(15, 11, 17);

    const controles = new OrbitControls(camara, renderizador.domElement);
    controles.enableDamping = true;
    controles.dampingFactor = 0.08;
    controles.target.set(0, 1.6, 0);
    // Vista isométrica: es como se lee una axonomía
    controles.minPolarAngle = 0.15;
    controles.maxPolarAngle = Math.PI / 2.02;

    const sol = new THREE.DirectionalLight(0xfff4e2, 2.8);
    sol.position.set(14, 22, 11);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    sol.shadow.camera.left = -22;
    sol.shadow.camera.right = 22;
    sol.shadow.camera.top = 22;
    sol.shadow.camera.bottom = -22;
    sol.shadow.bias = -0.0006;
    escena.add(sol);
    escena.add(new THREE.HemisphereLight(0xcfe8ff, 0x6b5a45, 1.1));
    escena.add(new THREE.AmbientLight(0xffffff, 0.3));

    // Suelo de arena, para situar la casa
    const suelo = new THREE.Mesh(
      new THREE.CircleGeometry(42, 48),
      new THREE.MeshStandardMaterial({ color: '#d9c6a3', roughness: 1 })
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    escena.add(suelo);

    // --- Texturas procedurales del proyecto ---
    const cargador = new THREE.TextureLoader();
    const ajustar = (t: THREE.Texture, rx: number, ry: number) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };

    let pendientes = 2;
    const listo = () => {
      pendientes--;
      if (pendientes <= 0) setCargando(false);
    };

    cargador.load(
      `${BASE}/texturas/muro.png`,
      (t) => {
        texturasRef.current.muro = ajustar(t, 2, 1);
        listo();
      },
      undefined,
      listo
    );
    cargador.load(
      `${BASE}/texturas/acero.png`,
      (t) => {
        texturasRef.current.acero = ajustar(t, 3, 2);
        listo();
      },
      undefined,
      listo
    );

    const animar = () => {
      requestAnimationFrame(animar);
      controles.update();
      renderizador.render(escena, camara);
    };
    animar();

    const alRedimensionar = () => {
      if (!contenedor.clientWidth) return;
      camara.aspect = contenedor.clientWidth / contenedor.clientHeight;
      camara.updateProjectionMatrix();
      renderizador.setSize(contenedor.clientWidth, contenedor.clientHeight);
    };
    const observador = new ResizeObserver(alRedimensionar);
    observador.observe(contenedor);

    return () => {
      observador.disconnect();
      controles.dispose();
      renderizador.dispose();
      renderizador.domElement.remove();
      escenaRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------------
  //  Reconstrucción de la casa al cambiar la configuración
  // ------------------------------------------------------------------
  useEffect(() => {
    const escena = escenaRef.current;
    if (!escena) return;

    // Se retira la casa anterior antes de levantar la nueva
    if (casaRef.current) {
      escena.remove(casaRef.current);
      casaRef.current.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        }
      });
    }

    const { ancho, largo, altoMuro, alturaCumbrera, voladizo } = config;
    const casa = new THREE.Group();

    // --- Materiales -------------------------------------------------
    const matMuro = new THREE.MeshStandardMaterial({
      color: config.colorMuro,
      roughness: 0.94,
      metalness: 0,
      ...(config.conTexturas && texturasRef.current.muro
        ? { map: texturasRef.current.muro }
        : {}),
    });

    // El caserío usa lámina de acero corrugado, no teja de barro
    const matTecho = new THREE.MeshStandardMaterial({
      color: config.colorTecho,
      roughness: 0.55,
      metalness: 0.45,
      side: THREE.DoubleSide,
      ...(config.conTexturas && texturasRef.current.acero
        ? { map: texturasRef.current.acero }
        : {}),
    });

    const matHueco = new THREE.MeshStandardMaterial({
      color: '#14262f',
      roughness: 0.35,
      metalness: 0.1,
    });

    const matMarco = new THREE.MeshStandardMaterial({ color: '#f6f4ef', roughness: 0.8 });
    const matPuerta = new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.85 });

    // --- Muros: cuatro paramentos, no una caja maciza ----------------
    // Así el hueco es real y se ve el interior desde un corte.
    const espesor = 0.18;
    const muros = new THREE.Group();

    const pared = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      material: THREE.Material
    ) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      muros.add(m);
      return m;
    };

    // Frente, fondo y laterales
    pared(ancho, altoMuro, espesor, 0, altoMuro / 2, largo / 2, matMuro);
    pared(ancho, altoMuro, espesor, 0, altoMuro / 2, -largo / 2, matMuro);
    pared(espesor, altoMuro, largo, -ancho / 2, altoMuro / 2, 0, matMuro);
    pared(espesor, altoMuro, largo, ancho / 2, altoMuro / 2, 0, matMuro);
    casa.add(muros);

    // --- Cubierta A DOS AGUAS ---------------------------------------
    // Perfil triangular extruido: eso es lo que MapLibre no puede hacer.
    const medioAncho = ancho / 2 + voladizo;
    const perfil = new THREE.Shape();
    perfil.moveTo(-medioAncho, 0);
    perfil.lineTo(medioAncho, 0);
    perfil.lineTo(0, alturaCumbrera);
    perfil.closePath();

    const geoTecho = new THREE.ExtrudeGeometry(perfil, {
      depth: largo + voladizo * 2,
      bevelEnabled: false,
    });
    geoTecho.translate(0, 0, -(largo + voladizo * 2) / 2);

    const techo = new THREE.Mesh(geoTecho, matTecho);
    techo.position.y = altoMuro;
    techo.castShadow = true;
    techo.receiveShadow = true;
    casa.add(techo);

    // Alero: pequeño vuelo que remata el borde
    const alero = new THREE.Mesh(
      new THREE.BoxGeometry(ancho + voladizo * 2, 0.07, largo + voladizo * 2),
      new THREE.MeshStandardMaterial({ color: '#8f9498', roughness: 0.6, metalness: 0.4 })
    );
    alero.position.y = altoMuro - 0.04;
    alero.castShadow = true;
    casa.add(alero);

    // --- Huecos: puerta y ventanas ----------------------------------
    const huecos = new THREE.Group();

    if (config.puerta) {
      const altoPuerta = 2.1;
      const anchoPuerta = 0.95;
      const puerta = new THREE.Mesh(
        new THREE.BoxGeometry(anchoPuerta, altoPuerta, 0.06),
        matPuerta
      );
      puerta.position.set(-ancho / 4, altoPuerta / 2, largo / 2 + espesor / 2 + 0.02);
      huecos.add(puerta);

      // Dintel y jambas: el marco da escala y realismo
      const marco = new THREE.Mesh(
        new THREE.BoxGeometry(anchoPuerta + 0.16, 0.1, 0.1),
        matMarco
      );
      marco.position.set(-ancho / 4, altoPuerta + 0.05, largo / 2 + espesor / 2 + 0.02);
      huecos.add(marco);
    }

    const crearVentana = (x: number, y: number, z: number, girar = false) => {
      const w = 1.1;
      const h = 1.15;
      const v = new THREE.Mesh(
        new THREE.BoxGeometry(girar ? 0.06 : w, h, girar ? w : 0.06),
        matHueco
      );
      v.position.set(x, y, z);
      huecos.add(v);

      // Marco claro alrededor del vano
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(girar ? 0.08 : w + 0.14, h + 0.14, girar ? w + 0.14 : 0.08),
        matMarco
      );
      m.position.set(x, y, z);
      huecos.add(m);
    };

    const yVentana = altoMuro * 0.58;

    // Reparto regular en el frente, a partir del número pedido
    const nFrente = config.ventanasFrente;
    for (let i = 0; i < nFrente; i++) {
      const paso = ancho / (nFrente + 1);
      const x = -ancho / 2 + paso * (i + 1);
      crearVentana(x, yVentana, largo / 2 + espesor / 2 + 0.01);
    }

    // Ventanas en los laterales
    const nLateral = config.ventanasLateral;
    for (let i = 0; i < nLateral; i++) {
      const paso = largo / (nLateral + 1);
      const z = -largo / 2 + paso * (i + 1);
      crearVentana(ancho / 2 + espesor / 2 + 0.01, yVentana, z, true);
      crearVentana(-ancho / 2 - espesor / 2 - 0.01, yVentana, z, true);
    }

    casa.add(huecos);
    escena.add(casa);
    casaRef.current = casa;
  }, [config]);

  // ------------------------------------------------------------------
  //  Métricas derivadas
  // ------------------------------------------------------------------
  const metricas = useMemo(() => {
    const { ancho, largo, altoMuro, alturaCumbrera } = config;
    const huella = ancho * largo;
    // Volumen: prisma de los muros + prisma triangular de la cubierta
    const volumenMuros = huella * altoMuro;
    const volumenCubierta = (huella * alturaCumbrera) / 2;
    return {
      huella,
      volumen: volumenMuros + volumenCubierta,
      pendiente: (Math.atan2(alturaCumbrera, ancho / 2) * 180) / Math.PI,
      cumbrera: altoMuro + alturaCumbrera,
    };
  }, [config]);

  const actualizar = <K extends keyof Config>(clave: K, valor: Config[K]) =>
    setConfig((c) => ({ ...c, [clave]: valor }));

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
      {/* Lienzo */}
      <section className="relative overflow-hidden rounded-xl border border-hueso-100/10">
        <div
          ref={contenedorRef}
          className="h-[30rem] w-full"
          role="img"
          aria-label="Vivienda tipológica con tejado a dos aguas"
        />
        {cargando && (
          <div className="absolute inset-0 grid place-items-center bg-oceano-950/80">
            <p className="text-sm text-hueso-200">Construyendo la vivienda…</p>
          </div>
        )}

        <div className="panel absolute bottom-3 left-3 flex flex-wrap gap-x-4 gap-y-1 px-3 py-2">
          <Metrica etiqueta="Huella" valor={`${numero(metricas.huella, 1)} m²`} />
          <Metrica etiqueta="Volumen" valor={`${numero(metricas.volumen, 1)} m³`} />
          <Metrica etiqueta="Pendiente" valor={`${numero(metricas.pendiente, 1)}°`} />
          <Metrica etiqueta="Cumbrera" valor={`${numero(metricas.cumbrera, 2)} m`} />
        </div>
      </section>

      {/* Panel de configuración */}
      <div className="flex max-h-[30rem] flex-col gap-3 overflow-y-auto">
        {/* Dimensiones */}
        <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Boxes className="size-4 text-turquesa-500" aria-hidden />
            <h3 className="text-[0.8125rem] font-semibold text-hueso-100">Dimensiones</h3>
          </div>
          <div className="space-y-3">
            <Deslizador
              etiqueta="Ancho"
              valor={config.ancho}
              min={3}
              max={14}
              paso={0.1}
              unidad="m"
              alCambiar={(v) => actualizar('ancho', v)}
            />
            <Deslizador
              etiqueta="Fondo"
              valor={config.largo}
              min={3}
              max={18}
              paso={0.1}
              unidad="m"
              alCambiar={(v) => actualizar('largo', v)}
            />
            <Deslizador
              etiqueta="Alto de muro"
              valor={config.altoMuro}
              min={2.2}
              max={4.5}
              paso={0.05}
              unidad="m"
              alCambiar={(v) => actualizar('altoMuro', v)}
            />
            <Deslizador
              etiqueta="Altura de cumbrera"
              valor={config.alturaCumbrera}
              min={0.4}
              max={3.5}
              paso={0.05}
              unidad="m"
              alCambiar={(v) => actualizar('alturaCumbrera', v)}
            />
            <Deslizador
              etiqueta="Voladizo del alero"
              valor={config.voladizo}
              min={0}
              max={1.2}
              paso={0.05}
              unidad="m"
              alCambiar={(v) => actualizar('voladizo', v)}
            />
          </div>
        </section>

        {/* Huecos */}
        <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <DoorOpen className="size-4 text-turquesa-500" aria-hidden />
            <h3 className="text-[0.8125rem] font-semibold text-hueso-100">Ventanas y puerta</h3>
          </div>

          <div className="space-y-3">
            <Deslizador
              etiqueta="Ventanas al frente"
              valor={config.ventanasFrente}
              min={0}
              max={5}
              paso={1}
              alCambiar={(v) => actualizar('ventanasFrente', Math.round(v))}
            />
            <Deslizador
              etiqueta="Ventanas por lateral"
              valor={config.ventanasLateral}
              min={0}
              max={4}
              paso={1}
              alCambiar={(v) => actualizar('ventanasLateral', Math.round(v))}
            />
            <label className="flex cursor-pointer items-center gap-2 text-[0.75rem] text-hueso-200">
              <input
                type="checkbox"
                checked={config.puerta}
                onChange={(e) => actualizar('puerta', e.target.checked)}
                className="accent-turquesa-500"
              />
              Puerta en el frente
            </label>
          </div>
        </section>

        {/* Materiales */}
        <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Paintbrush className="size-4 text-turquesa-500" aria-hidden />
            <h3 className="text-[0.8125rem] font-semibold text-hueso-100">Color y textura</h3>
          </div>

          <div className="space-y-3">
            <ColorFila
              etiqueta="Muro"
              valor={config.colorMuro}
              alCambiar={(v) => actualizar('colorMuro', v)}
              paleta={['#efe7d7', '#f6f4ef', '#d9c6a3', '#39b8b0', '#527f68', '#8a5a3c', '#c96f4a']}
            />
            <ColorFila
              etiqueta="Cubierta"
              valor={config.colorTecho}
              alCambiar={(v) => actualizar('colorTecho', v)}
              paleta={['#b9bec2', '#8f9498', '#6b7a83', '#a8743f', '#c96f4a', '#3d6350']}
            />
            <label className="flex cursor-pointer items-center gap-2 text-[0.75rem] text-hueso-200">
              <input
                type="checkbox"
                checked={config.conTexturas}
                onChange={(e) => actualizar('conTexturas', e.target.checked)}
                className="accent-turquesa-500"
              />
              Aplicar texturas procedurales
            </label>
          </div>
        </section>

        <button
          type="button"
          onClick={() => setConfig(INICIAL)}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-hueso-100/15 px-3 py-2 text-[0.75rem] text-hueso-200 transition hover:bg-hueso-100/10"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Volver a la tipología del catastro
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
//  Controles
// ------------------------------------------------------------------

function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso,
  unidad,
  alCambiar,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  unidad?: string;
  alCambiar: (v: number) => void;
}) {
  const id = `tip-${etiqueta.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[0.75rem] text-hueso-200">
          {etiqueta}
        </label>
        <span className="dato-mono text-turquesa-300">
          {numero(valor, paso < 1 ? 2 : 0)}
          {unidad ? ` ${unidad}` : ''}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(e) => alCambiar(Number(e.target.value))}
        className="w-full accent-turquesa-500"
      />
    </div>
  );
}

function ColorFila({
  etiqueta,
  valor,
  alCambiar,
  paleta,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  paleta: string[];
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[0.75rem] text-hueso-200">{etiqueta}</span>
        <span className="dato-mono text-grafito-500">{valor}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {paleta.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => alCambiar(c)}
            aria-label={`${etiqueta} color ${c}`}
            aria-pressed={valor.toLowerCase() === c.toLowerCase()}
            className="size-6 rounded-md ring-1 ring-inset ring-white/25 transition hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-turquesa-400"
            style={{ backgroundColor: c }}
          />
        ))}
        <input
          type="color"
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          aria-label={`${etiqueta}: color personalizado`}
          className="size-6 cursor-pointer rounded-md border-0 bg-transparent p-0"
        />
      </div>
    </div>
  );
}

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="dato-mono text-grafito-500">{etiqueta}</span>
      <span className="dato-mono text-hueso-100">{valor}</span>
    </div>
  );
}
