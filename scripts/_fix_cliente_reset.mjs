import pkg from 'pg';
import crypto from 'crypto';
const { Client } = pkg;

const connectionString = 'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public';
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

// 1. Generar NUEVO token fresco para el cliente
const resetToken = crypto.randomBytes(32).toString('hex');
const expira = new Date(Date.now() + 60 * 60 * 1000); // 60 min

await client.query(`
  UPDATE "Cliente" 
  SET "claveResetToken" = $1, 
      "claveResetExpira" = $2,
      "debeCambiarClave" = true,
      "claveIntentos" = 0,
      "claveBloqueadoHasta" = NULL
  WHERE cedula = '1100012073'
`, [resetToken, expira]);

console.log('✅ Token fresco generado');
console.log('Token:', resetToken);
console.log('Expira:', expira.toISOString());
console.log('Magic link: https://jsadr.com.co/recuperar-clave?token=' + resetToken);

// 2. Verificar el cliente
const cli = await client.query(`
  SELECT nombre, cedula, email FROM "Cliente" WHERE cedula = '1100012073'
`);
console.log('\nCliente:', cli.rows[0]);

await client.end();

// 3. Enviar el correo directamente usando la API interna
console.log('\n=== Enviando correo directamente ===');
const emailRes = await fetch('https://jsadr.com.co/api/email-test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: cli.rows[0].email,
    subject: `Restablece tu contraseña — ${cli.rows[0].nombre}`.slice(0, 90),
    text: `Hola ${cli.rows[0].nombre},

Hemos recibido una solicitud para restablecer la contraseña de tu cuenta ${cli.rows[0].cedula}.

Para crear una nueva contraseña, abre el siguiente enlace en tu navegador:

https://jsadr.com.co/recuperar-clave?token=${resetToken}

Este enlace es válido por 60 minutos y se puede usar una sola vez.

Si no solicitaste este cambio, ignora este correo.`,
  }),
});
console.log('Email status:', emailRes.status);
const emailJson = await emailRes.json().catch(() => ({}));
console.log('Email response:', JSON.stringify(emailJson, null, 2));
