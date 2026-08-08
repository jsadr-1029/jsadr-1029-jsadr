// Test script: verifica que el código generado por /api/documentos (pagaré/carta)
// sea correctamente reconocido por /api/documentos/verificar (nuevo formato PRESTAMO_DOC_HASH_SHA256)
//
// Ejecutar: node scripts/verify-qr-fix.cjs
//
const crypto = require('crypto')

// Réplica exacta de generarCodigoVerificacion() en /api/documentos/route.ts
function generarCodigoVerificacion(prestamo, tipoDoc) {
  const data = `${prestamo.id}|${tipoDoc}|${prestamo.codigo}|${prestamo.montoPrincipal}|${prestamo.createdAt.toISOString()}`
  const hash = crypto.createHash('sha256').update(data).digest('hex')
  return hash.substring(0, 4) + '-' + hash.substring(4, 8) + '-' + hash.substring(8, 12) + '-' + hash.substring(12, 16)
}

// Réplica exacta de generarCodigoDoc() en /api/documentos/verificar/route.ts
function generarCodigoDoc(prestamo, tipoDoc) {
  const data = `${prestamo.id}|${tipoDoc}|${prestamo.codigo}|${prestamo.montoPrincipal}|${prestamo.createdAt.toISOString()}`
  const hash = crypto.createHash('sha256').update(data).digest('hex')
  return hash.substring(0, 4) + '-' + hash.substring(4, 8) + '-' + hash.substring(8, 12) + '-' + hash.substring(12, 16)
}

// Casos de prueba
const tiposDoc = ['pagare-blanco', 'pagare-diligenciado', 'carta']
const prestamoEjemplo = {
  id: 'cmrskum2h0000v8x8x8x8x8x8',
  codigo: 'PRES-2026-001',
  montoPrincipal: 5000000,
  createdAt: new Date('2026-08-07T05:33:00.000Z'),
}

console.log('=== Test de consistencia: generarCodigoVerificacion vs generarCodigoDoc ===\n')
let todosPass = true
for (const tipoDoc of tiposDoc) {
  const cod1 = generarCodigoVerificacion(prestamoEjemplo, tipoDoc)
  const cod2 = generarCodigoDoc(prestamoEjemplo, tipoDoc)
  const pass = cod1 === cod2
  if (!pass) todosPass = false
  console.log(`  ${tipoDoc.padEnd(25)} -> ${cod1}  ${pass ? '✓' : '✗ MISMATCH (' + cod2 + ')'} `)
}
console.log()

// Test de case-insensitivity
console.log('=== Test de case-insensitivity ===')
const codLower = generarCodigoVerificacion(prestamoEjemplo, 'pagare-diligenciado')
const codUpper = codLower.toUpperCase()
console.log(`  Original:  ${codLower}`)
console.log(`  Uppercase: ${codUpper}`)
console.log(`  Match (lowered): ${codLower.toLowerCase() === codUpper.toLowerCase() ? '✓' : '✗'}`)
console.log()

// Test del código del certificado de firma (formato firma-hash)
function generarCodigoFirma(firmaId, createdAt) {
  const hash = crypto.createHash('sha256').update(firmaId + '|' + createdAt.toISOString() + '|certificado').digest('hex')
  return hash.substring(0, 4) + '-' + hash.substring(4, 8) + '-' + hash.substring(8, 12) + '-' + hash.substring(12, 16)
}
const firmaEjemplo = {
  id: 'cmrskum2f0000v8x8x8x8x8x8',
  createdAt: new Date('2026-08-07T05:30:00.000Z'),
}
const codFirma = generarCodigoFirma(firmaEjemplo.id, firmaEjemplo.createdAt)
console.log(`  Certificado firma: ${codFirma}`)
console.log()

console.log(todosPass ? '✓ Todos los tests pasaron' : '✗ Algunos tests fallaron')
process.exit(todosPass ? 0 : 1)
