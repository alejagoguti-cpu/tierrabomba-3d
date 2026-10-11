import type { Metadata } from 'next';
import { TriangleAlert } from 'lucide-react';
import { VisorModelo } from '@/components/proyectos/VisorModelo';
import { TipologiaVivienda } from '@/components/proyectos/TipologiaVivienda';
import { VisorIFC } from '@/components/proyectos/VisorIFC';

export const metadata: Metadata = {
  title: 'Proyectos arquitectónicos',
  description:
    'Visor 3D del modelo del equipamiento propuesto y de la tipología de vivienda a dos aguas del caserío de Tierra Bomba.',
};

export default function PaginaProyectos() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="max-w-3xl">
        <p className="dato-mono text-turquesa-500 uppercase tracking-[0.18em]">
          Arquitectura
        </p>
        <h1 className="mt-2 font-display text-titulo text-hueso-100">Proyectos</h1>
        <p className="mt-3 text-base leading-relaxed text-grafito-400">
          El modelo del equipamiento propuesto para la meseta segura y la tipología de vivienda
          del caserío, esta última construida con geometría paramétrica para poder ajustar
          cubierta, huecos y materiales.
        </p>
      </header>

      {/* Modelo del equipamiento */}
      <section className="mt-8">
        <div className="mb-3">
          <h2 className="font-display text-xl text-hueso-100">Equipamiento propuesto</h2>
          <p className="mt-1 max-w-3xl text-[0.8125rem] leading-relaxed text-grafito-400">
            Modelo exportado de Revit y convertido a glTF binario. Puedes orbitar, filtrar por
            familia de material y despiezar el modelo por cotas.
          </p>
        </div>
        <VisorModelo />
      </section>

      {/* Aviso sobre el modelo */}
      <section className="mt-4 flex gap-3 rounded-xl border border-hueso-100/10 bg-oceano-900/40 p-4">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-grafito-500" aria-hidden />
        <p className="text-[0.75rem] leading-relaxed text-grafito-400">
          <strong className="text-hueso-200">Sobre el modelo.</strong> Proviene de una exportación
          OBJ de Revit (Autodesk ATF) convertida con <code className="dato-mono">obj2gltf</code>:
          1.087.522 triángulos en 4.472 mallas y 6 materiales, con 40,3 MB. No incluye metadatos
          BIM —para eso hace falta un IFC— ni planos asociados. El modelo está en coordenadas
          internas del proyecto, por lo que se muestra aislado y <strong>no superpuesto al
          territorio</strong>.
        </p>
      </section>

      {/* Tipología del caserío */}
      <section className="mt-12">
        <div className="mb-3">
          <h2 className="font-display text-xl text-hueso-100">
            Tipología de vivienda del caserío
          </h2>
          <p className="mt-1 max-w-3xl text-[0.8125rem] leading-relaxed text-grafito-400">
            Vivienda paramétrica con <strong className="text-hueso-200">tejado a dos aguas</strong>,
            ventanas, puerta y materiales configurables. Los valores iniciales no son inventados:
            salen del catastro oficial.
          </p>
        </div>

        {/* Base tipológica, con su fuente */}
        <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
          <DatoBase
            valor="3,00 m"
            etiqueta="Alto de muro"
            fuente="Catastro · altura_tot, media de 2.687 construcciones registradas"
          />
          <DatoBase
            valor="1 planta"
            etiqueta="Número de pisos"
            fuente="Catastro · total_piso, mediana = 1 en las 2.714 construcciones"
          />
          <DatoBase
            valor="72,5 m²"
            etiqueta="Área construida media"
            fuente="Catastro · area_total. El ancho y el fondo son ajustables porque el catastro no los registra"
          />
        </div>

        <TipologiaVivienda />
      </section>

      {/* Modelo BIM: lectura de IFC */}
      <section className="mt-12">
        <div className="mb-3">
          <h2 className="font-display text-xl text-hueso-100">Modelo BIM (IFC)</h2>
          <p className="mt-1 max-w-3xl text-[0.8125rem] leading-relaxed text-grafito-400">
            Lectura de archivos IFC con <strong className="text-hueso-200">web-ifc</strong>, el
            motor de That Open Engine. Extrae la geometría y los datos BIM reales del archivo:
            tipos de elemento, recuento y niveles. <strong>Todo ocurre en tu navegador</strong>: el
            archivo no se envía a ningún servidor.
          </p>
        </div>
        <VisorIFC />
      </section>

      {/* Nota metodológica */}
      <section className="mt-4 rounded-xl border border-hueso-100/10 bg-oceano-900/40 p-4">
        <h3 className="text-[0.8125rem] font-semibold text-hueso-200">
          Por qué esta vivienda se genera y no se importa
        </h3>
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-grafito-400">
          MapLibre GL —el motor del visor territorial— solo produce prismas de tapa plana: no
          puede representar un tejado inclinado. Esta vivienda se construye vértice a vértice en
          three.js, de modo que la pendiente de la cubierta, el vuelo del alero y los huecos de
          fachada son geometría real y editable.
        </p>
        <p className="mt-2 text-[0.75rem] leading-relaxed text-grafito-400">
          La cubierta es de <strong className="text-hueso-200">lámina de acero corrugado</strong>,
          no de teja de barro: es el material del caserío de Tierra Bomba. La textura es
          procedural, generada con{' '}
          <code className="dato-mono">scripts/datos/generar_texturas.py</code>.
        </p>
      </section>
    </div>
  );
}

function DatoBase({
  valor,
  etiqueta,
  fuente,
}: {
  valor: string;
  etiqueta: string;
  fuente: string;
}) {
  return (
    <div className="rounded-lg border border-hueso-100/10 bg-oceano-900/50 p-3.5">
      <p className="font-display text-xl leading-none text-hueso-100">{valor}</p>
      <p className="mt-1 text-[0.6875rem] text-turquesa-400">{etiqueta}</p>
      <p className="mt-1.5 text-[0.625rem] leading-snug text-grafito-500">{fuente}</p>
    </div>
  );
}
