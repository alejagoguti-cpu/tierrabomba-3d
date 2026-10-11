'use client';

/**
 * Visor y analizador BIM de archivos IFC.
 * ==================================================================
 * Lee un IFC EN EL NAVEGADOR con web-ifc (el motor de That Open
 * Engine) y muestra su geometría real junto con sus datos BIM:
 * número de elementos, tipos y estructura espacial.
 *
 * POR QUÉ SE SUBE EL ARCHIVO Y NO VIENE INCLUIDO
 *   El proyecto NO tiene ningún IFC. El modelo del equipamiento se
 *   exportó de Revit a OBJ y de ahí a glTF, un formato de malla que
 *   conserva la geometría pero PIERDE todos los metadatos BIM: no hay
 *   muros, forjados ni niveles, solo triángulos.
 *
 *   Un módulo BIM con datos inventados sería exactamente lo que este
 *   proyecto evita. En su lugar, aquí se lee el IFC que exporte la
 *   persona usuaria —Revit: Archivo ▸ Exportar ▸ IFC— y se muestra lo
 *   que ese archivo contenga de verdad.
 *
 *   Nada sale del navegador: el archivo no se sube a ningún servidor.
 * ==================================================================
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  AlertTriangle,
  Boxes,
  FileBox,
  HardDriveDownload,
  Layers3,
  Maximize2,
  Trash2,
  Upload,
} from 'lucide-react';
import { cn, numero } from '@/lib/utils';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Paleta por familia de elemento, para que la maqueta se lea. */
const COLORES: Record<string, string> = {
  IFCWALL: '#d9c6a3',
  IFCWALLSTANDARDCASE: '#d9c6a3',
  IFCSLAB: '#9aa7ae',
  IFCROOF: '#c96f4a',
  IFCBEAM: '#8fa37e',
  IFCCOLUMN: '#6b9a80',
  IFCDOOR: '#8a5a3c',
  IFCWINDOW: '#39b8b0',
  IFCSTAIR: '#6b7a83',
  IFCFOOTING: '#5b5148',
  IFCMEMBER: '#b8a077',
  IFCPLATE: '#a8743f',
  IFCRAILING: '#96ded9',
  IFCCURTAINWALL: '#5fcbc4',
  IFCFURNISHINGELEMENT: '#b06fc4',
  IFCFLOWTERMINAL: '#2f7dd1',
  IFCFLOWSEGMENT: '#2a8f89',
};
const COLOR_OTRO = '#6b7a83';

/** Nombre legible a partir del código de tipo de IFC. */
function nombreTipo(codigo: string): string {
  return codigo
    .replace(/^IFC/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/STANDARDCASE$/, '');
}

interface EstadisticasBIM {
  elementos: number;
  mallas: number;
  tipos: Array<{ codigo: string; etiqueta: string; cantidad: number; color: string }>;
  pisos: Array<{ nombre: string; elevacion: number | null }>;
  nombreProyecto: string | null;
}

type Estado = 'vacio' | 'leyendo' | 'listo' | 'error';

export function VisorIFC() {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const escenaRef = useRef<THREE.Scene | null>(null);
  const renderizadorRef = useRef<THREE.WebGLRenderer | null>(null);
  const camaraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlesRef = useRef<OrbitControls | null>(null);
  const modeloRef = useRef<THREE.Object3D | null>(null);
  // El modelo se abre con web-ifc; hay que cerrarlo al salir para no
  // dejar memoria reservada en el wasm.
  const apiRef = useRef<{ CloseModel: (id: number) => void } | null>(null);
  const modelIDRef = useRef<number | null>(null);

  const [estado, setEstado] = useState<Estado>('vacio');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [estadisticas, setEstadisticas] = useState<EstadisticasBIM | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  // ------------------------------------------------------------------
  //  Escena (se crea al mostrar el primer modelo)
  // ------------------------------------------------------------------
  const asegurarEscena = useCallback(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || escenaRef.current) return escenaRef.current;

    let renderizador: THREE.WebGLRenderer;
    try {
      renderizador = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setEstado('error');
      setMensaje('Tu navegador o tarjeta gráfica no soporta WebGL.');
      return null;
    }

    renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderizador.setSize(contenedor.clientWidth, contenedor.clientHeight);
    renderizador.outputColorSpace = THREE.SRGBColorSpace;
    renderizador.toneMapping = THREE.ACESFilmicToneMapping;
    contenedor.appendChild(renderizador.domElement);
    renderizadorRef.current = renderizador;

    const escena = new THREE.Scene();
    escena.background = new THREE.Color('#0d1a22');
    escenaRef.current = escena;

    const camara = new THREE.PerspectiveCamera(
      45,
      contenedor.clientWidth / contenedor.clientHeight,
      0.1,
      8000
    );
    camara.position.set(18, 14, 18);
    camaraRef.current = camara;

    const controles = new OrbitControls(camara, renderizador.domElement);
    controles.enableDamping = true;
    controles.dampingFactor = 0.08;
    controlesRef.current = controles;

    escena.add(new THREE.DirectionalLight(0xfff4e2, 2.4).translateX(20).translateY(30));
    const sol = new THREE.DirectionalLight(0xfff4e2, 2.2);
    sol.position.set(22, 34, 18);
    escena.add(sol);
    escena.add(new THREE.HemisphereLight(0xcfe8ff, 0x6b5a45, 1.15));
    escena.add(new THREE.AmbientLight(0xffffff, 0.34));

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

    return escena;
  }, []);

  // Al desmontar, cerrar el modelo de web-ifc y liberar la escena
  useEffect(() => {
    return () => {
      try {
        if (apiRef.current && modelIDRef.current !== null) {
          apiRef.current.CloseModel(modelIDRef.current);
        }
      } catch {
        // El wasm ya puede estar liberado
      }
      controlesRef.current?.dispose();
      renderizadorRef.current?.dispose();
      renderizadorRef.current?.domElement.remove();
      escenaRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------------
  //  Lectura del IFC
  // ------------------------------------------------------------------
  const leerIFC = useCallback(
    async (archivo: File) => {
      setEstado('leyendo');
      setMensaje(null);
      setProgreso(5);
      setNombreArchivo(archivo.name);
      setEstadisticas(null);

      try {
        const buffer = await archivo.arrayBuffer();
        setProgreso(20);

        // Importación dinámica: web-ifc pesa y solo se necesita aquí
        const { IfcAPI } = await import('web-ifc');
        const api = new IfcAPI();
        api.SetWasmPath(`${BASE}/ifc/`, true);
        await api.Init(customLocateFile());
        setProgreso(35);

        const modelID = api.OpenModel(new Uint8Array(buffer), {
          COORDINATE_TO_ORIGIN: true,
        });

        if (modelID < 0) {
          throw new Error('web-ifc no pudo interpretar el archivo. ¿Es un IFC válido?');
        }

        apiRef.current = api;
        modelIDRef.current = modelID;
        setProgreso(50);

        const escena = asegurarEscena();
        if (!escena) return;

        // Retirar el modelo anterior
        if (modeloRef.current) {
          escena.remove(modeloRef.current);
          modeloRef.current.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.geometry?.dispose();
              const mat = m.material as THREE.Material | THREE.Material[];
              if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
              else mat?.dispose();
            }
          });
        }

        const grupo = new THREE.Group();
        const materiales = new Map<string, THREE.MeshStandardMaterial>();
        const conteoTipos = new Map<string, number>();
        const mallas = api.LoadAllGeometry(modelID);
        const total = mallas.size();

        for (let i = 0; i < total; i++) {
          const plana = mallas.get(i);

          // Tipo real del elemento, leído del archivo
          let codigo = 'DESCONOCIDO';
          try {
            codigo = String(
              api.GetNameFromTypeCode(api.GetLineType(modelID, plana.expressID)) ?? 'DESCONOCIDO'
            ).toUpperCase();
          } catch {
            // Si la versión no expone el nombre del tipo, se agrupa aparte
          }
          conteoTipos.set(codigo, (conteoTipos.get(codigo) ?? 0) + 1);

          // Un mismo elemento puede estar compuesto por VARIAS geometrías
          // colocadas (instancias), cada una con su matriz de colocación.
          // Tratar solo la primera perdería partes del modelo.
          const colocadas = plana.geometries;

          for (let g = 0; g < colocadas.size(); g++) {
            const colocada = colocadas.get(g);
            const geometria = api.GetGeometry(modelID, colocada.geometryExpressID);

            const vertices = api.GetVertexArray(
              geometria.GetVertexData(),
              geometria.GetVertexDataSize()
            );
            const indices = api.GetIndexArray(
              geometria.GetIndexData(),
              geometria.GetIndexDataSize()
            );
            if (!vertices.length || !indices.length) continue;

            // Los vértices vienen intercalados: x, y, z, nx, ny, nz
            const cuenta = vertices.length / 6;
            const posiciones = new Float32Array(cuenta * 3);
            const normales = new Float32Array(cuenta * 3);
            for (let j = 0; j < cuenta; j++) {
              const o = j * 6;
              const d = j * 3;
              posiciones[d] = vertices[o];
              posiciones[d + 1] = vertices[o + 1];
              posiciones[d + 2] = vertices[o + 2];
              normales[d] = vertices[o + 3];
              normales[d + 1] = vertices[o + 4];
              normales[d + 2] = vertices[o + 5];
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
            geo.setAttribute('normal', new THREE.BufferAttribute(normales, 3));
            geo.setIndex(new THREE.BufferAttribute(indices, 1));

            // La matriz viene en orden por columnas, que es el que
            // espera `Matrix4.fromArray`.
            if (colocada.flatTransformation?.length === 16) {
              geo.applyMatrix4(new THREE.Matrix4().fromArray(colocada.flatTransformation));
            }

            let material = materiales.get(codigo);
            if (!material) {
              material = new THREE.MeshStandardMaterial({
                color: COLORES[codigo] ?? COLOR_OTRO,
                roughness: 0.82,
                metalness: 0.05,
                side: THREE.DoubleSide,
              });
              materiales.set(codigo, material);
            }

            const malla = new THREE.Mesh(geo, material);
            malla.castShadow = true;
            malla.receiveShadow = true;
            grupo.add(malla);
          }

          if (i % 400 === 0) {
            setProgreso(50 + Math.round((40 * i) / Math.max(total, 1)));
            // Se cede el hilo para que la barra avance de verdad
            await new Promise((r) => setTimeout(r, 0));
          }
        }

        escena.add(grupo);
        modeloRef.current = grupo;
        setProgreso(95);

        // --- Encuadre ---
        const caja = new THREE.Box3().setFromObject(grupo);
        const tamano = caja.getSize(new THREE.Vector3());
        const centro = caja.getCenter(new THREE.Vector3());
        const camara = camaraRef.current!;
        const controles = controlesRef.current!;
        const radio = Math.max(tamano.x, tamano.y, tamano.z) || 10;
        const distancia = (radio / (2 * Math.tan((camara.fov * Math.PI) / 180) / 2)) * 1.25;

        controles.target.copy(centro);
        camara.position.set(
          centro.x + distancia * 0.8,
          centro.y + distancia * 0.62,
          centro.z + distancia * 0.8
        );
        camara.near = Math.max(radio / 2000, 0.05);
        camara.far = radio * 40;
        camara.updateProjectionMatrix();
        controles.update();

        // --- Estructura espacial y proyecto, si el IFC los trae ---
        const pisos: EstadisticasBIM['pisos'] = [];
        let nombreProyecto: string | null = null;
        try {
          const proyecto = api.GetLine(modelID, api.GetLineIDsWithType(modelID, 103090709).get(0));
          nombreProyecto = proyecto?.Name?.value ?? null;
        } catch {
          nombreProyecto = null;
        }
        try {
          const ids = api.GetLineIDsWithType(modelID, 3124254112); // IFCBUILDINGSTOREY
          for (let i = 0; i < ids.size(); i++) {
            const linea = api.GetLine(modelID, ids.get(i));
            pisos.push({
              nombre: linea?.Name?.value ?? `Nivel ${i + 1}`,
              elevacion:
                typeof linea?.Elevation?.value === 'number' ? linea.Elevation.value : null,
            });
          }
          pisos.sort((a, b) => (a.elevacion ?? 0) - (b.elevacion ?? 0));
        } catch {
          // Un IFC sin niveles es perfectamente válido
        }

        const tipos = [...conteoTipos.entries()]
          .map(([codigo, cantidad]) => ({
            codigo,
            etiqueta: nombreTipo(codigo),
            cantidad,
            color: COLORES[codigo] ?? COLOR_OTRO,
          }))
          .sort((a, b) => b.cantidad - a.cantidad);

        let elementos = 0;
        for (const t of tipos) elementos += t.cantidad;

        setEstadisticas({
          elementos,
          mallas: total,
          tipos,
          pisos,
          nombreProyecto,
        });
        setProgreso(100);
        setEstado('listo');
      } catch (e) {
        setEstado('error');
        setMensaje((e as Error)?.message ?? 'No se pudo leer el archivo IFC.');
      }
    },
    [asegurarEscena]
  );

  const alSoltar = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    const archivo = e.dataTransfer.files?.[0];
    if (archivo) void leerIFC(archivo);
  };

  const limpiar = () => {
    try {
      if (apiRef.current && modelIDRef.current !== null) {
        apiRef.current.CloseModel(modelIDRef.current);
      }
    } catch {
      // ya liberado
    }
    modelIDRef.current = null;
    const escena = escenaRef.current;
    if (escena && modeloRef.current) {
      escena.remove(modeloRef.current);
      modeloRef.current.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry?.dispose();
      });
      modeloRef.current = null;
    }
    setEstadisticas(null);
    setNombreArchivo(null);
    setEstado('vacio');
    setMensaje(null);
    setProgreso(0);
  };

  const reencuadrar = () => {
    const modelo = modeloRef.current;
    const camara = camaraRef.current;
    const controles = controlesRef.current;
    if (!modelo || !camara || !controles) return;

    const caja = new THREE.Box3().setFromObject(modelo);
    const tamano = caja.getSize(new THREE.Vector3());
    const centro = caja.getCenter(new THREE.Vector3());
    const radio = Math.max(tamano.x, tamano.y, tamano.z) || 10;
    const distancia = (radio / (2 * Math.tan((camara.fov * Math.PI) / 180) / 2)) * 1.25;
    controles.target.copy(centro);
    camara.position.set(
      centro.x + distancia * 0.8,
      centro.y + distancia * 0.62,
      centro.z + distancia * 0.8
    );
    controles.update();
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_19rem]">
      {/* Lienzo */}
      <section
        className={cn(
          'relative overflow-hidden rounded-xl border transition',
          arrastrando ? 'border-turquesa-500 bg-turquesa-500/[0.06]' : 'border-hueso-100/10'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
      >
        <div
          ref={contenedorRef}
          className={cn('w-full', estado === 'vacio' && !estadisticas ? 'h-40' : 'h-[32rem]')}
        />

        {/* Estado inicial: no hay IFC en el proyecto */}
        {estado === 'vacio' && !estadisticas && (
          <div className="absolute inset-x-0 top-0 flex h-40 flex-col items-center justify-center gap-2 px-6 text-center">
            <FileBox className="size-6 text-grafito-500" aria-hidden />
            <p className="text-sm text-hueso-200">No hay ningún modelo IFC cargado</p>
            <p className="max-w-md text-[0.75rem] leading-relaxed text-grafito-400">
              Arrastra un archivo <code className="dato-mono">.ifc</code> aquí o usa el botón.
              Se lee en tu navegador: el archivo no se envía a ningún servidor.
            </p>
          </div>
        )}

        {/* Progreso */}
        {estado === 'leyendo' && (
          <div className="absolute inset-0 grid place-items-center bg-oceano-950/85">
            <div className="w-64 text-center">
              <p className="text-sm text-hueso-200">Leyendo el IFC…</p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-hueso-100/10">
                <div
                  className="h-full bg-turquesa-500 transition-all"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <p className="dato-mono mt-2 text-grafito-500">{progreso}%</p>
            </div>
          </div>
        )}

        {/* Error */}
        {estado === 'error' && (
          <div className="absolute inset-0 grid place-items-center bg-oceano-950/90 p-6">
            <div className="max-w-md text-center">
              <AlertTriangle className="mx-auto size-6 text-pendiente" aria-hidden />
              <p className="mt-3 text-sm text-hueso-200">No se pudo leer el archivo</p>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-grafito-400">{mensaje}</p>
              <button
                type="button"
                onClick={limpiar}
                className="mt-4 rounded-md border border-hueso-100/20 px-4 py-2 text-[0.75rem] text-hueso-200 transition hover:bg-hueso-100/10"
              >
                Intentar con otro archivo
              </button>
            </div>
          </div>
        )}

        {/* Controles flotantes */}
        {estado === 'listo' && (
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
              onClick={limpiar}
              title="Cerrar el modelo"
              className="panel rounded-md p-2 text-hueso-200 transition hover:text-turquesa-400"
            >
              <Trash2 className="size-4" aria-hidden />
              <span className="sr-only">Cerrar el modelo</span>
            </button>
          </div>
        )}

        {/* Datos BIM del archivo */}
        {estadisticas && estado === 'listo' && (
          <div className="panel absolute bottom-3 left-3 flex flex-wrap gap-x-4 gap-y-1 px-3 py-2">
            <Dato etiqueta="Elementos" valor={numero(estadisticas.elementos)} />
            <Dato etiqueta="Mallas" valor={numero(estadisticas.mallas)} />
            <Dato etiqueta="Tipos" valor={numero(estadisticas.tipos.length)} />
            {estadisticas.pisos.length > 0 && (
              <Dato etiqueta="Niveles" valor={numero(estadisticas.pisos.length)} />
            )}
          </div>
        )}
      </section>

      {/* Panel lateral */}
      <div className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto">
        {/* Carga */}
        <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Upload className="size-4 text-turquesa-500" aria-hidden />
            <h3 className="text-[0.8125rem] font-semibold text-hueso-100">Cargar un IFC</h3>
          </div>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-hueso-100/25 px-3 py-3 text-[0.75rem] text-hueso-200 transition hover:border-turquesa-500 hover:bg-turquesa-500/[0.06]">
            <Upload className="size-3.5" aria-hidden />
            Elegir archivo .ifc
            <input
              type="file"
              accept=".ifc"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void leerIFC(f);
              }}
            />
          </label>

          {nombreArchivo && (
            <p className="dato-mono mt-2 truncate text-grafito-500" title={nombreArchivo}>
              {nombreArchivo}
            </p>
          )}

          <p className="mt-2 text-[0.625rem] leading-relaxed text-grafito-500">
            En Revit: <strong className="text-hueso-200">Archivo ▸ Exportar ▸ IFC</strong>. El
            procesamiento ocurre en tu equipo.
          </p>
        </section>

        {/* Por qué no viene incluido */}
        {!estadisticas && (
          <section className="rounded-xl border border-pendiente/30 bg-pendiente/[0.07] p-4">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-pendiente" aria-hidden />
              <div>
                <h3 className="text-[0.8125rem] font-semibold text-arena-300">
                  El proyecto no incluye ningún IFC
                </h3>
                <p className="mt-1 text-[0.6875rem] leading-relaxed text-grafito-400">
                  El modelo del equipamiento se exportó de Revit a OBJ y de ahí a glTF: es una
                  malla, y una malla <strong>pierde todos los datos BIM</strong> —no hay muros,
                  forjados ni niveles, solo triángulos—. Para ver propiedades BIM de verdad hace
                  falta el IFC, que solo puede generar quien tiene el modelo de Revit.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Tipos de elemento */}
        {estadisticas && (
          <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <Boxes className="size-4 text-turquesa-500" aria-hidden />
              <h3 className="text-[0.8125rem] font-semibold text-hueso-100">
                Tipos de elemento
              </h3>
            </div>
            <ul className="space-y-1">
              {estadisticas.tipos.slice(0, 14).map((t) => (
                <li key={t.codigo} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-sm ring-1 ring-inset ring-white/20"
                    style={{ backgroundColor: t.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[0.75rem] text-grafito-400" title={t.codigo}>
                    {t.etiqueta}
                  </span>
                  <span className="dato-mono shrink-0 text-hueso-200">{numero(t.cantidad)}</span>
                </li>
              ))}
            </ul>
            {estadisticas.tipos.length > 14 && (
              <p className="dato-mono mt-2 text-grafito-500">
                y {numero(estadisticas.tipos.length - 14)} tipos más
              </p>
            )}
          </section>
        )}

        {/* Niveles */}
        {estadisticas && estadisticas.pisos.length > 0 && (
          <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/50 p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <Layers3 className="size-4 text-turquesa-500" aria-hidden />
              <h3 className="text-[0.8125rem] font-semibold text-hueso-100">Niveles</h3>
            </div>
            <ul className="space-y-1">
              {estadisticas.pisos.map((p, i) => (
                <li key={`${p.nombre}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[0.75rem] text-grafito-400">
                    {p.nombre}
                  </span>
                  <span className="dato-mono shrink-0 text-hueso-200">
                    {p.elevacion !== null ? `${numero(p.elevacion, 2)} m` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Aviso de tamaño */}
        <section className="rounded-xl border border-hueso-100/10 bg-oceano-900/40 p-4">
          <div className="flex gap-2">
            <HardDriveDownload className="mt-0.5 size-4 shrink-0 text-grafito-500" aria-hidden />
            <p className="text-[0.625rem] leading-relaxed text-grafito-500">
              Los IFC grandes, de más de cien megabytes, pueden tardar en leerse y consumir
              bastante memoria: el archivo se interpreta entero en el navegador.
            </p>
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

/**
 * Localizador del wasm.
 *
 * web-ifc busca `web-ifc.wasm` junto al script por defecto, pero en una
 * exportación estática el binario vive en /ifc/. Devolver la ruta
 * explícita evita un 404 que dejaría el módulo inservible.
 */
function customLocateFile() {
  return (ruta: string) => `${BASE}/ifc/${ruta}`;
}
