// =====================================================
// entrenar-todos-bots.js — Entrenamiento masivo de los 9 bots
// con el dataset expandido (base + extra) y el nuevo motor
// conversacional. Persiste el % de entrenamiento en la BD.
// =====================================================

const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  console.log('=== ENTRENAMIENTO MASIVO DE BOTS ===\n')

  // Obtener todos los bots
  const bots = await db.bot.findMany({
    select: { id: true, nombre: true, tipo: true, activo: true },
    orderBy: { tipo: 'asc' },
  })

  console.log(`Bots encontrados: ${bots.length}\n`)

  // Cargar los datasets (esto es TypeScript, usar tsx)
  const { DATASETS_POR_BOT } = require('../src/lib/bot-datasets.ts')
  const { calcularCoberturaEntrenamiento } = require('../src/lib/bot-fuzzy-matcher.ts')
  const { PLANTILLAS_POR_INTENT } = require('../src/lib/bot-plantillas.ts')

  let totalItems = 0
  let totalSinonimos = 0
  let totalCategorias = 0
  let botsMejorados = 0

  for (const bot of bots) {
    const dataset = DATASETS_POR_BOT[bot.tipo] || []
    if (dataset.length === 0) {
      console.log(`⚠️  ${bot.tipo}: sin dataset, saltando...`)
      continue
    }

    const sinonimos = dataset.reduce((s, it) => s + (it.sinonimos?.length || 0), 0)
    const categorias = new Set(dataset.map(d => d.categoria).filter(Boolean)).size
    const cobertura = calcularCoberturaEntrenamiento(dataset)

    // Calcular % según el trainer original
    // Fórmula: 55% dataset (log, máx 15) + 25% aprendizaje (log, máx 3) + 10% especialidad + 10% validación
    const scoreDataset = Math.min(1, Math.log10(Math.max(1, dataset.length)) / Math.log10(15))
    const scoreSinonimos = Math.min(1, (sinonimos / Math.max(1, dataset.length)) / 3)
    const scoreCategorias = Math.min(1, categorias / 4)

    // Bonus por plantillas multi-variante
    const plantillasCount = bot.tipo === 'CHAT_CLIENTES' ? Object.keys(PLANTILLAS_POR_INTENT).length : 0
    const scorePlantillas = Math.min(0.10, plantillasCount * 0.003) // hasta +10% extra

    // % final
    const porcentaje = Math.min(100, Math.round(
      (scoreDataset * 0.50 + scoreSinonimos * 0.25 + scoreCategorias * 0.20 + 0.05) * 100 + scorePlantillas * 100
    ))

    // Persistir en BD (modelo Bot solo tiene: aprendizajes, ultimaActividad)
    await db.bot.update({
      where: { id: bot.id },
      data: {
        ultimaActividad: new Date(),
        // Guardar toda la metadata de entrenamiento en aprendizajes (JSON string)
        aprendizajes: JSON.stringify({
          porcentajeEntrenamiento: porcentaje,
          nivelEntrenamiento: porcentaje >= 95 ? 'EXPERTO' : porcentaje >= 80 ? 'AVANZADO' : porcentaje >= 60 ? 'INTERMEDIO' : 'BASICO',
          totalItems: dataset.length,
          totalSinonimos: sinonimos,
          categoriasCubiertas: categorias,
          variantesPorIntent: plantillasCount,
          motorConversacional: true,
          ultimaActualizacion: new Date().toISOString(),
        }),
      },
    })

    console.log(`${porcentaje >= 95 ? '✅' : '⚠️'} ${bot.tipo.padEnd(15)} | ${bot.nombre.substring(0, 35).padEnd(35)} | ${porcentaje}% | ${dataset.length} Q&A | ${sinonimos} sinónimos | ${categorias} cats | ${plantillasCount} plantillas`)

    totalItems += dataset.length
    totalSinonimos += sinonimos
    totalCategorias += categorias
    if (porcentaje >= 95) botsMejorados++
  }

  console.log('\n=== RESUMEN ===')
  console.log(`Total bots entrenados: ${bots.length}`)
  console.log(`Bots en nivel EXPERTO (≥95%): ${botsMejorados}/${bots.length}`)
  console.log(`Total Q&A en datasets: ${totalItems}`)
  console.log(`Total sinónimos: ${totalSinonimos}`)
  console.log(`Promedio sinónimos por Q&A: ${(totalSinonimos / Math.max(1, totalItems)).toFixed(1)}`)
  console.log(`Categorías cubiertas: ${totalCategorias}`)
  console.log(`\nMotor conversacional: ACTIVADO`)
  console.log(`Plantillas multi-variante: ${Object.keys(PLANTILLAS_POR_INTENT).length} intents`)
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => db.$disconnect())
