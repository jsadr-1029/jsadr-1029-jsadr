// =====================================================
// FIX: Restaurar ConexionAPI.EMAIL_SMTP.apiKey a null
// (el script anterior accidentalmente lo sobrescribió con la key Brevo cifrada,
//  lo que expondría parcialmente la clave al mostrarse enmascarada en /api/conexiones)
// Como configuracionExtra.fromEmail ya está seteado a jsa@jsadr.com.co,
// apiKey NO se necesita para EMAIL_SMTP.
// =====================================================

const fs = require('fs')
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const smtp = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
  if (!smtp) {
    console.log('NO EXISTE ConexionAPI.EMAIL_SMTP')
    return
  }

  console.log('ANTES:')
  console.log({
    apiKeyLength: smtp.apiKey?.length || 0,
    apiKeyIsEncryptedBrevoKey: smtp.apiKey === smtp.password,
  })

  // Restaurar apiKey a null (el fromEmail viene de configuracionExtra.fromEmail)
  await prisma.conexionAPI.update({
    where: { id: smtp.id },
    data: { apiKey: null },
  })

  const refreshed = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
  console.log('\nDESPUÉS:')
  console.log({
    apiKey: refreshed.apiKey,
    passwordLength: refreshed.password?.length || 0,
    configuracionExtra: refreshed.configuracionExtra,
    activa: refreshed.activa,
  })

  console.log('\n✅ apiKey limpiado. fromEmail vendrá de configuracionExtra.fromEmail = jsa@jsadr.com.co')

  await prisma.$disconnect()
}
main().catch(e => { console.error('ERR:', e); process.exit(1) })
