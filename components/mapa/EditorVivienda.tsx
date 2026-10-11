'use client';

/**
 * Editor de vivienda individual.
 * ==================================================================
 * Se abre al seleccionar una construcción en el mapa y permite
 * asignarle color de muro y cubierta, ventanas y puerta. El resultado
 * se refleja en el visor territorial y se guarda por código catastral.
 *
 * GEOMETRÍA PROCEDURAL, NO UN MODELO IMPORTADO
 *   MapLibre no puede representar tejados inclinados: solo genera
 *   prismas de tapa plana. Aquí la vivienda se levanta vértice a
 *   vértice con three.js, con su cubierta A DOS AGUAS —que es la
 *   tipología de todo el caserío de Tierra Bomba— y su alero volado.
 *
 * DIMENSIONES DE PARTIDA
 *   El catastro registra la altura (3,00 m de media) y el área
 *   construida, pero NO el ancho ni el fondo de cada inmueble. Se
 *   estiman repartiendo el área con una proporción 1:1,25, y quedan
 *   ajustables: la estimación se declara en la interfaz.
 * ==================================================================
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Check, DoorOpen, Eraser, Home, Paintbrush, Ruler, X } from 'lucide-react';
import {
  EDICION_INICIAL,
  type EdicionVivienda,
} from '@/lib/viviendas';
import { numero } from '@/lib/utils';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

interface Props {
  codigo: string;
  /** Altura registrada por el catastro, en metros. */
  alturaOficial: number | null;
  /** Área de la huella medida sobre la geometría, en m². */
  areaHuella: number | null;
  /** Edición ya guardada, si existe. */
  edicion: EdicionVivienda | null;
  alGuardar: (e: Omit<EdicionVivienda, 'actualizado'>) => void;
  alBorrar: () => void;
  alCerrar: () => void;
}

/** Reparte un área en planta con proporción 1:1,25. */
function dimensionesDesdeArea(area: number) {
  const proporcion = 1.25;
  const ancho = Math.sqrt(area / proporcion);
  return {
    ancho: Math.max(3, Math.min(16, Math.round(ancho * 10) / 10)),
    largo: Math.max(3, Math.min(20, Math.round(ancho * proporcion * 10) / 10)),
  };
}

export function EditorVivienda({
  codigo,
  alturaOficial,
  areaHuella,
  edicion,
  alGuardar,
  alBorrar,
  alCerrar,
}: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const escenaRef = useRef<THREE.Scene | null>(null);
  const casaRef = useRef<THREE.Group | null>(null);
  const texturasRef = useRef<{ muro?: THREE.Texture; acero?: THREE.Texture }>({});

  // Estado inicial: lo editado, o la tipología derivada del catastro
  const [config, setConfig] = useState(() => {
    if (edicion) return edicion;
    const dims = areaHuella && areaHuella > 10
      ? dimensionesDesdeArea(areaHuella)
      : { ancho: EDICION_INICIAL.ancho, largo: EDICION_INICIAL.largo };
    return {
      ...EDICION_INICIAL,
      ...dims,
      altoMuro: alturaOficial && alturaOficial > 1.5 ? alturaOficial : EDICION_INICIAL.altoMuro,
      codigo,
    };
  });

  const [guardado, setGuardado] = useState(false);

  const areaResultante = useMemo(
    () => config.ancho * config.largo,
    [config.ancho, config.largo]
  );

  // ------------------------------------------------------------------
  //  Escena
  // ------------------------------------------------------------------
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || escenaRef.current) return;

    let renderizador: THREE.WebGLRenderer;
    try {
      renderizador = new THREE.WebGLRenderer({ antialias: true });
    } catch {
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
      40,
      contenedor.clientWidth / contenedor.clientHeight,
      0.1,
      400
    );
    camara.position.set(11, 8.5, 13);

    const controles = new OrbitControls(camara, renderizador.domElement);
    controles.enableDamping = true;
    controles.dampingFactor = 0.08;
    controles.target.set(0, 1.6, 0);
    controles.minPolarAngle = 0.2;
    controles.maxPolarAngle = Math.PI / 2.05;

    const sol = new THREE.DirectionalLight(0xfff4e2, 2.8);
    sol.position.set(12, 20, 10);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    sol.shadow.camera.left = -18;
    sol.shadow.camera.right = 18;
    sol.shadow.camera.top = 18;
    sol.shadow.camera.bottom = -18;
    sol.shadow.bias = -0.0007;
    escena.add(sol);
    escena.add(new THREE.HemisphereLight(0xcfe8ff, 0x6b5a45, 1.1));
    escena.add(new THREE.AmbientLight(0xffffff, 0.3));

    const suelo = new THREE.Mesh(
      new THREE.CircleGeometry(30, 40),
      new THREE.MeshStandardMaterial({ color: '#d9c6a3', roughness: 1 })
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    escena.add(suelo);

    const rejilla = new THREE.GridHelper(30, 30, 0x2d3a42, 0x1b262c);
    rejilla.position.y = 0.005;
    escena.add(rejilla);

    const cargador = new THREE.TextureLoader();
    const ajustar = (t: THREE.Texture, rx: number, ry: number) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    cargador.load(`${BASE}/texturas/muro.png`, (t) => (texturasRef.current.muro = ajustar(t, 2, 1)));
    cargador.load(`${BASE}/texturas/acero.png`, (t) => (texturasRef.current.acero = ajustar(t, 3, 2)));

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
  //  Reconstrucción al cambiar la configuración
  // ------------------------------------------------------------------
  useEffect(() => {
    const escena = escenaRef.current;
    if (!escena) return;

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

    const { ancho, largo, altoMuro } = config;
    const alturaCumbrera = Math.max(0.5, ancho * 0.24);
    const voladizo = 0.5;
    const casa = new THREE.Group();

    const matMuro = new THREE.MeshStandardMaterial({
      color: config.colorMuro,
      roughness: 0.94,
      ...(texturasRef.current.muro ? { map: texturasRef.current.muro } : {}),
    });
    const matTecho = new THREE.MeshStandardMaterial({
      color: config.colorTecho,
      roughness: 0.55,
      metalness: 0.45,
      side: THREE.DoubleSide,
      ...(texturasRef.current.acero ? { map: texturasRef.current.acero } : {}),
    });
    const matHueco = new THREE.MeshStandardMaterial({ color: '#14262f', roughness: 0.35 });
    const matMarco = new THREE.MeshStandardMaterial({ color: '#f6f4ef', roughness: 0.8 });
    const matPuerta = new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.85 });

    const espesor = 0.18;
    const pared = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matMuro);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      casa.add(m);
    };

    pared(ancho, altoMuro, espesor, 0, altoMuro / 2, largo / 2);
    pared(ancho, altoMuro, espesor, 0, altoMuro / 2, -largo / 2);
    pared(espesor, altoMuro, largo, -ancho / 2, altoMuro / 2, 0);
    pared(espesor, altoMuro, largo, ancho / 2, altoMuro / 2, 0);

    // --- Cubierta A DOS AGUAS: lo que MapLibre no puede hacer ---
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

    const alero = new THREE.Mesh(
      new THREE.BoxGeometry(ancho + voladizo * 2, 0.07, largo + voladizo * 2),
      new THREE.MeshStandardMaterial({ color: '#8f9498', roughness: 0.6, metalness: 0.4 })
    );
    alero.position.y = altoMuro - 0.04;
    alero.castShadow = true;
    casa.add(alero);

    // --- Huecos ---
    if (config.puerta) {
      const ap = 2.1;
      const anp = 0.95;
      const p = new THREE.Mesh(new THREE.BoxGeometry(anp, ap, 0.06), matPuerta);
      p.position.set(-ancho / 4, ap / 2, largo / 2 + espesor / 2 + 0.02);
      casa.add(p);
      const marco = new THREE.Mesh(new THREE.BoxGeometry(anp + 0.16, 0.1, 0.1), matMarco);
      marco.position.set(-ancho / 4, ap + 0.05, largo / 2 + espesor / 2 + 0.02);
      casa.add(marco);
    }

    const ventana = (x: number, y: number, z: number, girar = false) => {
      const w = 1.1;
      const h = 1.15;
      const v = new THREE.Mesh(
        new THREE.BoxGeometry(girar ? 0.06 : w, h, girar ? w : 0.06),
        matHueco
      );
      v.position.set(x, y, z);
      casa.add(v);
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(girar ? 0.08 : w + 0.14, h + 0.14, girar ? w + 0.14 : 0.08),
        matMarco
      );
      m.position.set(x, y, z);
      casa.add(m);
    };

    const yV = altoMuro * 0.58;
    const nF = config.ventanasFrente;
    for (let i = 0; i < nF; i++) {
      const paso = ancho / (nF + 1);
      ventana(-ancho / 2 + paso * (i + 1), yV, largo / 2 + espesor / 2 + 0.01);
    }
    const nL = config.ventanasLateral;
    for (let i = 0; i < nL; i++) {
      const paso = largo / (nL + 1);
      const z = -largo / 2 + paso * (i + 1);
      ventana(ancho / 2 + espesor / 2 + 0.01, yV, z, true);
      ventana(-ancho / 2 - espesor / 2 - 0.01, yV, z, true);
    }

    escena.add(casa);
    casaRef.current = casa;
  }, [config]);

  const actualizar = <K extends keyof EdicionVivienda>(clave: K, valor: EdicionVivienda[K]) =>
    setConfig((c) => ({ ...c, [clave]: valor }));

  const guardar = () => {
    alGuardar({
      codigo,
      colorMuro: config.colorMuro,
      colorTecho: config.colorTecho,
      ventanasFrente: config.ventanasFrente,
      ventanasLateral: config.ventanasLateral,
      puerta: config.puerta,
      ancho: config.ancho,
      largo: config.largo,
      altoMuro: config.altoMuro,
    });
    setGuardado(true);
    window.setTimeout(() => setGuardado(false), 1800);
  };

  const alturaEstimada = !edicion && (!alturaOficial || alturaOficial <= 1.5);

  return (
    <section
      className="panel absolute bottom-3 right-3 z-40 flex max-h-[calc(100dvh-7rem)] w-[22rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden"
      aria-label="Editor de vivienda"
    >
      <header className="flex items-start justify-between gap-2 border-b border-hueso-100/10 px-4 py-3">
        <div className="min-w-0">
          <p className="dato-mono text-turquesa-400 uppercase tracking-wider">Editar vivienda</p>
          <p className="dato-mono mt-0.5 truncate text-grafito-500" title={codigo}>
            {codigo.length > 24 ? `${codigo.slice(0, 24)}…` : codigo}
          </p>
        </div>
        <button
          type="button"
          onClick={alCerrar}
          className="shrink-0 rounded-md p-1.5 text-grafito-400 transition hover:bg-hueso-100/10 hover:text-hueso-100"
          aria-label="Cerrar el editor"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Vista 3D */}
        <div ref={contenedorRef} className="h-52 w-full" aria-label="Vista 3D de la vivienda" />

        <div className="space-y-3 px-4 py-3">
          {/* Cubierta a dos aguas: es lo que se está viendo */}
          <p className="flex items-center gap-1.5 text-[0.6875rem] text-grafito-500">
            <Home className="size-3 shrink-0" aria-hidden />
            Cubierta a dos aguas, tipología del caserío. Arrastra para girar la vista.
          </p>

          {/* Dimensiones */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[0.75rem] font-semibold text-hueso-200">
              <Ruler className="size-3.5" aria-hidden />
              Dimensiones
            </p>
            <div className="space-y-2.5">
              <Deslizador
                etiqueta="Ancho"
                valor={config.ancho}
                min={3}
                max={16}
                paso={0.1}
                alCambiar={(v) => actualizar('ancho', v)}
              />
              <Deslizador
                etiqueta="Fondo"
                valor={config.largo}
                min={3}
                max={20}
                paso={0.1}
                alCambiar={(v) => actualizar('largo', v)}
              />
              <Deslizador
                etiqueta="Alto de muro"
                valor={config.altoMuro}
                min={2.2}
                max={4.5}
                paso={0.05}
                alCambiar={(v) => actualizar('altoMuro', v)}
              />
            </div>
            <p className="mt-2 text-[0.625rem] leading-snug text-grafito-500">
              Área en planta: <strong className="text-hueso-200">{numero(areaResultante, 1)} m²</strong>
              {areaHuella ? ` · huella medida: ${numero(areaHuella, 1)} m²` : ''}
              {alturaEstimada && ' · altura estimada, el catastro no la registra para esta vivienda'}
            </p>
          </div>

          {/* Huecos */}
          <div className="border-t border-hueso-100/10 pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-[0.75rem] font-semibold text-hueso-200">
              <DoorOpen className="size-3.5" aria-hidden />
              Ventanas y puerta
            </p>
            <div className="space-y-2.5">
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
          </div>

          {/* Color */}
          <div className="border-t border-hueso-100/10 pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-[0.75rem] font-semibold text-hueso-200">
              <Paintbrush className="size-3.5" aria-hidden />
              Color
            </p>
            <div className="space-y-2.5">
              <Paleta
                etiqueta="Muro"
                valor={config.colorMuro}
                alCambiar={(v) => actualizar('colorMuro', v)}
                colores={['#efe7d7', '#f6f4ef', '#d9c6a3', '#39b8b0', '#527f68', '#c96f4a', '#8a5a3c']}
              />
              <Paleta
                etiqueta="Cubierta"
                valor={config.colorTecho}
                alCambiar={(v) => actualizar('colorTecho', v)}
                colores={['#b9bec2', '#8f9498', '#6b7a83', '#a8743f', '#c96f4a', '#3d6350']}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <footer className="flex items-center gap-2 border-t border-hueso-100/10 px-4 py-2.5">
        <button
          type="button"
          onClick={guardar}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-turquesa-500 px-3 py-2 text-[0.75rem] font-semibold text-oceano-950 transition hover:bg-turquesa-400"
        >
          {guardado ? <Check className="size-3.5" /> : <Check className="size-3.5" />}
          {guardado ? 'Guardado' : 'Guardar en el mapa'}
        </button>
        {edicion && (
          <button
            type="button"
            onClick={() => alBorrar()}
            title="Deshacer la edición de esta vivienda"
            className="rounded-md border border-hueso-100/15 px-3 py-2 text-[0.75rem] text-hueso-200 transition hover:bg-hueso-100/10"
          >
            <Eraser className="size-3.5" aria-hidden />
            <span className="sr-only">Deshacer la edición</span>
          </button>
        )}
      </footer>
    </section>
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
  alCambiar,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  alCambiar: (v: number) => void;
}) {
  const id = `ed-${etiqueta.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[0.6875rem] text-grafito-400">
          {etiqueta}
        </label>
        <span className="dato-mono text-turquesa-300">{numero(valor, paso < 1 ? 2 : 0)}</span>
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

function Paleta({
  etiqueta,
  valor,
  alCambiar,
  colores,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  colores: string[];
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[0.6875rem] text-grafito-400">{etiqueta}</span>
        <span className="dato-mono text-grafito-500">{valor}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {colores.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => alCambiar(c)}
            aria-label={`${etiqueta}: ${c}`}
            aria-pressed={valor.toLowerCase() === c.toLowerCase()}
            className="size-5 rounded ring-1 ring-inset ring-white/25 transition hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-turquesa-400"
            style={{ backgroundColor: c }}
          />
        ))}
        <input
          type="color"
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          aria-label={`${etiqueta}: color personalizado`}
          className="size-5 cursor-pointer rounded border-0 bg-transparent p-0"
        />
      </div>
    </div>
  );
}
