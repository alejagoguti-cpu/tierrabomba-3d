#!/usr/bin/env node
/**
 * calcular_indicadores.ts
 * ------------------------------------------------------------------
 * Imprime en consola los indicadores territoriales calculados a partir
 * de los datos reales, sin necesidad de compilar la plataforma.
 *
 * Sirve para:
 *   - comprobar de un vistazo que los datos descargados son coherentes
 *   - revisar las cifras antes de citarlas en la memoria de la tesis
 *   - detectar capas que falten o se hayan descargado mal
 *
 * Uso (desde la raíz del repositorio):
 *   node scripts/datos/calcular_indicadores.ts
 *
 * Node 24 ejecuta TypeScript directamente, sin compilación previa.
 * ------------------------------------------------------------------
 */

import { calcularAnalitica } from '../../lib/datos/analitica.ts';

const a = calcularAnalitica();

const nf = (n: number, d = 2) =>
  n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });

console.log('\n  Indicadores territoriales de Tierra Bomba');
console.log('  ' + '='.repeat(72));
console.log('  Calculados desde los GeoJSON reales. Nada escrito a mano.\n');

const disponibles = a.indicadores.filter((i) => i.disponible);
const pendientes = a.indicadores.filter((i) => !i.disponible);

console.log(`  DISPONIBLES (${disponibles.length} de ${a.indicadores.length})\n`);
for (const i of disponibles) {
  console.log(`  ${i.etiqueta.padEnd(36)} ${i.valor.padStart(14)}`);
  console.log(`  ${''.padEnd(36)} ${i.nota}`);
  console.log(`  ${''.padEnd(36)} Fuente: ${i.fuente}\n`);
}

console.log(`  SIN DATOS (${pendientes.length})\n`);
for (const i of pendientes) {
  console.log(`  ${i.etiqueta.padEnd(36)} ${'SIN DATOS'.padStart(14)}`);
  console.log(`  ${''.padEnd(36)} Requiere: ${i.requiere ?? 'fuente no identificada'}\n`);
}

console.log('  ' + '='.repeat(72));
console.log('  USO DEL SUELO CARTografiADO\n');
for (const u of a.usoDelSuelo) {
  const km2 = u.m2 / 1e6;
  console.log(
    `  ${u.clave.padEnd(20)} ${km2.toFixed(3).padStart(9)} km²   ${u.porcentaje.toFixed(1).padStart(5)} %`
  );
}

const totalUso = a.usoDelSuelo.reduce((n, u) => n + u.m2, 0);
console.log(`\n  Total cartografiado: ${(totalUso / 1e6).toFixed(3)} km²`);
if (a.superficies.islaM2) {
  const pct = (100 * totalUso) / a.superficies.islaM2;
  console.log(
    `  Superficie de la isla: ${(a.superficies.islaM2 / 1e6).toFixed(3)} km²  ` +
      `-> se ha cartografiado el ${pct.toFixed(1)} % del uso del suelo`
  );
  if (pct < 95) {
    console.log(
      '  AVISO: la cobertura de uso del suelo es parcial. Los porcentajes se' +
        '\n         calculan sobre lo cartografiado, NO sobre la isla entera.'
    );
  }
}

if (a.estadisticasConstruccion) {
  const e = a.estadisticasConstruccion;
  console.log('\n  ' + '='.repeat(72));
  console.log('  CATASTRO OFICIAL — CONSTRUCCIONES\n');
  console.log(`  Total de construcciones      : ${e.total.toLocaleString('es-CO')}`);
  console.log(
    `  Con altura registrada        : ${e.conAltura.toLocaleString('es-CO')} ` +
      `(${((100 * e.conAltura) / e.total).toFixed(1)} %)`
  );
  console.log(`  Altura media                 : ${e.alturaMedia ? nf(e.alturaMedia) + ' m' : '—'}`);
  console.log(`  Altura maxima                : ${e.alturaMaxima ? nf(e.alturaMaxima) + ' m' : '—'}`);
  console.log(`  Pisos (mediana)              : ${e.pisosMediana ?? '—'}`);
  console.log(
    `  Construcciones de 1 planta   : ${e.porcentajeUnaPlanta ? nf(e.porcentajeUnaPlanta, 1) + ' %' : '—'}`
  );
  console.log(
    `  Area construida total        : ${(e.areaConstruidaTotalM2 / 1e4).toFixed(2)} ha`
  );
  console.log(`  Area construida media        : ${e.areaConstruidaMediaM2 ? nf(e.areaConstruidaMediaM2) + ' m²' : '—'}`);
}

console.log('\n  ' + '='.repeat(72));
console.log(
  `  Densidad: ${a.densidad.construccionesPorKm2 ? nf(a.densidad.construccionesPorKm2, 1) : '—'} construcciones/km²`
);
console.log();
