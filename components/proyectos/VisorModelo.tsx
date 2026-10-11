'use client';

/**
 * Visor 3D del modelo arquitectónico (glTF binario).
 * ==================================================================
 * Carga el modelo exportado de Revit y permite explorarlo: órbita,
 * zoom, filtrado por familia de material y despiece vertical.
 *
 * SOBRE EL MODELO
 *   TIERRABOMBA.glb: 40,3 MB, 4.472 mallas, 1.087.522 triángulos y 6
 *   materiales. Viene de una exportación OBJ de Revit (Autodesk ATF)
 *   convertida a glTF con obj2gltf.
 *
 *   IMPORTANTE: el modelo está en COORDENADAS INTERNAS DEL PROYECTO.
 *   No lleva referencia geográfica, así que aquí se muestra aislado y
 *   no superpuesto al territorio. Para situarlo hace falta calibrar un
 *   punto conocido (ver /datos y la documentación de scripts/terria).
 * ==================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Box,
  Eye,
  EyeOff,
  Layers,
  Maximize2,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';

import { cn, numero } from '@/lib/utils';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const RUTA_MODELO = `${BASE}/modelos/TIERRABOMBA.glb`;

interface GrupoMaterial {
  nombre: string;
  color: string;
  mallas: THREE.Mesh[];
  triangulos: number;
}

export function VisorModelo() {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const escenaRef = useRef<THREE.Scene | null>(null);
  const camaraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const renderizadorRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlesRef = useRef<OrbitControls | null>(null);
  const modeloRef = useRef<THREE.Object3D | null>(null);
  /** Posición original de cada malla, para el despiece. */
  const posicionesRef = useRef(new WeakMap<THREE.Mesh, THREE.Vector3>());
  const animacionRef = useRef<number | null>(null);

  const [cargando, setCargando] = useState(true);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoMaterial[]>([]);
  const [visibles, setVisibles] = useState<Set<string>>(new Set());
  const [despiece, setDespiece] = useState(0);
  const [estadisticas, setEstadisticas] = useState({ mallas: 0, triangulos: 0, materiales: 0 });
  const [webglOk, setWebglOk] = useState(true);

  // ------------------------------------------------------------------
  //  Inicialización de la escena
  // ------------------------------------------------------------------
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || escenaRef.current) return;

    let renderizador: THREE.WebGLRenderer;
    try {
      renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setWebglOk(false);
      setCargando(false);
      setError('Tu navegador o tarjeta gráfica no soporta WebGL.');
      return;
    }

    renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderizador.setSize(contenedor.clientWidth, contenedor.clientHeight);
    renderizador.outputColorSpace = THREE.SRGBColorSpace;
    renderizador.toneMapping = THREE.ACESFilmicToneMapping;
    renderizador.toneMappingExposure = 1.05;
    contenedor.appendChild(renderizador.domElement);
    renderizadorRef.current = renderizador;

    const escena = new THREE.Scene();
    escena.background = new THREE.Color('#0d1a22');
    escena.fog = new THREE.Fog('#0d1a22', 900, 5200);
    escenaRef.current = escena;

    const camara = new THREE.PerspectiveCamera(
      45,
      contenedor.clientWidth / contenedor.clientHeight,
      0.5,
      30000
    );
    camara.position.set(140, 110, 140);
    camaraRef.current = camara;

    const controles = new OrbitControls(camara, renderizador.domElement);
    controles.enableDamping = true;
    controles.dampingFactor = 0.07;
    controles.maxPolarAngle = Math.PI / 2.05; // no pasar por debajo del suelo
    controlesRef.current = controles;

    // Iluminación caribeña: sol alto y fuerte, rebote del mar
    const sol = new THREE.DirectionalLight(0xfff4e2, 2.6);
    sol.position.set(1, 1.7, 0.75).multiplyScalar(600);
    escena.add(sol);

    escena.add(new THREE.HemisphereLight(0xbfe3ff, 0x6b5a45, 1.25));
    escena.add(new THREE.AmbientLight(0xffffff, 0.32));

    // Rejilla de referencia: da escala y sensación de suelo
    const rejilla = new THREE.GridHelper(2400, 48, 0x2d3a42, 0x1b262c);
    rejilla.position.y = -0.02;
    escena.add(rejilla);

    // ------------------------------------------------------------------
    //  Carga del modelo
    // ------------------------------------------------------------------
    const cargador = new GLTFLoader();
    cargador.load(
      RUTA_MODELO,
      (gltf) => {
        const modelo = gltf.scene;
        modeloRef.current = modelo;

        const mapa = new Map<string, GrupoMaterial>();
        let mallas = 0;
        let triangulos = 0;

        modelo.traverse((obj) => {
          const malla = obj as THREE.Mesh;
          if (!malla.isMesh) return;

          mallas++;
          posicionesRef.current.set(malla, malla.position.clone());

          const geo = malla.geometry as THREE.BufferGeometry;
          const cuenta = geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
          triangulos += cuenta;

          const mat = malla.material as THREE.Material | THREE.Material[];
          const primero = Array.isArray(mat) ? mat[0] : mat;
          const nombre = primero?.name || 'sin-material';
          const color = (primero as THREE.MeshStandardMaterial)?.color
            ? `#${(primero as THREE.MeshStandardMaterial).color.getHexString()}`
            : '#808080';

          if (!mapa.has(nombre)) {
            mapa.set(nombre, { nombre, color, mallas: [], triangulos: 0 });
          }
          const grupo = mapa.get(nombre)!;
          grupo.mallas.push(malla);
          grupo.triangulos += cuenta;
        });

        escena.add(modelo);

        // Encuadre automático según la caja envolvente
        const caja = new THREE.Box3().setFromObject(modelo);
        const tamano = caja.getSize(new THREE.Vector3());
        const centro = caja.getCenter(new THREE.Vector3());
        controles.target.copy(centro);

        const radio = Math.max(tamano.x, tamano.y, tamano.z);
        const distancia =
          (radio / (2 * Math.tan((camara.fov * Math.PI) / 180) / 2)) * 1.15;

        camara.position.set(
          centro.x + distancia * 0.78,
          centro.y + distancia * 0.66,
          centro.z + distancia * 0.78
        );
        camara.near = Math.max(radio / 2000, 0.1);
        camara.far = radio * 25;
        camara.updateProjectionMatrix();
        controles.update();

        // La niebla se ajusta al tamaño real del modelo. `fog` puede ser
        // Fog o FogExp2, y solo el primero tiene near y far.
        if (escena.fog instanceof THREE.Fog) {
          escena.fog.near = radio * 1.4;
          escena.fog.far = radio * 7;
        }

        const lista = [...mapa.values()].sort((a, b) => b.mallas.length - a.mallas.length);
        setGrupos(lista);
        setVisibles(new Set(lista.map((g) => g.nombre)));
        setEstadisticas({ mallas, triangulos: Math.round(triangulos), materiales: lista.length });
        setCargando(false);
      },
      (evento) => {
        if (evento.lengthComputable && evento.total > 0) {
          setProgreso(Math.min(99, Math.round((100 * evento.loaded) / evento.total)));
        }
      },
      (e) => {
        setCargando(false);
        setError(
          `No se pudo cargar el modelo (${(e as Error)?.message ?? 'error desconocido'}). ` +
            'Comprueba que public/modelos/TIERRABOMBA.glb existe.'
        );
      }
    );

    // ------------------------------------------------------------------
    //  Bucle de render
    // ------------------------------------------------------------------
    const animar = () => {
      animacionRef.current = requestAnimationFrame(animar);
      controles.update();
      renderizador.render(escena, camara);
    };
    animar();

    // ------------------------------------------------------------------
    //  Redimensionado
    // ------------------------------------------------------------------
    const alRedimensionar = () => {
      if (!contenedor.clientWidth || !contenedor.clientHeight) return;
      camara.aspect = contenedor.clientWidth / contenedor.clientHeight;
      camara.updateProjectionMatrix();
      renderizador.setSize(contenedor.clientWidth, contenedor.clientHeight);
    };
    const observador = new ResizeObserver(alRedimensionar);
    observador.observe(contenedor);

    return () => {
      observador.disconnect();
      if (animacionRef.current !== null) cancelAnimationFrame(animacionRef.current);
      controles.dispose();
      renderizador.dispose();
      renderizador.domElement.remove();
      escenaRef.current = null;
      renderizadorRef.current = null;
      modeloRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------------
  //  Visibilidad por familia de material
  // ------------------------------------------------------------------
  useEffect(() => {
    for (const g of grupos) {
      const visible = visibles.has(g.nombre);
      for (const m of g.mallas) m.visible = visible;
    }
  }, [visibles, grupos]);

  // ------------------------------------------------------------------
  //  Despiece vertical
  // ------------------------------------------------------------------
  useEffect(() => {
    const modelo = modeloRef.current;
    if (!modelo) return;

    const caja = new THREE.Box3().setFromObject(modelo);
    const altura = caja.max.y - caja.min.y || 1;

    for (const g of grupos) {
      for (const m of g.mallas) {
        const base = posicionesRef.current.get(m);
        if (!base) continue;
        // Cada familia sube en proporción a su cota: lo más alto se separa más
        const factor = (base.y - caja.min.y) / altura;
        m.position.y = base.y + despiece * altura * 0.85 * (0.3 + factor);
      }
    }
  }, [despiece, grupos]);

  // ------------------------------------------------------------------
  //  Acciones
  // ------------------------------------------------------------------
  const alternarGrupo = useCallback((nombre: string) => {
    setVisibles((prev) => {
      const s = new Set(prev);
      if (s.has(nombre)) s.delete(nombre);
      else s.add(nombre);
      return s;
    });
  }, []);

  const reencuadrar = useCallback(() => {
    const modelo = modeloRef.current;
    const camara = camaraRef.current;
    const controles = controlesRef.current;
    if (!modelo || !camara || !controles) return;

    const caja = new THREE.Box3().setFromObject(modelo);
    const tamano = caja.getSize(new THREE.Vector3());
    const centro = caja.getCenter(new THREE.Vector3());
    const radio = Math.max(tamano.x, tamano.y, tamano.z);
    const distancia = (radio / (2 * Math.tan((camara.fov * Math.PI) / 180) / 2)) * 1.15;

    controles.target.copy(centro);
    camara.position.set(
      centro.x + distancia * 0.78,
      centro.y + distancia * 0.66,
      centro.z + distancia * 0.78
    );
    controles.update();
  }, []);

  const reiniciar = useCallback(() => {
    setDespiece(0);
    setVisibles(new Set(grupos.map((g) => g.nombre)));
    reencuadrar();
  }, [grupos, reencuadrar]);

  const etiquetaGrupo = useMemo(
    () => (nombre: string) => nombre.replace(/_/g, ' ').replace(/^Material for /i, ''),
    []
  );

  if (!webglOk) {
    return (
      <div className="grid h-[32rem] place-items-center rounded-xl border border-hueso-100/10 bg-oceano-900/40">
        <div className="max-w-md p-6 text-center">
          <TriangleAlert className="mx-auto size-6 text-pendiente" aria-hidden />
          <p className="mt-3 text-sm text-hueso-200">El visor 3D no está disponible</p>
          <p className="mt-1.5 text-[0.8125rem] text-grafito-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_19rem]">
      {/* Lienzo 3D */}
      <section className="relative overflow-hidden rounded-xl border border-hueso-100/10">
        <div ref={contenedorRef} className="h-[32rem] w-full" role="img" aria-label="Modelo 3D del equipamiento propuesto" />

        {/* Carga */}
        {cargando && !error && (
          <div className="absolute inset-0 grid place-items-center bg-oceano-950/85">
            <div className="w-64 text-center">
              <p className="text-sm text-hueso-200">Cargando el modelo…</p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-hueso-100/10">
                <div
                  className="h-full bg-turquesa-500 transition-all"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <p className="dato-mono mt-2 text-grafito-500">
                {progreso}% de 40,3 MB
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !cargando && (
          <div className="absolute inset-0 grid place-items-center bg-oceano-950/90 p-6">
            <div className="max-w-md text-center">
              <TriangleAlert className="mx-auto size-6 text-pendiente" aria-hidden />
              <p className="mt-3 text-sm text-hueso-200">No se pudo cargar el modelo</p>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-grafito-400">{error}</p>
            </div>
          </div>
        )}

        {/* Controles flotantes */}
        {!cargando && !error && (
          <div className="absolute right-3 top-3 flex gap-1">
            <button
              type="button"
              onClick={reencuadrar}
              title="Encuadrar el modelo"
              className="panel rounded-md p-2 text-hueso-200 transition hover:text-turquesa-400"
            >
              <Maximize2 className="size-4" aria-hidden />
              <span className="sr-only">Encuadrar el modelo</span>
            </button>
            <button
              type="button"
              onClick={reiniciar}
              title="Restablecer la vista"
              className="panel rounded-md p-2 text-hueso-200 transition hover:text-turquesa-400"
            >
              <RotateCcw className="size-4" aria-hidden />
              <span className="sr-only">Restablecer la vista</span>
            </button>
          </div>
        )}

        {/* Estadísticas */}
        {!cargando && !error && (
          <div className="panel absolute bottom-3 left-3 flex flex-wrap gap-x-4 gap-y-1 px-3 py-2">
            <Dato etiqueta="Mallas" valor={numero(estadisticas.mallas)} />
            <Dato etiqueta="Triángulos" valor={numero(estadisticas.triangulos)} />
            <Dato etiqueta="Materiales" valor={numero(estadisticas.materiales)} />
          </div>
        )}
      </section>

      {/* Panel lateral */}
      <div className="flex flex-col gap-3">
        {/* Familias de material */}
        <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <Layers className="size-4 text-turquesa-500" aria-hidden />
            <h2 className="text-[0.8125rem] font-semibold text-hueso-100">
              Familias de material
            </h2>
          </div>

          {grupos.length === 0 ? (
            <p className="text-[0.75rem] text-grafito-500">Sin materiales detectados.</p>
          ) : (
            <ul className="space-y-1">
              {grupos.map((g) => {
                const activa = visibles.has(g.nombre);
                return (
                  <li key={g.nombre}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activa}
                      onClick={() => alternarGrupo(g.nombre)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-hueso-100/[0.06]"
                    >
                      {activa ? (
                        <Eye className="size-3.5 shrink-0 text-turquesa-400" aria-hidden />
                      ) : (
                        <EyeOff className="size-3.5 shrink-0 text-grafito-500" aria-hidden />
                      )}
                      <span
                        className="size-2.5 shrink-0 rounded-sm ring-1 ring-inset ring-white/25"
                        style={{ backgroundColor: g.color }}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-[0.75rem]',
                          activa ? 'text-hueso-200' : 'text-grafito-500'
                        )}
                        title={g.nombre}
                      >
                        {etiquetaGrupo(g.nombre)}
                      </span>
                      <span className="dato-mono shrink-0 text-grafito-500">{g.mallas.length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Despiece */}
        <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="size-4 text-turquesa-500" aria-hidden />
              <h2 className="text-[0.8125rem] font-semibold text-hueso-100">Despiece vertical</h2>
            </div>
            <span className="dato-mono text-grafito-400">{despiece.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={despiece * 100}
            onChange={(e) => setDespiece(Number(e.target.value) / 100)}
            aria-label="Separación de las capas del modelo"
            className="w-full accent-turquesa-500"
          />
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-grafito-500">
            Separa las familias por cota para ver la cubierta, los muros y el terreno por
            separado.
          </p>
        </section>

        {/* Advertencia sobre georreferenciación */}
        <section className="rounded-xl border border-pendiente/30 bg-pendiente/[0.07] p-4">
          <div className="flex gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-pendiente" aria-hidden />
            <div>
              <h2 className="text-[0.8125rem] font-semibold text-arena-300">
                Modelo sin georreferenciar
              </h2>
              <p className="mt-1 text-[0.6875rem] leading-relaxed text-grafito-400">
                La exportación de Revit está en coordenadas internas del proyecto. Aquí se muestra
                aislado y a escala real, pero <strong>no superpuesto al territorio</strong>. Para
                situarlo hay que calibrar un punto conocido.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="dato-mono text-grafito-500">{etiqueta}</span>
      <span className="dato-mono text-hueso-100">{valor}</span>
    </div>
  );
}
