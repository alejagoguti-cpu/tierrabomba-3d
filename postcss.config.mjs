/**
 * PostCSS para Tailwind CSS v4.
 * En la version 4 el plugin es @tailwindcss/postcss y la configuracion
 * del tema vive en CSS (bloque @theme en app/globals.css), no en un
 * archivo tailwind.config.js.
 */
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
