'use client';

/**
 * Participación ciudadana.
 * ==================================================================
 * DEPENDENCIA EXTERNA DECLARADA
 *   La plataforma es un sitio estático (GitHub Pages). No tiene
 *   servidor ni base de datos, así que NO puede recibir envíos, ni
 *   moderar, ni almacenar fotografías. Cualquier formulario que
 *   "enviara" algo sería decorativo.
 *
 * ALTERNATIVA FUNCIONAL IMPLEMENTADA
 *   El formulario construye un informe estructurado y verificable que
 *   la persona descarga como archivo y remite por el canal que elija
 *   (correo o incidencia en el repositorio). No se pierde información
 *   y queda constancia de la aportación, sin prometer nada que no
 *   exista.
 *
 *   Cuando haya backend (Supabase, Directus o una API propia), este
 *   componente se conecta a él sin cambiar la interfaz.
 * ==================================================================
 */

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Download,
  ExternalLink,
  Send,
} from 'lucide-react';

type TipoAporte =
  | 'equipamiento-faltante'
  | 'correccion'
  | 'cambio-infraestructura'
  | 'otro';

const TIPOS: Array<{ id: TipoAporte; etiqueta: string; ayuda: string }> = [
  {
    id: 'equipamiento-faltante',
    etiqueta: 'Equipamiento faltante',
    ayuda: 'Existe un equipamiento en la isla que no aparece en la plataforma.',
  },
  {
    id: 'correccion',
    etiqueta: 'Corrección de un dato',
    ayuda: 'Un dato publicado es incorrecto o está mal ubicado.',
  },
  {
    id: 'cambio-infraestructura',
    etiqueta: 'Cambio en la infraestructura',
    ayuda: 'Se construyó, se cerró o se modificó una vía, un muelle o un servicio.',
  },
  {
    id: 'otro',
    etiqueta: 'Otro aporte',
    ayuda: 'Cualquier otra observación sobre el territorio o la plataforma.',
  },
];

const CORREO = 'alejagoguti@gmail.com';
const URL_REPO = 'https://github.com/alejagoguti-cpu/tierrabomba-3d';

export default function PaginaParticipa() {
  const [tipo, setTipo] = useState<TipoAporte>('equipamiento-faltante');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [fuente, setFuente] = useState('');
  const [contacto, setContacto] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [descargado, setDescargado] = useState(false);

  const valido = descripcion.trim().length >= 15;

  /** Informe estructurado que se descarga o se copia. */
  const informe = useMemo(() => {
    return {
      tipo,
      descripcion: descripcion.trim(),
      ubicacion:
        lat.trim() && lng.trim()
          ? { latitud: Number(lat), longitud: Number(lng) }
          : 'No indicada',
      fuente: fuente.trim() || 'No indicada',
      aportante: nombre.trim() || 'Anónimo',
      contacto: contacto.trim() || 'No facilitado',
      plataforma: 'TIERRA BOMBA 3D',
      fecha: new Date().toISOString(),
      estado: 'pendiente-de-validacion',
      nota:
        'Aporte ciudadano sin verificar. No debe publicarse como dato confirmado ' +
        'hasta que sea revisado y contrastado con una fuente.',
    };
  }, [tipo, descripcion, lat, lng, fuente, nombre, contacto]);

  const textoInforme = useMemo(() => JSON.stringify(informe, null, 2), [informe]);

  const descargar = () => {
    const blob = new Blob([textoInforme], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aporte-tierra-bomba-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDescargado(true);
    window.setTimeout(() => setDescargado(false), 2200);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoInforme);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2200);
    } catch {
      // Si el navegador bloquea el portapapeles, se usa la descarga
    }
  };

  const asunto = `[Tierra Bomba 3D] ${TIPOS.find((t) => t.id === tipo)?.etiqueta}`;
  const urlCorreo = `mailto:${CORREO}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(
    `${descripcion}\n\n${textoInforme}`
  )}`;
  const urlIncidencia = `${URL_REPO}/issues/new?title=${encodeURIComponent(
    asunto
  )}&body=${encodeURIComponent(`**Descripción**\n${descripcion}\n\n\`\`\`json\n${textoInforme}\n\`\`\``)}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <header className="max-w-3xl">
        <p className="dato-mono text-turquesa-500 uppercase tracking-[0.18em]">Participación</p>
        <h1 className="mt-3 font-display text-titulo text-hueso-100">
          Aporta lo que el mapa no sabe
        </h1>
        <p className="mt-4 text-base leading-relaxed text-grafito-400">
          Los datos de esta plataforma son incompletos por definición. Si conoces un equipamiento
          que falta, un dato equivocado o un cambio en la infraestructura, tu aporte es la vía más
          rápida para corregirlo.
        </p>
      </header>

      {/* Aviso sobre la dependencia técnica */}
      <section className="mt-8 flex gap-3 rounded-lg border border-pendiente/30 bg-pendiente/[0.07] p-5">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-pendiente" aria-hidden />
        <div className="text-[0.8125rem] leading-relaxed text-grafito-400">
          <h2 className="text-sm font-semibold text-arena-300">
            Esta versión aún no recibe aportes automáticamente
          </h2>
          <p className="mt-1.5">
            La plataforma es un sitio estático sin servidor ni base de datos, así que no puede
            almacenar envíos, moderar contenido ni guardar fotografías. En lugar de simular un
            formulario que no enviaría nada, aquí se genera un{' '}
            <strong className="text-hueso-200">informe estructurado</strong> que puedes descargar y
            remitir por correo o como incidencia en el repositorio.
          </p>
          <p className="mt-2">
            Todo aporte queda marcado como{' '}
            <span className="dato-mono text-pendiente">pendiente de validación</span> hasta ser
            revisado. Ningún dato ciudadano se publica como verificado sin contraste.
          </p>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        {/* Formulario */}
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (valido) descargar();
          }}
        >
          {/* Tipo */}
          <fieldset className="panel p-5">
            <legend className="sr-only">Tipo de aporte</legend>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-hueso-200">
              ¿Qué quieres aportar?
            </h2>
            <div className="mt-3 space-y-2">
              {TIPOS.map((t) => (
                <label
                  key={t.id}
                  className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                    tipo === t.id
                      ? 'border-turquesa-500/50 bg-turquesa-500/[0.08]'
                      : 'border-hueso-100/10 hover:border-hueso-100/25'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo"
                    value={t.id}
                    checked={tipo === t.id}
                    onChange={() => setTipo(t.id)}
                    className="mt-1 accent-turquesa-500"
                  />
                  <span>
                    <span className="block text-[0.8125rem] text-hueso-100">{t.etiqueta}</span>
                    <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-grafito-500">
                      {t.ayuda}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Descripción */}
          <div className="panel space-y-4 p-5">
            <div>
              <label htmlFor="descripcion" className="mb-1.5 block text-[0.8125rem] text-hueso-200">
                Descripción <span className="text-grafito-500">(obligatoria, mín. 15 caracteres)</span>
              </label>
              <textarea
                id="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={5}
                placeholder="Describe con el mayor detalle posible: qué es, dónde está y cómo lo sabes."
                className="w-full rounded-md border border-hueso-100/15 bg-oceano-950/60 px-3 py-2 text-[0.8125rem] text-hueso-100 placeholder:text-grafito-500 focus:border-turquesa-500 focus:outline-none"
              />
              <p className="mt-1 text-[0.6875rem] text-grafito-500">
                {descripcion.trim().length} caracteres
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lat" className="mb-1.5 block text-[0.8125rem] text-hueso-200">
                  Latitud <span className="text-grafito-500">(opcional)</span>
                </label>
                <input
                  id="lat"
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="10.34975"
                  className="w-full rounded-md border border-hueso-100/15 bg-oceano-950/60 px-3 py-2 text-[0.8125rem] text-hueso-100 placeholder:text-grafito-500 focus:border-turquesa-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="lng" className="mb-1.5 block text-[0.8125rem] text-hueso-200">
                  Longitud <span className="text-grafito-500">(opcional)</span>
                </label>
                <input
                  id="lng"
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="-75.57050"
                  className="w-full rounded-md border border-hueso-100/15 bg-oceano-950/60 px-3 py-2 text-[0.8125rem] text-hueso-100 placeholder:text-grafito-500 focus:border-turquesa-500 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[0.6875rem] leading-relaxed text-grafito-500">
              Puedes obtener las coordenadas en el visor: mueve el cursor sobre el punto y lee la
              barra inferior.
            </p>

            <div>
              <label htmlFor="fuente" className="mb-1.5 block text-[0.8125rem] text-hueso-200">
                ¿Cómo lo sabes? <span className="text-grafito-500">(opcional pero recomendable)</span>
              </label>
              <input
                id="fuente"
                type="text"
                value={fuente}
                onChange={(e) => setFuente(e.target.value)}
                placeholder="Observación directa, comunidad, documento oficial…"
                className="w-full rounded-md border border-hueso-100/15 bg-oceano-950/60 px-3 py-2 text-[0.8125rem] text-hueso-100 placeholder:text-grafito-500 focus:border-turquesa-500 focus:outline-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="nombre" className="mb-1.5 block text-[0.8125rem] text-hueso-200">
                  Nombre <span className="text-grafito-500">(opcional)</span>
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Puedes aportar de forma anónima"
                  className="w-full rounded-md border border-hueso-100/15 bg-oceano-950/60 px-3 py-2 text-[0.8125rem] text-hueso-100 placeholder:text-grafito-500 focus:border-turquesa-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="contacto" className="mb-1.5 block text-[0.8125rem] text-hueso-200">
                  Contacto <span className="text-grafito-500">(opcional)</span>
                </label>
                <input
                  id="contacto"
                  type="text"
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  placeholder="Solo si quieres respuesta"
                  className="w-full rounded-md border border-hueso-100/15 bg-oceano-950/60 px-3 py-2 text-[0.8125rem] text-hueso-100 placeholder:text-grafito-500 focus:border-turquesa-500 focus:outline-none"
                />
              </div>
            </div>

            <p className="text-[0.6875rem] leading-relaxed text-grafito-500">
              Los datos personales son opcionales y no se publican. No se admiten fotografías con
              personas identificables sin su consentimiento.
            </p>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!valido}
              className="inline-flex items-center gap-2 rounded-lg bg-turquesa-500 px-5 py-2.5 text-sm font-semibold text-oceano-950 transition enabled:hover:bg-turquesa-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {descargado ? <Check className="size-4" /> : <Download className="size-4" />}
              {descargado ? 'Descargado' : 'Descargar el informe'}
            </button>
            <button
              type="button"
              onClick={copiar}
              disabled={!valido}
              className="inline-flex items-center gap-2 rounded-lg border border-hueso-100/20 px-5 py-2.5 text-sm text-hueso-100 transition enabled:hover:bg-hueso-100/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copiado ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          {/* Canales de envío */}
          <div className="panel p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-hueso-200">
              Enviar el informe
            </h2>
            <p className="mt-1.5 text-[0.75rem] leading-relaxed text-grafito-400">
              Descarga o copia el informe y remítelo por cualquiera de estos canales:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={urlCorreo}
                className="inline-flex items-center gap-2 rounded-md bg-hueso-100/10 px-4 py-2 text-[0.8125rem] text-hueso-200 transition hover:bg-hueso-100/20"
              >
                <Send className="size-3.5" aria-hidden />
                Por correo
              </a>
              <a
                href={urlIncidencia}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-hueso-100/10 px-4 py-2 text-[0.8125rem] text-hueso-200 transition hover:bg-hueso-100/20"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Como incidencia en el repositorio
              </a>
            </div>
          </div>
        </form>

        {/* Vista previa del informe */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="panel overflow-hidden">
            <header className="border-b border-hueso-100/10 px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-hueso-200">
                Informe que se genera
              </h2>
              <p className="mt-0.5 text-[0.6875rem] text-grafito-500">
                Así queda registrado tu aporte, listo para revisión.
              </p>
            </header>
            <pre className="max-h-96 overflow-auto p-4 text-[0.6875rem] leading-relaxed text-turquesa-300">
              {textoInforme}
            </pre>
          </div>

          <div className="panel mt-4 p-4">
            <h3 className="text-[0.8125rem] font-semibold text-hueso-200">
              Cómo se valida un aporte
            </h3>
            <ol className="mt-2 space-y-2 text-[0.75rem] leading-relaxed text-grafito-400">
              <li className="flex gap-2">
                <span className="dato-mono text-turquesa-500">1</span>
                Se recibe el informe y se registra como pendiente.
              </li>
              <li className="flex gap-2">
                <span className="dato-mono text-turquesa-500">2</span>
                Se contrasta con una fuente: observación de campo, documento oficial o consenso
                comunitario.
              </li>
              <li className="flex gap-2">
                <span className="dato-mono text-turquesa-500">3</span>
                Si se confirma, se incorpora al repositorio de datos con su fecha y su fuente.
              </li>
              <li className="flex gap-2">
                <span className="dato-mono text-turquesa-500">4</span>
                Si no se puede verificar, se conserva como pendiente y no se publica.
              </li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
