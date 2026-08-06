// Verificación de sincronización completa: GitHub + Vercel + Neon
// Ejecuta: node scripts/verify-full-sync.cjs

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
const { execSync } = require('child_process')
const prisma = new PrismaClient()

async function checkGitHub() {
  console.log('\n=== GITHUB ===')
  try {
    const localHead = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
    const remoteHead = execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim()
    const ahead = execSync('git rev-list --count origin/main..HEAD', { encoding: 'utf8' }).trim()
    const behind = execSync('git rev-list --count HEAD..origin/main', { encoding: 'utf8' }).trim()
    const lastCommit = execSync('git log -1 --format="%h %s (%ar)"', { encoding: 'utf8' }).trim()
    console.log(`  Local HEAD:  ${localHead}`)
    console.log(`  Remote HEAD: ${remoteHead}`)
    console.log(`  Ahead:  ${ahead}`)
    console.log(`  Behind: ${behind}`)
    console.log(`  Last commit: ${lastCommit}`)
    if (ahead === '0' && behind === '0') {
      console.log('  ✅ GitHub sincronizado (local = origin/main)')
    } else {
      console.log(`  ⚠️  Local está ${ahead} commits ahead, ${behind} behind`)
    }
  } catch (e) {
    console.log('  ❌ Error:', e.message)
  }
}

async function checkVercel() {
  console.log('\n=== VERCEL ===')
  try {
    const res = await fetch('https://jsadr-1029-jsadr.vercel.app/', { method: 'HEAD' })
    console.log(`  URL: https://jsadr-1029-jsadr.vercel.app/`)
    console.log(`  HTTP status: ${res.status}`)
    console.log(`  Vercel ID: ${res.headers.get('x-vercel-id') || 'N/A'}`)
    console.log(`  Cache: ${res.headers.get('x-vercel-cache') || 'N/A'}`)
    if (res.status === 200) {
      console.log('  ✅ Vercel producción: OK (HTTP 200)')
    } else {
      console.log(`  ⚠️  Vercel respondió ${res.status}`)
    }

    // Verificar API endpoint
    const apiRes = await fetch('https://jsadr-1029-jsadr.vercel.app/api/email')
    console.log(`  API /api/email: HTTP ${apiRes.status} (401 = esperado sin auth)`)
  } catch (e) {
    console.log('  ❌ Error:', e.message)
  }
}

async function checkNeon() {
  console.log('\n=== NEON DB ===')
  try {
    const [
      usuarios, clientes, prestamos, pagos,
      conexiones, correosInst, enviosCorreo,
      firmas, notifLogs, auditLogs,
    ] = await Promise.all([
      prisma.usuario.count(),
      prisma.cliente.count(),
      prisma.prestamo.count(),
      prisma.pago.count(),
      prisma.conexionAPI.count(),
      prisma.correoInstitucional.count(),
      prisma.envioCorreo.count(),
      prisma.firmaElectronica.count(),
      prisma.notificacionLog.count(),
      prisma.auditLog.count(),
    ])

    console.log(`  Tabla                | Registros`)
    console.log(`  ---------------------|-----------`)
    console.log(`  Usuario              | ${usuarios}`)
    console.log(`  Cliente              | ${clientes}`)
    console.log(`  Prestamo             | ${prestamos}`)
    console.log(`  Pago                 | ${pagos}`)
    console.log(`  ConexionAPI          | ${conexiones}`)
    console.log(`  CorreoInstitucional  | ${correosInst}`)
    console.log(`  EnvioCorreo          | ${enviosCorreo}`)
    console.log(`  FirmaElectronica     | ${firmas}`)
    console.log(`  NotificacionLog      | ${notifLogs}`)
    console.log(`  AuditLog             | ${auditLogs}`)

    // Verificar ConexionAPI.EMAIL_SMTP
    const smtp = await prisma.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
    if (smtp) {
      console.log(`\n  ConexionAPI.EMAIL_SMTP:`)
      console.log(`    activa: ${smtp.activa}`)
      console.log(`    usuario: ${smtp.usuario}`)
      console.log(`    url: ${smtp.url}`)
      console.log(`    probada: ${smtp.probada}`)
      console.log(`    resultadoUltimaPrueba: ${smtp.resultadoUltimaPrueba || 'N/A'}`)
    }

    // Último envío de correo
    const lastEmail = await prisma.envioCorreo.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, estado: true, destinatario: true, asunto: true, mensajeError: true },
    })
    if (lastEmail) {
      console.log(`\n  Último EnvioCorreo:`)
      console.log(`    fecha: ${lastEmail.createdAt.toISOString()}`)
      console.log(`    estado: ${lastEmail.estado}`)
      console.log(`    destinatario: ${lastEmail.destinatario}`)
      console.log(`    asunto: ${lastEmail.asunto}`)
      if (lastEmail.mensajeError) {
        console.log(`    error: ${lastEmail.mensajeError.slice(0, 100)}`)
      }
    }

    console.log('\n  ✅ Neon DB conectado y operacional')
  } catch (e) {
    console.log('  ❌ Error:', e.message)
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗')
  console.log('║  VERIFICACIÓN DE SINCRONIZACIÓN: GitHub + Vercel + Neon ║')
  console.log('╚═══════════════════════════════════════════════════════╝')

  await checkGitHub()
  await checkVercel()
  await checkNeon()

  console.log('\n╔═══════════════════════════════════════════════════════╗')
  console.log('║  RESUMEN DE SINCRONIZACIÓN                              ║')
  console.log('╚═══════════════════════════════════════════════════════╝')
  console.log('  GitHub:     https://github.com/jsadr-1029/jsadr-1029-jsadr')
  console.log('  Vercel:     https://jsadr-1029-jsadr.vercel.app/')
  console.log('  Neon DB:    postgresql://...neon.tech/neondb')
  console.log('  Branch:     main')
  console.log('  Last commit: 896d158 (test(email): script E2E cubriendo TODOS los clientes)')

  await prisma.$disconnect()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
