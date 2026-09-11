import { calcularPrestamoTasaFijaMensual, corregirFechasPorCorte } from '../src/lib/finanzas.ts';

// Simular cálculo con la configuración nueva
// fechaInicioAmortizacion: Sept 5, 2026 → cuota 1 = Sept 5 + 15 = Sept 20 ✓
const calc = calcularPrestamoTasaFijaMensual({
  montoPrincipal: 200000,
  tasaMensualFija: 25,
  numeroCuotas: 4,
  frecuencia: 'QUINCENAL',
  fechaDesembolso: new Date('2026-09-05T17:00:00.000Z'),
});

console.log('=== Tabla SIN corrección (aritmética +15 días) ===');
calc.tablaAmortizacion.forEach(c => {
  const f = c.fechaVencimiento.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${c.numero}: ${f}`);
});

console.log('\n=== Tabla CON corrección 5-20 ===');
const corr = corregirFechasPorCorte(calc.tablaAmortizacion, '5-20');
corr.forEach(c => {
  const f = c.fechaVencimiento.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  console.log(`Cuota ${c.numero}: ${f} | $${c.montoCuota}`);
});
