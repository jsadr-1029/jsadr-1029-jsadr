// =====================================================
// verify-qr-end-to-end.cjs
// -----------------------------------------------------
// Verifica end-to-end contra producción:
//  1. Toma un préstamo real de la BD Neon
//  2. Genera su código de verificación (pagare-diligenciado)
//  3. Llama a https://jsadr.com.co/api/documentos/verificar?codigo=...
//  4. Verifica que la respuesta incluya los nuevos objetos:
//     cliente, credito (con tasa/modalidad), cuentaOrigen, firma
// =====================================================
require('dotenv').config({ path: '.env' })
const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const db = new PrismaClient()

function generarCodigoDoc(prestamo, tipoDoc) {
  const data = `${prestamo.id}|${tipoDoc}|${prestamo.codigo}|${prestamo.montoPrincipal}|${prestamo.createdAt.toISOString()}`
  const hash = crypto.createHash('sha256').update(data).digest('hex')
  return hash.substring(0, 4) + '-' + hash.substring(4, 8) + '-' + hash.substring(8, 12) + '-' + hash.substring(12, 16)
}

async function main() {
  console.log('=== Test end-to-end de verificación QR (datos extendidos) ===\n')

  // 1. Tomar los 2 préstamos más recientes
  const prestamos = await db.prestamo.findMany({
    select: {
      id: true, codigo: true, montoPrincipal: true, createdAt: true,
      modalidadAmortizacion: true, estado: true,
      cliente: { select: { nombre: true, cedula: true, bancoCliente: true, numeroCuentaCliente: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 2,
  })

  if (prestamos.length === 0) {
    console.log('No hay préstamos en la BD para probar')
    return
  }

  let okCount = 0
  let totalChecks = 0

  for (const p of prestamos) {
    console.log(`\n--- Préstamo: ${p.codigo} (${p.cliente?.nombre || 'sin cliente'}) ---`)
    console.log(`  Modalidad: ${p.modalidadAmortizacion} | Estado: ${p.estado}`)
    console.log(`  Cliente banco/cuenta: ${p.cliente?.bancoCliente || '(sin banco)'} / ${p.cliente?.numeroCuentaCliente || '(sin cuenta)'}`)

    const codigo = generarCodigoDoc(p, 'pagare-diligenciado')
    console.log(`  Código generado: ${codigo}`)

    // 2. Llamar a producción
    const url = `https://jsadr.com.co/api/documentos/verificar?codigo=${codigo}`
    console.log(`  Llamando: ${url}`)
    const res = await fetch(url, { cache: 'no-store' })
    const json = await res.json()
    totalChecks++

    if (json.success && json.autentico) {
      okCount++
      console.log(`  ✓ HTTP ${res.status} — autentico: true`)
      console.log(`    Tipo doc: ${json.data.tipoDocumento}`)
      console.log(`    Deudor: ${json.data.deudor}`)
      console.log(`    Cédula: ${json.data.cedula}`)
      console.log(`    Monto: $${json.data.monto?.toLocaleString('es-CO')}`)

      // Verificar nuevos objetos
      if (json.data.cliente) {
        console.log(`    ✓ cliente objeto presente:`)
        console.log(`      telefono: ${json.data.cliente.telefono || '(null)'}`)
        console.log(`      email: ${json.data.cliente.email || '(null)'}`)
        if (json.data.cliente.cuentaOrigen) {
          console.log(`      ✓ cuentaOrigen objeto presente:`)
          console.log(`        banco: ${json.data.cliente.cuentaOrigen.banco || '(null)'}`)
          console.log(`        tipoCuenta: ${json.data.cliente.cuentaOrigen.tipoCuenta || '(null)'}`)
          console.log(`        numeroCuenta: ${json.data.cliente.cuentaOrigen.numeroCuenta || '(null)'}`)
        } else {
          console.log(`      ✗ cuentaOrigen NO presente`)
        }
      } else {
        console.log(`    ✗ cliente objeto NO presente`)
      }

      if (json.data.credito) {
        console.log(`    ✓ credito objeto presente:`)
        console.log(`      modalidad: ${json.data.credito.modalidad} (${json.data.credito.modalidadCodigo})`)
        console.log(`      tasaInteresAnual: ${json.data.credito.tasaInteresAnual ?? '(null — no FRANCES)'}`)
        console.log(`      plazoMeses: ${json.data.credito.plazoMeses}`)
        console.log(`      numeroCuotas: ${json.data.credito.numeroCuotas}`)
        console.log(`      frecuencia: ${json.data.credito.frecuencia}`)
        console.log(`      fechaDesembolso: ${json.data.credito.fechaDesembolso || '(null)'}`)
      } else {
        console.log(`    ✗ credito objeto NO presente`)
      }

      if (json.data.firma) {
        console.log(`    ✓ firma objeto presente (id: ${json.data.firma.id?.substring(0, 8) || '(null)'}...)`)
      } else {
        console.log(`    ℹ firma objeto no presente (puede ser null si no hay firma completada)`)
      }
    } else {
      console.log(`  ✗ HTTP ${res.status} — autentico: ${json.autentico}`)
      console.log(`    Error: ${json.error || '(no error message)'}`)
    }
  }

  console.log(`\n=== Resumen ===`)
  console.log(`Verificaciones exitosas: ${okCount} / ${totalChecks}`)

  // 3. Verificar que la página HTML pública también responde
  console.log(`\n--- Verificando página HTML pública ---`)
  const htmlRes = await fetch('https://jsadr.com.co/api/verificar', { cache: 'no-store' })
  console.log(`GET /api/verificar (sin codigo) → HTTP ${htmlRes.status}`)
  const htmlText = await htmlRes.text()
  if (htmlText.includes('Verificar autenticidad') && htmlText.includes('JSADR')) {
    console.log(`✓ Página de input HTML accesible públicamente`)
  } else {
    console.log(`✗ Página HTML no contiene el contenido esperado`)
  }

  // 4. Verificar la página HTML con un código válido
  if (prestamos.length > 0) {
    const codigo = generarCodigoDoc(prestamos[0], 'pagare-diligenciado')
    const htmlRes2 = await fetch(`https://jsadr.com.co/api/verificar?codigo=${codigo}`, { cache: 'no-store' })
    console.log(`\nGET /api/verificar?codigo=${codigo} → HTTP ${htmlRes2.status}`)
    const htmlText2 = await htmlRes2.text()
    const tieneCliente = htmlText2.includes('Datos del Cliente')
    const tieneCuenta = htmlText2.includes('Cuenta de Origen')
    const tieneCredito = htmlText2.includes('Datos del Crédito')
    const tieneFirma = htmlText2.includes('Firma Electrónica')
    console.log(`  ✓ Contiene sección "Datos del Cliente": ${tieneCliente}`)
    console.log(`  ✓ Contiene sección "Cuenta de Origen": ${tieneCuenta}`)
    console.log(`  ✓ Contiene sección "Datos del Crédito": ${tieneCredito}`)
    console.log(`  ✓ Contiene sección "Firma Electrónica": ${tieneFirma}`)
    if (tieneCliente && tieneCuenta && tieneCredito && tieneFirma) {
      console.log(`  ✓✓ HTML público muestra todas las secciones nuevas`)
    } else {
      console.log(`  ✗ Faltan secciones en el HTML`)
    }
  }
}

main().catch(e => { console.error('Error:', e); process.exit(1) }).finally(() => db.$disconnect())
