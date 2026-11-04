// Genera el PDF localmente usando el mismo código que Vercel
// para comparar las fechas que muestra.

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Buscar el documento HVZ157
  const doc = await prisma.contratoDocumentoVehiculo.findFirst({
    where: { numeroContrato: 'CTR-20261104-000001' },
  })
  if (!doc) {
    console.log('NO ENCONTRADO')
    return
  }
  
  console.log('=== DATOS LEÍDOS DE LA DB (localmente) ===')
  console.log('numeroContrato:', doc.numeroContrato)
  console.log('fechaInicio raw:', doc.fechaInicio)
  console.log('fechaFin raw:', doc.fechaFin)
  console.log('fechaInicio ISO:', doc.fechaInicio.toISOString())
  console.log('fechaFin ISO:', doc.fechaFin.toISOString())
  console.log('')
  
  // Aplicar la función fmtFechaCorta actual (con toISOString)
  function fmtFechaCorta(f) {
    if (!f) return 'N/A'
    const d = typeof f === 'string' ? new Date(f) : f
    const iso = d.toISOString()
    const [yyyy, mm, dd] = iso.split('T')[0].split('-')
    return `${dd} / ${mm} / ${yyyy}`
  }
  
  console.log('=== APLICANDO fmtFechaCorta (con toISOString) ===')
  console.log('fechaInicio formateada:', fmtFechaCorta(doc.fechaInicio))
  console.log('fechaFin formateada:', fmtFechaCorta(doc.fechaFin))
  console.log('')
  
  // Aplicar la función fmtFechaCorta vieja (con getDate)
  function fmtFechaCortaVieja(f) {
    if (!f) return 'N/A'
    const d = typeof f === 'string' ? new Date(f) : f
    return `${String(d.getDate()).padStart(2, '0')} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${d.getFullYear()}`
  }
  
  console.log('=== APLICANDO fmtFechaCorta VIEJA (con getDate) ===')
  console.log('fechaInicio formateada:', fmtFechaCortaVieja(doc.fechaInicio))
  console.log('fechaFin formateada:', fmtFechaCortaVieja(doc.fechaFin))
  console.log('')
  
  // Aplicar con UTC
  function fmtFechaCortaUTC(f) {
    if (!f) return 'N/A'
    const d = typeof f === 'string' ? new Date(f) : f
    return `${String(d.getUTCDate()).padStart(2, '0')} / ${String(d.getUTCMonth() + 1).padStart(2, '0')} / ${d.getUTCFullYear()}`
  }
  
  console.log('=== APLICANDO fmtFechaCorta UTC (con getUTCDate) ===')
  console.log('fechaInicio formateada:', fmtFechaCortaUTC(doc.fechaInicio))
  console.log('fechaFin formateada:', fmtFechaCortaUTC(doc.fechaFin))
  console.log('')
  console.log('TZ del proceso:', process.env.TZ)
}

main().finally(() => prisma.$disconnect())
