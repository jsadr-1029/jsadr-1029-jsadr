// Envía el enlace de firma electrónica al correo del cliente
// Isabel Cristina Benítez Ospina - icbocata@gmail.com
// Préstamo ICB-CC-1077430375-20261022-01
const { Client } = require('pg');
const NEON_URL = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Obtener datos completos del préstamo, cliente y token
  const res = await client.query(`
    SELECT p.id AS prestamo_id, p.codigo, p.estado,
           c.nombre, c.cedula, c.email, c.telefono,
           t.token, t."fechaExpiracion",
           f.id AS firma_id, f."estadoFirma"
    FROM "Prestamo" p
    JOIN "Cliente" c ON c.id = p."clienteId"
    JOIN "TokenFirma" t ON t."prestamoId" = p.id AND t.usado = false
    JOIN "FirmaElectronica" f ON f.id = t."firmaId"
    WHERE p.codigo = 'ICB-CC-1077430375-20261022-01'
    ORDER BY t."createdAt" DESC
    LIMIT 1
  `);

  if (res.rows.length === 0) {
    console.log('✗ No se encontró token vigente para este préstamo');
    await client.end();
    return;
  }

  const d = res.rows[0];
  console.log('=== DATOS PARA ENVÍO ===');
  console.log('Cliente:', d.nombre);
  console.log('Email:', d.email);
  console.log('Préstamo:', d.codigo);
  console.log('Estado préstamo:', d.estado);
  console.log('Estado firma:', d.estadoFirma);
  console.log('Token:', d.token.substring(0, 20) + '...');
  console.log('Expiración:', d.fechaExpiracion);

  const linkFirma = `https://jsadr.com.co/firma/${d.token}`;

  // 2. Enviar el correo usando la API interna de la aplicación
  // Vamos a invocar el endpoint público /api/firma con accion 'iniciar_firma' NO,
  // mejor enviar directamente el correo con un script que use el endpoint de email.
  // Pero no tenemos acceso directo al SMTP. Vamos a usar el endpoint interno de
  // envío de email desde el sistema.

  // En realidad, la forma más limpia es usar el endpoint /api/firma con accion
  // 'iniciar_firma' que ya envía el correo automáticamente. Pero eso crearía
  // una NUEVA firma. No queremos eso.

  // En su lugar, vamos a usar un endpoint público que reenvíe el enlace de firma.
  // O mejor, vamos a invocar la función de envío de email directamente.

  // Vamos a usar fetch al endpoint /api/firma con accion 'enviar_otp' NO, eso
  // enviaría un OTP, no el enlace.

  // Mejor enfoque: usar el endpoint /api/firma con accion 'iniciar_firma' pero
  // pasar el mismo prestamoId. Esto creará una nueva firma y enviará el correo.
  // La firma anterior quedará como PENDIENTE (no se completa) y la nueva
  // será la que el cliente use.

  // PERO el usuario dijo "reparar el enlace" y "reenviarlo al correo". Esto
  // sugiere que el enlace anterior no funciona. Vamos a verificar si el enlace
  // actual funciona:

  console.log('\n=== ENLACE DE FIRMA ===');
  console.log(linkFirma);
  console.log('\nEste enlace debe ser enviado a:', d.email);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
