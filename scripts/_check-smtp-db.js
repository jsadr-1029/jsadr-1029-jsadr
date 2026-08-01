const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('Conectando a BD...');
  const conexiones = await prisma.conexionAPI.findMany({
    where: { tipo: 'EMAIL_SMTP' }
  });
  console.log('Conexiones EMAIL_SMTP encontradas:', conexiones.length);
  for (const c of conexiones) {
    console.log('---');
    console.log('ID:', c.id);
    console.log('Nombre:', c.nombre);
    console.log('URL:', c.url);
    console.log('Usuario:', c.usuario);
    console.log('Activa:', c.activa);
    console.log('apiKey (fromEmail):', c.apiKey);
    console.log('configuracionExtra:', c.configuracionExtra);
    console.log('password (longitud):', c.password ? c.password.length : 0);
    console.log('password (primeros 20 chars):', c.password ? c.password.substring(0,20) : 'NULL');
  }
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); }).finally(() => prisma.$disconnect());
