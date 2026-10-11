/**
 * Catálogo de capas de TIERRA BOMBA 3D
 * ==================================================================
 * Define las capas que el visor puede mostrar. Es la única fuente de
 * verdad: la usan el visor, el panel de capas, la página de datos y
 * las leyendas. Añadir una capa en un solo sitio la propaga a toda la
 * plataforma.
 *
 * IMPORTANTE: aquí NO hay datos inventados. Cada capa corresponde a un
 * archivo GeoJSON real en data/, descargado de una fuente documentada.
 * Los recuentos y las fechas reales se inyectan en tiempo de
 * compilación desde data/osm/manifiesto.json (ver lib/datos/servidor.ts).
 * ==================================================================
 */

/** Categorías del panel de capas, en el orden en que se muestran. */
export const CATEGORIAS = [
  {
    id: 'territorio',
    titulo: 'Territorio',
    descripcion: 'Límite, usos del suelo y base geográfica del área de estudio.',
    icono: 'territorio',
  },
  {
    id: 'catastro',
    titulo: 'Catastro oficial',
    descripcion:
      'Cartografía catastral del área metropolitana de Cartagena, recortada a la isla y reproyectada a WGS 84.',
    icono: 'catastro',
  },
  {
    id: 'equipamientos',
    titulo: 'Equipamientos',
    descripcion: 'Servicios comunitarios, educación, salud, culto, comercio y recreación.',
    icono: 'equipamientos',
  },
  {
    id: 'movilidad',
    titulo: 'Movilidad',
    descripcion: 'Vías, senderos, accesos y conectividad peatonal.',
    icono: 'movilidad',
  },
  {
    id: 'ambiente',
    titulo: 'Ambiente',
    descripcion: 'Vegetación, playas, humedales, hidrografía y elementos naturales.',
    icono: 'ambiente',
  },
  {
    id: 'construccion',
    titulo: 'Construcción',
    descripcion: 'Edificaciones existentes, proyectos propuestos y modelos 3D.',
    icono: 'construccion',
  },
] as const;

export type IdCategoria = (typeof CATEGORIAS)[number]['id'];

export type TipoGeometria = 'punto' | 'linea' | 'poligono' | 'mixta';

/**
 * Estado de validación de una capa. Determina cómo se etiqueta en la
 * interfaz: es la diferencia entre "dato oficial" y "dato de la
 * comunidad que aún no ha pasado revisión".
 */
export type EstadoValidacion =
  | 'oficial'
  | 'colaborativo-verificado'
  | 'pendiente'
  | 'simulado';

export const ETIQUETA_ESTADO: Record<
  EstadoValidacion,
  { texto: string; descripcion: string; color: string }
> = {
  oficial: {
    texto: 'Oficial',
    descripcion: 'Fuente oficial reconocida (entidad pública o levantamiento autorizado).',
    color: 'var(--color-oficial)',
  },
  'colaborativo-verificado': {
    texto: 'Colaborativo verificado',
    descripcion:
      'Generado por la comunidad (OpenStreetMap) y contrastado. No equivale a un levantamiento oficial.',
    color: 'var(--color-verificado)',
  },
  pendiente: {
    texto: 'Pendiente de validación',
    descripcion: 'Información aportada por terceros que aún no ha sido revisada.',
    color: 'var(--color-pendiente)',
  },
  simulado: {
    texto: 'Simulación',
    descripcion:
      'Escenario hipotético generado para análisis. No representa una situación real.',
    color: 'var(--color-simulado)',
  },
};

export interface DefinicionCapa {
  /** Identificador estable. Se usa como id de capa en MapLibre. */
  id: string;
  titulo: string;
  descripcion: string;
  categoria: IdCategoria;
  /** Ruta pública del GeoJSON (se sirve desde /datos/...). */
  archivo: string;
  /** Color de la capa, en formato CSS hex. */
  color: string;
  geometria: TipoGeometria;
  /** Si la capa viene activada al abrir el visor. */
  visibleInicial: boolean;
  fuente: string;
  fuenteUrl: string;
  licencia: string;
  attribution: string;
  estadoValidacion: EstadoValidacion;
  limitaciones: string;
  /** Se inyectan desde el manifiesto en tiempo de compilación. */
  entidades?: number;
  fechaDescarga?: string;
  pesoKb?: number;
}

/**
 * Capas vectoriales reales del proyecto.
 * Todas proceden de OpenStreetMap salvo el límite insular, que se
 * obtuvo de la misma fuente vía Nominatim y se simplificó.
 */
export const CAPAS: DefinicionCapa[] = [
  // ---------------------------------------------------------------
  //  TERRITORIO
  // ---------------------------------------------------------------
  {
    id: 'limite-isla',
    titulo: 'Límite de la isla',
    descripcion:
      'Contorno de la isla de Tierra Bomba. Se usa como marco del área de estudio y para recortar las demás capas.',
    categoria: 'territorio',
    archivo: '/datos/ligero/limite_isla.geojson',
    color: '#D9C6A3',
    geometria: 'poligono',
    visibleInicial: true,
    fuente: 'OpenStreetMap (vía Nominatim)',
    fuenteUrl: 'https://www.openstreetmap.org/relation/11226348',
    licencia: 'ODbL 1.0',
    attribution: '© OpenStreetMap contributors',
    estadoValidacion: 'colaborativo-verificado',
    limitaciones:
      'Es un límite de la comunidad OpenStreetMap simplificado a ~11 m de tolerancia, NO un levantamiento topográfico. No debe usarse para calcular áreas ni tasas de retroceso costero.',
  },
  {
    id: 'usos-suelo',
    titulo: 'Usos del suelo',
    descripcion: 'Clasificación del suelo registrada en OpenStreetMap.',
    categoria: 'territorio',
    archivo: '/datos/osm/usos_suelo.geojson',
    color: '#527F68',
    geometria: 'poligono',
    visibleInicial: true,
    fuente: 'OpenStreetMap',
    fuenteUrl: 'https://www.openstreetmap.org/',
    licencia: 'ODbL 1.0',
    attribution: '© OpenStreetMap contributors',
    estadoValidacion: 'colaborativo-verificado',
    limitaciones:
      'Cobertura muy parcial: solo se cartografían las áreas que la comunidad ha registrado. La ausencia de una categoría no significa que no exista en el territorio.',
  },

  // ---------------------------------------------------------------
  //  CATASTRO OFICIAL
  //  Fuente: cartografía catastral del área metropolitana de
  //  Cartagena. Llega en MAGNA-SIRGAS Origen Nacional (EPSG:9377),
  //  se recorta a la isla y se reproyecta a WGS 84 con proj4.
  // ---------------------------------------------------------------
  {
    id: 'catastro-construccion',
    titulo: 'Construcciones (catastro)',
    descripcion:
      'Huellas de construcción del catastro oficial con número de pisos, altura total y área construida registrados por la entidad catastral.',
    categoria: 'catastro',
    archivo: '/datos/oficial/construccion.geojson',
    color: '#39B8B0',
    geometria: 'poligono',
    visibleInicial: true,
    fuente: 'Catastro oficial · Área Metropolitana de Cartagena',
    fuenteUrl: 'https://www.cartagena.gov.co/',
    licencia: 'Uso institucional — verificar condiciones con la entidad productora',
    attribution: 'Catastro municipal de Cartagena de Indias',
    estadoValidacion: 'oficial',
    limitaciones:
      'La altura y el número de pisos son los registrados por la entidad catastral y pueden no reflejar el estado construido actual. El recorte a la isla se hizo con el límite de OpenStreetMap más un margen de 250 m, por lo que pueden faltar predios periféricos o colarse algunos del continente.',
  },
  {
    id: 'catastro-predios',
    titulo: 'Predios (catastro)',
    descripcion:
      'Terrenos o lotes del catastro oficial, con su código catastral y la manzana a la que pertenecen.',
    categoria: 'catastro',
    archivo: '/datos/oficial/predios.geojson',
    color: '#D9C6A3',
    geometria: 'poligono',
    visibleInicial: false,
    fuente: 'Catastro oficial · Área Metropolitana de Cartagena',
    fuenteUrl: 'https://www.cartagena.gov.co/',
    licencia: 'Uso institucional — verificar condiciones con la entidad productora',
    attribution: 'Catastro municipal de Cartagena de Indias',
    estadoValidacion: 'oficial',
    limitaciones:
      'No incluye avalúo, propietario ni destino económico: solo la geometría y el código catastral. Para información jurídica o fiscal hay que acudir a la entidad catastral.',
  },
  {
    id: 'catastro-manzanas',
    titulo: 'Manzanas (catastro)',
    descripcion: 'División por manzanas del catastro oficial, con su código y nombre.',
    categoria: 'catastro',
    archivo: '/datos/oficial/manzanas.geojson',
    color: '#6B9A80',
    geometria: 'poligono',
    visibleInicial: false,
    fuente: 'Catastro oficial · Área Metropolitana de Cartagena',
    fuenteUrl: 'https://www.cartagena.gov.co/',
    licencia: 'Uso institucional — verificar condiciones con la entidad productora',
    attribution: 'Catastro municipal de Cartagena de Indias',
    estadoValidacion: 'oficial',
    limitaciones:
      'Muchas manzanas de la isla figuran sin nombre registrado. El nombre no implica una denominación oficial vigente.',
  },
  {
    id: 'catastro-barrios',
    titulo: 'Barrios (catastro)',
    descripcion: 'Delimitación de barrios según el catastro oficial.',
    categoria: 'catastro',
    archivo: '/datos/oficial/barrios.geojson',
    color: '#E4D7BD',
    geometria: 'poligono',
    visibleInicial: false,
    fuente: 'Catastro oficial · Área Metropolitana de Cartagena',
    fuenteUrl: 'https://www.cartagena.gov.co/',
    licencia: 'Uso institucional — verificar condiciones con la entidad productora',
    attribution: 'Catastro municipal de Cartagena de Indias',
    estadoValidacion: 'oficial',
    limitaciones:
      'La delimitación catastral de barrios puede no coincidir con la percepción comunitaria del territorio ni con otras divisiones administrativas.',
  },
  {
    id: 'catastro-veredas',
    titulo: 'Veredas (catastro)',
    descripcion: 'Delimitación de veredas —división rural— según el catastro oficial.',
    categoria: 'catastro',
    archivo: '/datos/oficial/veredas.geojson',
    color: '#527F68',
    geometria: 'poligono',
    visibleInicial: false,
    fuente: 'Catastro oficial · Área Metropolitana de Cartagena',
    fuenteUrl: 'https://www.cartagena.gov.co/',
    licencia: 'Uso institucional — verificar condiciones con la entidad productora',
    attribution: 'Catastro municipal de Cartagena de Indias',
    estadoValidacion: 'oficial',
    limitaciones:
      'Incluye veredas del continente que caen dentro del margen de recorte. Verificar antes de usar como límite administrativo.',
  },
  {
    id: 'catastro-sectores',
    titulo: 'Sectores rurales (catastro)',
    descripcion: 'Sectores rurales del catastro oficial.',
    categoria: 'catastro',
    archivo: '/datos/oficial/sectores-rurales.geojson',
    color: '#3D6350',
    geometria: 'poligono',
    visibleInicial: false,
    fuente: 'Catastro oficial · Área Metropolitana de Cartagena',
    fuenteUrl: 'https://www.cartagena.gov.co/',
    licencia: 'Uso institucional — verificar condiciones con la entidad productora',
    attribution: 'Catastro municipal de Cartagena de Indias',
    estadoValidacion: 'oficial',
    limitaciones: 'Capa de referencia para el análisis; no sustituye la normativa del POT.',
  },
  {
    id: 'catastro-unidades',
    titulo: 'Unidades de construcción (catastro)',
    descripcion:
      'Unidades de construcción del catastro: tipo de planta, tipo de construcción y tipo de dominio.',
    categoria: 'catastro',
    archivo: '/datos/oficial/unidades-construccion.geojson',
    color: '#5FCBC4',
    geometria: 'poligono',
    visibleInicial: false,
    fuente: 'Catastro oficial · Área Metropolitana de Cartagena',
    fuenteUrl: 'https://www.cartagena.gov.co/',
    licencia: 'Uso institucional — verificar condiciones con la entidad productora',
    attribution: 'Catastro municipal de Cartagena de Indias',
    estadoValidacion: 'oficial',
    limitaciones:
      'Es la capa más numerosa del catastro. Puede afectar al rendimiento si se activa junto con otras capas pesadas en equipos modestos.',
  },

  // ---------------------------------------------------------------
  //  CONSTRUCCIÓN
  // ---------------------------------------------------------------
  {
    id: 'edificaciones',
    titulo: 'Edificaciones (OpenStreetMap)',
    descripcion:
      'Huellas de edificación registradas en OpenStreetMap. Se representan como volúmenes esquemáticos cuando no se conoce su altura.',
    categoria: 'construccion',
    archivo: '/datos/osm/edificaciones.geojson',
    color: '#D9C6A3',
    geometria: 'poligono',
    visibleInicial: false,
    fuente: 'OpenStreetMap',
    fuenteUrl: 'https://www.openstreetmap.org/',
    licencia: 'ODbL 1.0',
    attribution: '© OpenStreetMap contributors',
    estadoValidacion: 'colaborativo-verificado',
    limitaciones:
      'La inmensa mayoría de las edificaciones NO tiene altura ni número de niveles registrados (solo 2 de 827 en esta isla). En el visor 3D se extruyen con una altura aproximada declarada. Para alturas con dato oficial, usa la capa de construcciones del catastro.',
  },

  // ---------------------------------------------------------------
  //  EQUIPAMIENTOS
  // ---------------------------------------------------------------
  {
    id: 'equipamientos',
    titulo: 'Equipamientos y servicios',
    descripcion:
      'Equipamientos comunitarios y servicios: educación, salud, culto, deporte, comercio y servicios.',
    categoria: 'equipamientos',
    archivo: '/datos/osm/equipamientos.geojson',
    color: '#39B8B0',
    geometria: 'punto',
    visibleInicial: true,
    fuente: 'OpenStreetMap',
    fuenteUrl: 'https://www.openstreetmap.org/',
    licencia: 'ODbL 1.0',
    attribution: '© OpenStreetMap contributors',
    estadoValidacion: 'colaborativo-verificado',
    limitaciones:
      'Inventario muy incompleto: OpenStreetMap registra un número reducido de equipamientos en la isla. La ausencia de un equipamiento en esta capa NO significa que no exista.',
  },

  // ---------------------------------------------------------------
  //  MOVILIDAD
  // ---------------------------------------------------------------
  {
    id: 'vias',
    titulo: 'Vías y senderos',
    descripcion:
      'Red de movilidad: vías vehiculares, caminos, senderos peatonales y accesos.',
    categoria: 'movilidad',
    archivo: '/datos/osm/vias.geojson',
    color: '#F6F4EF',
    geometria: 'linea',
    visibleInicial: true,
    fuente: 'OpenStreetMap',
    fuenteUrl: 'https://www.openstreetmap.org/',
    licencia: 'ODbL 1.0',
    attribution: '© OpenStreetMap contributors',
    estadoValidacion: 'colaborativo-verificado',
    limitaciones:
      'La clasificación vial y el estado del firme son heterogéneos. Muchos senderos están marcados como transitables a pie o en moto, sin ancho ni superficie registrados.',
  },

  // ---------------------------------------------------------------
  //  AMBIENTE
  // ---------------------------------------------------------------
  {
    id: 'natural',
    titulo: 'Elementos naturales',
    descripcion:
      'Playas, vegetación, humedales y otros elementos naturales cartografiados.',
    categoria: 'ambiente',
    archivo: '/datos/osm/natural.geojson',
    color: '#6B9A80',
    geometria: 'mixta',
    visibleInicial: false,
    fuente: 'OpenStreetMap',
    fuenteUrl: 'https://www.openstreetmap.org/',
    licencia: 'ODbL 1.0',
    attribution: '© OpenStreetMap contributors',
    estadoValidacion: 'colaborativo-verificado',
    limitaciones:
      'Los manglares solo aparecen si están documentados en OpenStreetMap. No hay datos oficiales de ecosistemas integrados en esta versión.',
  },
  {
    id: 'hidrografia',
    titulo: 'Hidrografía',
    descripcion: 'Cursos de agua, caños, cuerpos de agua y zonas de varadero.',
    categoria: 'ambiente',
    archivo: '/datos/osm/hidrografia.geojson',
    color: '#39B8B0',
    geometria: 'mixta',
    visibleInicial: false,
    fuente: 'OpenStreetMap',
    fuenteUrl: 'https://www.openstreetmap.org/',
    licencia: 'ODbL 1.0',
    attribution: '© OpenStreetMap contributors',
    estadoValidacion: 'colaborativo-verificado',
    limitaciones:
      'Cartografía incompleta de la red hídrica. No incluye datos de calidad del agua ni de salinización de pozos.',
  },
];

/** Devuelve una capa por su id. */
export function obtenerCapa(id: string): DefinicionCapa | undefined {
  return CAPAS.find((c) => c.id === id);
}

/** Capas de una categoría concreta. */
export function capasDeCategoria(categoria: IdCategoria): DefinicionCapa[] {
  return CAPAS.filter((c) => c.categoria === categoria);
}

// ==================================================================
//  ÁREA DE ESTUDIO
//  Coordenadas verificadas contra OpenStreetMap (relation/11226348).
// ==================================================================
export const AREA_ESTUDIO = {
  nombre: 'Isla de Tierra Bomba',
  municipio: 'Cartagena de Indias',
  departamento: 'Bolívar',
  pais: 'Colombia',
  centro: { lat: 10.34975, lng: -75.5705 },
  limites: { sur: 10.31803, norte: 10.38149, oeste: -75.59341, este: -75.53745 },
  osmRelacion: 11226348,
  /** Encuadre inicial del visor. */
  zoomInicial: 13.4,
  /** [oeste, sur, este, norte] — formato de MapLibre. */
  bounds: [-75.59341, 10.31803, -75.53745, 10.38149] as [number, number, number, number],
};
