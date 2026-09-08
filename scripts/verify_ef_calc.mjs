import { calcularPrestamoTasaFijaMensual, corregirFechasPorCorte } from '../src/lib/finanzas.ts';

// Same params as the loan
const calculo = calcularPrestamoTasaFijaMensual({
  montoPrincipal: 200000,
  tasaMensualFija: 25,
  numeroCuotas: 2,
  frecuencia: 'QUINCENAL',
  fechaDesembolso: new Date('2026-08-31T17:00:00.000Z'),
});

console.log('=== Tabla de Amortización (antes de corregir) ===');
calculo.tablaAmortizacion.forEach((c) => {
  console.log(`Cuota ${c.numero}: ${c.fechaVencimiento.toISOString()} | monto: ${c.montoCuota} | capital: ${c.capital} | interes: ${c.interes}`);
});

const corregida = corregirFechasPorCorte(calculo.tablaAmortizacion, null);
console.log('\n=== Tabla de Amortización (después de corregir) ===');
corregida.forEach((c) => {
  console.log(`Cuota ${c.numero}: ${c.fechaVencimiento.toISOString()} | monto: ${c.montoCuota} | capital: ${c.capital} | interes: ${c.interes}`);
});

console.log('\n=== Formateado en zona Bogota ===');
corregida.forEach((c) => {
  const f = c.fechaVencimiento.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${c.numero}: ${f}`);
});
