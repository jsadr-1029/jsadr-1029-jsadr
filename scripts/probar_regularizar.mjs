import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

const CEDULA = '1214731649';
const cli = await client.query(`SELECT "tokenSesion" FROM "Cliente" WHERE cedula = $1`, [CEDULA]);
const token = cli.rows[0].tokenSesion;
await client.end();

const prestamoId = 'prest-1ad52ec0b7709e2e';

// === POST con accion=calcular_escenario para fecha 30 días en el futuro ===
const fechaFutura = new Date();
fechaFutura.setDate(fechaFutura.getDate() + 30);
const fechaISO = fechaFutura.toISOString().slice(0, 10);

console.log('=== POST calcular_escenario para fecha:', fechaISO, '(30 días) ===');
const resPost = await fetch(`https://jsadr.com.co/api/portal/${CEDULA}/regularizar`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-portal-token': token,
    'Origin': 'https://jsadr.com.co',
  },
  body: JSON.stringify({
    accion: 'calcular_escenario',
    prestamoId,
    fecha: fechaISO,
  }),
});
const jsonPost = await resPost.json();
console.log('Status:', resPost.status);
console.log('Response (pretty):');
console.log(JSON.stringify(jsonPost, null, 2));

// === POST con accion=guardar_compromiso (simulación) ===
console.log('\n=== POST guardar_compromiso (Opción 3: Acuerdo de regularización) ===');
const resGuardar = await fetch(`https://jsadr.com.co/api/portal/${CEDULA}/regularizar`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-portal-token': token,
    'Origin': 'https://jsadr.com.co',
  },
  body: JSON.stringify({
    accion: 'guardar_compromiso',
    prestamoId,
    tipoAcuerdo: 'ACUERDO_REGULARIZACION',
    fechaPago: fechaISO,
    montoPropuesto: 700000,
    montoTotalAcordado: jsonPost.success ? jsonPost.data.escenario.total : 2000000,
    cuotasVencidasIncluidas: [1, 2],
    saldoRestante: 800000,
    fechasPagosPosteriores: ['2026-10-09', '2026-10-24', '2026-11-08'],
  }),
});
const jsonGuardar = await resGuardar.json();
console.log('Status:', resGuardar.status);
console.log('Response (pretty):');
console.log(JSON.stringify(jsonGuardar, null, 2));
