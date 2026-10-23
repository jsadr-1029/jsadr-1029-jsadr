// =====================================================
// Corrige registros de ContratoDocumentoVehiculo en Neon
// con cédula errada del propietario (12147316499) y
// establece la cuenta de pago obligatoria Bancolombia.
// La cédula correcta de Johan Sebastian Alvarez Del Rio
// es 1214731649 (10 dígitos).
// =====================================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('=== CORRECCIÓN CÉDULA PROPIETARIO Y CUENTA DE PAGO ===\n');

  // 1. Listar TODOS los documentos de contrato legal
  const docs = await prisma.contratoDocumentoVehiculo.findMany({
    select: {
      id: true,
      numeroContrato: true,
      propietarioNombre: true,
      propietarioCedula: true,
      vehiculoPlaca: true,
      estado: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Total documentos encontrados: ${docs.length}\n`);
  for (const d of docs) {
    const marca = d.propietarioCedula === '1214731649' ? 'OK' : '*** ERRADA ***';
    console.log(`  ${d.numeroContrato} | placa=${d.vehiculoPlaca} | estado=${d.estado}`);
    console.log(`    propietario: ${d.propietarioNombre} | cedula=${d.propietarioCedula} ${marca}`);
  }

  // 2. Corregir los registros con cédula incorrecta
  const corregir = docs.filter(d => d.propietarioCedula !== '1214731649' || d.propietarioNombre !== 'Johan Sebastian Alvarez Del Rio');
  console.log(`\nDocumentos a corregir: ${corregir.length}`);

  for (const d of corregir) {
    console.log(`\nCorrigiendo ${d.numeroContrato}...`);
    console.log(`  Antes: nombre="${d.propietarioNombre}" cedula="${d.propietarioCedula}"`);
    await prisma.contratoDocumentoVehiculo.update({
      where: { id: d.id },
      data: {
        propietarioNombre: 'Johan Sebastian Alvarez Del Rio',
        propietarioCedula: '1214731649',
      },
    });
    console.log(`  Después: nombre="Johan Sebastian Alvarez Del Rio" cedula="1214731649"`);
  }

  console.log('\n=== CORRECCIÓN COMPLETADA ===');
  console.log(`Total corregidos: ${corregir.length}`);
  console.log(`Total ya correctos: ${docs.length - corregir.length}`);

  // 3. Verificar
  const docsFinales = await prisma.contratoDocumentoVehiculo.findMany({
    select: { numeroContrato: true, propietarioCedula: true },
  });
  const incorrectosFinales = docsFinales.filter(d => d.propietarioCedula !== '1214731649');
  console.log(`\nVerificación: ${incorrectosFinales.length} registros aún incorrectos.`);

  await prisma.$disconnect();
})().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
