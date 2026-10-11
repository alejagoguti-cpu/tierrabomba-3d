/**
 * Mapa de rutas de la plataforma.
 * Fuente única para la barra de navegación, el pie y la página de inicio.
 */

export interface RutaApp {
  href: string;
  titulo: string;
  descripcion: string;
  /** Módulo ya implementado o todavía en desarrollo. */
  estado: 'listo' | 'en-desarrollo';
}

export const RUTAS: RutaApp[] = [
  {
    href: '/explorar',
    titulo: 'Explorar',
    descripcion: 'Visor territorial 3D con capas, medición y fichas de elementos.',
    estado: 'listo',
  },
  {
    href: '/equipamientos',
    titulo: 'Equipamientos',
    descripcion: 'Catálogo y análisis de los servicios comunitarios de la isla.',
    estado: 'listo',
  },
  {
    href: '/construcciones',
    titulo: 'Construcciones',
    descripcion: 'Inventario de edificaciones registradas y su estado de documentación.',
    estado: 'listo',
  },
  {
    href: '/proyectos',
    titulo: 'Proyectos',
    descripcion: 'Modelos arquitectónicos y propuestas georreferenciadas.',
    estado: 'listo',
  },
  {
    href: '/ambiente',
    titulo: 'Ambiente',
    descripcion: 'Vegetación, hidrografía y elementos naturales cartografiados.',
    estado: 'en-desarrollo',
  },
  {
    href: '/analisis',
    titulo: 'Análisis',
    descripcion: 'Herramientas territoriales: cobertura, accesibilidad y pendientes.',
    estado: 'listo',
  },
  {
    href: '/participa',
    titulo: 'Participa',
    descripcion: 'Aporta correcciones y reporta equipamientos faltantes.',
    estado: 'en-desarrollo',
  },
  {
    href: '/datos',
    titulo: 'Datos',
    descripcion: 'Catálogo de fuentes, licencias, metadatos y descargas.',
    estado: 'listo',
  },
];

/** Rutas que ya funcionan, para enlazar solo lo que existe. */
export const RUTAS_LISTAS = RUTAS.filter((r) => r.estado === 'listo');
