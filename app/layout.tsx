import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'TIERRA BOMBA 3D — Plataforma de información territorial',
    template: '%s · TIERRA BOMBA 3D',
  },
  description:
    'Plataforma interactiva de inteligencia territorial, arquitectura y construcción de la isla de Tierra Bomba, Cartagena de Indias. Gemelo digital 3D, sistema de información geográfica, catálogo de equipamientos y visor BIM.',
  applicationName: 'TIERRA BOMBA 3D',
  authors: [{ name: 'Alejandra Gómez' }, { name: 'Ana Casas' }],
  keywords: [
    'Tierra Bomba',
    'Cartagena de Indias',
    'Colombia',
    'gemelo digital',
    'SIG',
    'GIS',
    'arquitectura',
    'urbanismo',
    'BIM',
    'catastro',
    'equipamientos',
  ],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    title: 'TIERRA BOMBA 3D',
    description:
      'Plataforma de información territorial, arquitectura y transformación de la isla de Tierra Bomba.',
    siteName: 'TIERRA BOMBA 3D',
  },
};

export const viewport: Viewport = {
  themeColor: '#102C3B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">
        {/* Enlace de salto: primera parada del teclado, requisito de accesibilidad */}
        <a
          href="#contenido-principal"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-turquesa-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-oceano-950"
        >
          Saltar al contenido principal
        </a>
        {children}
      </body>
    </html>
  );
}
