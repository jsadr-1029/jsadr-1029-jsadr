// Verificación de la renovación de CAROLINA ALVAREZ
// Préstamo original: PREST-CA-1214726347-20260719-02
// Préstamo nuevo: CA-CC-1214726347-20260809-04

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n=================================================');
  console.log('VERIFICACIÓN RENOVACIÓN - CAROLINA ALVAREZ');
  console.log('=================================================\n');

  // 1. Buscar el préstamo original
  const original = await prisma.prestamo.findFirst({
    where: { codigo: 'PREST-CA-1214726347-20260719-02' },
    include: {
      cliente: true,
      pagosProgramados: { orderBy: { numeroCuota: 'asc' } },
    },
  });

  console.log('▶ PRÉSTAMO ORIGINAL (debe estar CANCELADO):');
  if (!original) {
    console.log('  ❌ NO ENCONTRADO');
  } else {
    console.log('  Código:', original.codigo);
    console.log('  Cliente:', original.cliente?.nombre);
    console.log('  Estado:', original.estado);
    console.log('  Monto principal:', original.montoPrincipal);
    console.log('  Tasa anual:', original.tasaInteresAnual, '%');
    console.log('  Plazo meses:', original.plazoMeses);
    console.log('  Frecuencia:', original.frecuencia);
    console.log('  Modalidad amortización:', original.modalidadAmortizacion);
    console.log('  Saldo pendiente:', original.saldoPendiente);
    console.log('  Total a pagar:', original.totalAPagar);
    console.log('  Total interés:', original.totalInteres);
    console.log('  Fecha de creación:', original.fechaCreacion);
    console.log('  Cuotas:', original.pagosProgramados?.length || 0);
    if (original.pagosProgramados?.length > 0) {
      console.log('  Estado cuotas:', original.pagosProgramados.map(c => c.estado).join(', '));
    }
  }

  // 2. Buscar el nuevo préstamo
  const nuevo = await prisma.prestamo.findFirst({
    where: { codigo: 'CA-CC-1214726347-20260809-04' },
    include: {
      cliente: true,
      pagosProgramados: { orderBy: { numeroCuota: 'asc' } },
    },
  });

  console.log('\n▶ PRÉSTAMO NUEVO (debe tener condiciones modificadas):');
  if (!nuevo) {
    console.log('  ❌ NO ENCONTRADO');
  } else {
    console.log('  Código:', nuevo.codigo);
    console.log('  Cliente:', nuevo.cliente?.nombre);
    console.log('  Estado:', nuevo.estado);
    console.log('  Monto principal:', nuevo.montoPrincipal);
    console.log('  Tasa anual:', nuevo.tasaInteresAnual, '%');
    console.log('  Plazo meses:', nuevo.plazoMeses);
    console.log('  Frecuencia:', nuevo.frecuencia);
    console.log('  Modalidad amortización:', nuevo.modalidadAmortizacion);
    console.log('  Saldo pendiente:', nuevo.saldoPendiente);
    console.log('  Total a pagar:', nuevo.totalAPagar);
    console.log('  Total interés:', nuevo.totalInteres);
    console.log('  Fecha de creación:', nuevo.fechaCreacion);
    console.log('  Cuotas:', nuevo.pagosProgramados?.length || 0);
    if (nuevo.pagosProgramados?.length > 0) {
      console.log('  Primera cuota:', nuevo.pagosProgramados[0]);
    }
  }

  // 3. Buscar el registro RenovacionPrestamo
  const renovacion = await prisma.renovacionPrestamo.findFirst({
    where: {
      OR: [
        { prestamoOriginalId: original?.id },
        { prestamoNuevoId: nuevo?.id },
      ],
    },
  });

  console.log('\n▶ REGISTRO RENOVACIONPRESTAMO (auditoría):');
  if (!renovacion) {
    console.log('  ❌ NO ENCONTRADO');
  } else {
    console.log('  ID:', renovacion.id);
    console.log('  Préstamo original ID:', renovacion.prestamoOriginalId);
    console.log('  Préstamo nuevo ID:', renovacion.prestamoNuevoId);
    console.log('  Saldo anterior:', renovacion.saldoAnterior);
    console.log('  Nuevo monto:', renovacion.nuevoMontoPrestado);
    console.log('  Nueva tasa anual:', renovacion.nuevaTasaInteresAnual, '%');
    console.log('  Nuevo plazo meses:', renovacion.nuevoPlazoMeses);
    console.log('  Nueva frecuencia:', renovacion.nuevaFrecuencia);
    console.log('  Nuevo número cuotas:', renovacion.nuevoNumeroCuotas);
    console.log('  Nueva monto cuota:', renovacion.nuevaMontoCuota);
    console.log('  Nuevo total interés:', renovacion.nuevoTotalInteres);
    console.log('  Nuevo total pagar:', renovacion.nuevoTotalPagar);
    console.log('  Fecha inicio pago:', renovacion.fechaInicioPago);
    console.log('  Motivo renovación:', renovacion.motivoRenovacion);
    console.log('  Usuario:', renovacion.usuarioNombre);
    console.log('  Fecha creación:', renovacion.fechaCreacion);
  }

  // 4. Resumen comparativo
  console.log('\n=================================================');
  console.log('RESUMEN COMPARATIVO');
  console.log('=================================================');
  if (original && nuevo) {
    console.log('Campo               | Original              | Nuevo');
    console.log('--------------------|-----------------------|--------------------');
    console.log(`Estado              | ${String(original.estado).padEnd(22)}| ${nuevo.estado}`);
    console.log(`Monto principal     | ${String(original.montoPrincipal).padEnd(22)}| ${nuevo.montoPrincipal}`);
    console.log(`Tasa anual          | ${String(original.tasaInteresAnual + '%').padEnd(22)}| ${nuevo.tasaInteresAnual}%`);
    console.log(`Plazo meses         | ${String(original.plazoMeses).padEnd(22)}| ${nuevo.plazoMeses}`);
    console.log(`Frecuencia          | ${String(original.frecuencia).padEnd(22)}| ${nuevo.frecuencia}`);
    console.log(`Saldo pendiente     | ${String(original.saldoPendiente).padEnd(22)}| ${nuevo.saldoPendiente}`);
  }

  // 5. Verificar que las cuotas del original fueron canceladas/saldadas
  if (original && original.pagosProgramados?.length > 0) {
    console.log('\n▶ CUOTAS DEL PRÉSTAMO ORIGINAL (estados):');
    for (const c of original.pagosProgramados) {
      console.log(`  Cuota #${c.numeroCuota}: monto=${c.montoCuota} saldo=${c.saldoPendiente || 0} estado=${c.estado}`);
    }
  }

  // 6. Verificar cuotas del nuevo préstamo
  if (nuevo && nuevo.pagosProgramados?.length > 0) {
    console.log('\n▶ CUOTAS DEL PRÉSTAMO NUEVO (estados):');
    for (const c of nuevo.pagosProgramados) {
      console.log(`  Cuota #${c.numeroCuota}: monto=${c.montoCuota} saldo=${c.saldoPendiente || 0} estado=${c.estado} vence=${c.fechaVencimiento?.toISOString()}`);
    }
  }
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
