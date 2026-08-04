// Inspeccionar estado actual de credenciales en Neon
// Cargar .env manualmente para evitar conflictos
const fs = require('fs')
const path = require('path')

// Parse .env manually
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}

console.log('DATABASE_URL preview:', process.env.DATABASE_URL?.slice(0, 40))
console.log('API_ENCRYPTION_KEY preview:', process.env.API_ENCRYPTION_KEY?.slice(0, 12))

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('\n=== ConexionAPI.EMAIL_SMTP ===')
  const smtp = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
  if (smtp) {
    console.log({
      id: smtp.id,
      nombre: smtp.nombre,
      usuario: smtp.usuario,
      url: smtp.url,
      activa: smtp.activa,
      probada: smtp.probada,
      passwordLength: smtp.password?.length || 0,
      apiKeyLength: smtp.apiKey?.length || 0,
      fechaUltimaPrueba: smtp.fechaUltimaPrueba,
      resultadoUltimaPrueba: smtp.resultadoUltimaPrueba?.slice(0, 200),
    })
  } else {
    console.log('NO EXISTE ConexionAPI.EMAIL_SMTP')
  }

  console.log('\n=== CorreoInstitucional jsa@jsadr.com.co ===')
  const correo = await prisma.correoInstitucional.findFirst({
    where: { email: 'jsa@jsadr.com.co' },
  })
  if (correo) {
    console.log({
      id: correo.id,
      email: correo.email,
      smtpHost: correo.smtpHost,
      smtpPort: correo.smtpPort,
      smtpUser: correo.smtpUser,
      ssl: correo.ssl,
      tls: correo.tls,
      starttls: correo.starttls,
      estado: correo.estado,
      esPrincipal: correo.esPrincipal,
      smtpPassLength: correo.smtpPass?.length || 0,
      smtpPassBackupLength: correo.smtpPassBackup?.length || 0,
      ultimoTestOk: correo.ultimoTestOk,
    })
  } else {
    console.log('NO EXISTE CorreoInstitucional jsa@jsadr.com.co')
    const anyCorreo = await prisma.correoInstitucional.findMany({ take: 5 })
    console.log('Correos existentes:', anyCorreo.map(c => c.email))
  }

  console.log('\n=== PlataformaSync (todas) ===')
  const todas = await prisma.plataformaSync.findMany({ orderBy: { plataforma: 'asc' } })
  for (const p of todas) {
    console.log({
      plataforma: p.plataforma,
      nombreMostrar: p.nombreMostrar,
      sincronizado: p.sincronizado,
      tiempoReal: p.tiempoReal,
      proyectoRef: p.proyectoRef,
      endpoint: p.endpoint,
      tokenConfigurado: !!p.tokenCifrado,
      tokenLength: p.tokenCifrado?.length || 0,
      tokenPrimerosChars: p.tokenCifrado?.slice(0, 30) || null,
      ultimoEstado: p.ultimoEstado,
      ultimoError: p.ultimoError?.slice(0, 100),
    })
  }

  await prisma.$disconnect()
}
main().catch(e => { console.error('ERR:', e); process.exit(1) })
