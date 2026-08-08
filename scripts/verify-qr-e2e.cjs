// Test end-to-end: genera un código QR para un préstamo existente, luego
// verifica ese código contra la API /api/documentos/verificar en producción.
//
// Requiere: variable de entorno DATABASE_URL o .env cargado.
//
const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const prisma = new PrismaClient()

function generarCodigoVerificacion(prestamo, tipoDoc) {
  const data = `${prestamo.id}|${tipoDoc}|${prestamo.codigo}|${prestamo.montoPrincipal}|${prestamo.createdAt.toISOString()}`
  const hash = crypto.createHash('sha256').update(data).digest('hex')
  return hash.substring(0, 4) + '-' + hash.substring(4, 8) + '-' + hash.substring(8, 12) + '-' + hash.substring(12, 16)
}

async function main() {
  // Tomar los 5 préstamos más recientes
  const prestamos = await prisma.prestamo.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, codigo: true, montoPrincipal: true, createdAt: true, estado: true, cliente: { select: { nombre: true, cedula: true } } },
  })

  if (prestamos.length === 0) {
    console.log('No hay préstamos en la base de datos para probar.')
    return
  }

  console.log(`=== Probando ${prestamos.length} préstamos más recientes ===\n`)

  for (const p of prestamos) {
    console.log(`Préstamo: ${p.codigo} (cliente: ${p.cliente?.nombre}, estado: ${p.estado})`)
    for (const tipoDoc of ['pagare-blanco', 'pagare-diligenciado', 'carta']) {
      const codigo = generarCodigoVerificacion(p, tipoDoc)
      // Verificar contra la API de producción
      const url = `https://jsadr.com.co/api/documentos/verificar?codigo=${encodeURIComponent(codigo)}`
      try {
        const r = await fetch(url, { cache: 'no-store' })
        const json = await r.json()
        const ok = json.success && json.autentico
        console.log(`  ${tipoDoc.padEnd(25)} -> ${codigo}  ${ok ? '✓ AUTÉNTICO' : '✗ ' + (json.error || 'no match')}`)
        if (ok) {
          console.log(`    Deudor: ${json.data.deudor}, cédula: ${json.data.cedula}, tipo: ${json.data.tipoDocumento}`)
        }
      } catch (e) {
        console.log(`  ${tipoDoc.padEnd(25)} -> ${codigo}  ✗ Error: ${e.message}`)
      }
    }
    console.log()
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
