// =====================================================
// Crear préstamo de ejemplo para cliente JOHAN SEBASTIAN ALVAREZ DEL RIO
// cédula 1214731649, con 2 cuotas vencidas para probar el
// módulo de Regularización Inteligente desde el portal.
//
// Configuración del préstamo:
//   - Monto: $1.000.000
//   - Tasa: 15% mensual (tasa fija)
//   - Plazo: 4 meses (4 cuotas mensuales)
//   - Frecuencia: MENSUAL
//   - Modalidad: TASA_FIJA (interés sobre capital inicial)
//   - Tasa mora: 1% diario
//   - fechaDesembolso: hace 75 días (para que cuotas 1 y 2 estén vencidas)
//   - fechaInicioAmortizacion: hace 75 días
//
// Cálculo esperado (TASA_FIJA):
//   - Interés total = 1.000.000 × 15% × 4 = 600.000
//   - Total a pagar = 1.600.000
//   - Cuota mensual = 400.000 (capital: 250.000 + interés: 150.000)
//
// Cuotas:
//   Cuota 1: vence hace ~45 días (VENCIDA, ~45 días de mora)
//   Cuota 2: vence hace ~15 días (VENCIDA, ~15 días de mora)
//   Cuota 3: vence en ~15 días (vigente)
//   Cuota 4: vence en ~45 días (vigente)
// =====================================================

import pkg from 'pg';
import { randomBytes } from 'crypto';
const { Client } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

const CLIENTE_ID = 'cmrpogbj5000dxrupyutwoy9r';
const CEDULA = '1214731649';

// === Cálculo financiero ===
const montoPrincipal = 1000000;
const tasaMensualFija = 15; // %
const numeroCuotas = 4;
const frecuencia = 'MENSUAL';

// Tasa fija mensual sobre capital inicial
const tasaAplicada = tasaMensualFija / 100;
const mesesDuracion = numeroCuotas; // mensual
const interesTotalFijo = Math.round(montoPrincipal * tasaAplicada * mesesDuracion);
const totalPagar = montoPrincipal + interesTotalFijo;
const montoCuota = Math.round(totalPagar / numeroCuotas);
const abonoCapitalCuota = Math.round(montoPrincipal / numeroCuotas);
const interesPorCuota = Math.round(interesTotalFijo / numeroCuotas);

console.log('=== CÁLCULO ===');
console.log(`Monto: $${montoPrincipal.toLocaleString('es-CO')}`);
console.log(`Tasa mensual: ${tasaMensualFija}%`);
console.log(`Cuotas: ${numeroCuotas} mensuales`);
console.log(`Interés total: $${interesTotalFijo.toLocaleString('es-CO')}`);
console.log(`Total a pagar: $${totalPagar.toLocaleString('es-CO')}`);
console.log(`Cuota mensual: $${montoCuota.toLocaleString('es-CO')} (capital: $${abonoCapitalCuota.toLocaleString('es-CO')} + interés: $${interesPorCuota.toLocaleString('es-CO')})`);

// === Fechas: hace 75 días ===
const hoy = new Date();
hoy.setHours(12, 0, 0, 0);

const fechaDesembolso = new Date(hoy);
fechaDesembolso.setDate(fechaDesembolso.getDate() - 75);

const fechaInicioAmortizacion = new Date(fechaDesembolso);

// fechaVencimiento final (4 meses después)
const fechaVencFinal = new Date(fechaInicioAmortizacion);
fechaVencFinal.setMonth(fechaVencFinal.getMonth() + numeroCuotas);

console.log('\n=== FECHAS ===');
console.log(`Hoy: ${hoy.toISOString()}`);
console.log(`Desembolso: ${fechaDesembolso.toISOString()}`);
console.log(`Inicio amortización: ${fechaInicioAmortizacion.toISOString()}`);
console.log(`Vencimiento final: ${fechaVencFinal.toISOString()}`);

// === Generar cuotas ===
const cuotas = [];
for (let i = 1; i <= numeroCuotas; i++) {
  const fechaVenc = new Date(fechaInicioAmortizacion);
  fechaVenc.setMonth(fechaVenc.getMonth() + i);
  cuotas.push({
    numero: i,
    fechaVencimiento: fechaVenc,
    capital: i === numeroCuotas ? montoPrincipal - (abonoCapitalCuota * (numeroCuotas - 1)) : abonoCapitalCuota,
    interes: interesPorCuota,
    montoTotal: montoCuota,
  });
}

console.log('\n=== CUOTAS ===');
for (const c of cuotas) {
  const diasMora = Math.max(0, Math.floor((hoy.getTime() - c.fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24)));
  console.log(`Cuota ${c.numero}: vence ${c.fechaVencimiento.toISOString().slice(0,10)} | $${c.montoTotal.toLocaleString('es-CO')} | días mora: ${diasMora}`);
}

// === Generar código del préstamo ===
// Formato: XX-CC-CCCCCCCC-YYYYMMDD-NN
const initiales = 'JA'; // Johan Alvarez
const fechaCod = fechaDesembolso.toISOString().slice(0, 10).replace(/-/g, '');
const codigoPrestamo = `${initiales}-CC-${CEDULA}-${fechaCod}-01`;

console.log(`\nCódigo préstamo: ${codigoPrestamo}`);

// === Verificar si ya existe un préstamo con ese código ===
const existe = await client.query(`SELECT id FROM "Prestamo" WHERE codigo = $1`, [codigoPrestamo]);
if (existe.rows.length > 0) {
  console.log('\n⚠️  Ya existe un préstamo con ese código. Eliminando...');
  await client.query(`DELETE FROM "Pago" WHERE "prestamoId" = $1`, [existe.rows[0].id]);
  await client.query(`DELETE FROM "Prestamo" WHERE id = $1`, [existe.rows[0].id]);
  console.log('Eliminado. Continuando con la creación...');
}

// === Token TyC de prueba ===
const tycToken = randomBytes(32).toString('hex');

// === INSERTAR PRÉSTAMO ===
const insertPrestamo = `
  INSERT INTO "Prestamo" (
    id, codigo, "clienteId", "montoPrincipal", "tasaInteresAnual", "tasaInteresMensual",
    "tasaMoraDiaria", "plazoMeses", frecuencia, "numeroCuotas", "montoCuota",
    "totalInteres", "totalPagar", "tasaAplicada", "modalidadAmortizacion",
    "moraCompuestaDiaria", "montoMoraAcumulado",
    "fechaSolicitud", "fechaDesembolso", "fechaVencimiento", "fechaInicioAmortizacion",
    estado, "tycEnviado", "tycAceptado", "tycFechaAceptacion", "tycToken",
    "requiereDocumentos", "generarPagare", "generarCarta",
    "saldoCapital", "saldoInteres", "saldoTotal", "cuotasPagadas", "montoPagado",
    "montoMora", "diasMora",
    "fondoGarantiaCargado", "fondoGarantiaMonto",
    "cobroPagareCarta", "valorPagareCarta",
    "cobroTarifaPlataforma", "tarifaPlataformaCargada", "valorTarifaPlataforma",
    "flexibilidadFinanciera", "flexibilidadCosto", "flexibilidadCobroAplicado",
    "renovacionAnticipada", "renovacionAnticipadaCosto",
    "interesFijoMensual", "capitalPagadoExtra", "interesPagadoAcumulado",
    "createdAt", "updatedAt"
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
    true, 0,
    $16, $17, $18, $19,
    'EN_MORA', true, true, $17, $20,
    false, false, false,
    $21, $22, $23, 0, 0,
    0, 0,
    false, 0,
    false, 0,
    false, false, 0,
    false, 0, false,
    false, 0,
    0, 0, 0,
    NOW(), NOW()
  ) RETURNING id
`;

const prestamoId = 'prest-' + randomBytes(8).toString('hex');
const prestamoValues = [
  prestamoId,
  codigoPrestamo,
  CLIENTE_ID,
  montoPrincipal,
  tasaMensualFija * 12, // tasaAnual
  tasaMensualFija,
  1, // tasaMoraDiaria 1%
  numeroCuotas, // plazoMeses
  frecuencia,
  numeroCuotas,
  montoCuota,
  interesTotalFijo,
  totalPagar,
  tasaAplicada,
  'TASA_FIJA',
  fechaDesembolso, // fechaSolicitud
  fechaDesembolso, // fechaDesembolso
  fechaVencFinal, // fechaVencimiento
  fechaInicioAmortizacion, // fechaInicioAmortizacion
  tycToken,
  montoPrincipal, // saldoCapital
  interesTotalFijo, // saldoInteres
  totalPagar, // saldoTotal
];

console.log('\n=== INSERTANDO PRÉSTAMO ===');
const result = await client.query(insertPrestamo, prestamoValues);
console.log(`Préstamo creado con ID: ${result.rows[0].id}`);

// === INSERTAR PAGOS PROGRAMADOS (cuotas) ===
console.log('\n=== INSERTANDO CUOTAS (Pago) ===');
for (const c of cuotas) {
  const pagoId = 'pago-' + randomBytes(8).toString('hex');
  const estado = c.fechaVencimiento < hoy ? 'PENDIENTE' : 'PENDIENTE';
  
  await client.query(`
    INSERT INTO "Pago" (
      id, "prestamoId", "numeroCuota", "fechaVencimiento",
      "montoCapital", "montoInteres", "montoMora", "montoTotal",
      "metodoPago", estado, "createdAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 'EFECTIVO', $8, NOW())
  `, [
    pagoId,
    prestamoId,
    c.numero,
    c.fechaVencimiento,
    c.capital,
    c.interes,
    c.montoTotal,
    estado,
  ]);
  
  const diasMora = Math.max(0, Math.floor((hoy.getTime() - c.fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24)));
  console.log(`✓ Cuota ${c.numero} insertada | Vence: ${c.fechaVencimiento.toISOString().slice(0,10)} | $${c.montoTotal.toLocaleString('es-CO')} | Días mora: ${diasMora}`);
}

// === Actualizar tokenSesion del cliente para que sea válido ===
const tokenSesion = randomBytes(32).toString('hex');
const tokenExpira = new Date();
tokenExpira.setHours(tokenExpira.getHours() + 24);

await client.query(`
  UPDATE "Cliente" 
  SET "tokenSesion" = $1, "tokenExpira" = $2
  WHERE cedula = $3
`, [tokenSesion, tokenExpira, CEDULA]);

console.log('\n=== TOKEN PORTAL ACTUALIZADO ===');
console.log(`tokenSesion: ${tokenSesion}`);
console.log(`tokenExpira: ${tokenExpira.toISOString()}`);

// === RESUMEN FINAL ===
console.log('\n========================================');
console.log('=== CASO DE EJEMPLO CREADO ===');
console.log('========================================');
console.log(`Cliente: JOHAN SEBASTIAN ALVAREZ DEL RIO`);
console.log(`Cédula: ${CEDULA}`);
console.log(`Código préstamo: ${codigoPrestamo}`);
console.log(`Monto: $${montoPrincipal.toLocaleString('es-CO')}`);
console.log(`Tasa mensual: ${tasaMensualFija}%`);
console.log(`Cuotas: ${numeroCuotas} mensuales de $${montoCuota.toLocaleString('es-CO')}`);
console.log(`\nCuotas vencidas:`);
for (const c of cuotas) {
  const diasMora = Math.max(0, Math.floor((hoy.getTime() - c.fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24)));
  if (diasMora > 0) {
    console.log(`  ✓ Cuota ${c.numero}: venció hace ${diasMora} días (mora ~$${Math.round(montoPrincipal * 0.01 * diasMora).toLocaleString('es-CO')})`);
  }
}
console.log(`\nToken del portal: ${tokenSesion}`);
console.log(`\nPara probar desde el portal:`);
console.log(`  URL: https://jsadr.com.co/`);
console.log(`  Cédula: ${CEDULA}`);
console.log(`  Clave: (clave del cliente)`);

await client.end();
