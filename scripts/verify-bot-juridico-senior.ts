// Script de verificación: confirma que el dataset avanzado del bot jurídico
// está correctamente cargado y que las preguntas de validación encuentran match.
import { DATASETS_POR_BOT, getNombreEspecialidad } from '../src/lib/bot-datasets'
import { buscarMejorMatch, normalizarTexto } from '../src/lib/bot-fuzzy-matcher'
import { PERFIL_BOT_JURIDICO, construirResumenPerfilProfesional } from '../src/lib/bot-juridico-perfil'

// Pruebas de validación inline (espejo de las que están en bot-trainer.ts)
const PRUEBAS_VALIDACION_JURIDICO: Array<{ pregunta: string; categoriaEsperada?: string }> = [
  { pregunta: 'cuantos casos juridicos hay', categoriaEsperada: 'CASOS' },
  { pregunta: 'casos que requieren atencion', categoriaEsperada: 'CASOS' },
  { pregunta: 'candidatos a juridico', categoriaEsperada: 'CASOS' },
  { pregunta: 'iniciar proceso judicial', categoriaEsperada: 'PROCESOS' },
  { pregunta: 'proceso ejecutivo', categoriaEsperada: 'PROCESOS' },
  { pregunta: 'prescripcion de deuda', categoriaEsperada: 'PROCESOS' },
  { pregunta: 'codigo civil obligaciones', categoriaEsperada: 'NORMATIVIDAD' },
  { pregunta: 'ley de usura', categoriaEsperada: 'NORMATIVIDAD' },
  { pregunta: 'estatuto del consumidor', categoriaEsperada: 'NORMATIVIDAD' },
  { pregunta: 'habeas data', categoriaEsperada: 'NORMATIVIDAD' },
  // Pruebas del perfil profesional senior (25 años de experiencia)
  { pregunta: 'cuantos anos de experiencia tienes como abogado', categoriaEsperada: 'PERFIL_PROFESIONAL' },
  { pregunta: 'cual es tu formacion academica', categoriaEsperada: 'PERFIL_PROFESIONAL' },
  { pregunta: 'tienes maestria en derecho', categoriaEsperada: 'PERFIL_PROFESIONAL' },
  { pregunta: 'cual es tu especializacion', categoriaEsperada: 'PERFIL_PROFESIONAL' },
  { pregunta: 'eres abogado litigante', categoriaEsperada: 'PERFIL_PROFESIONAL' },
  // Pruebas de jurisprudencia avanzada
  { pregunta: 'jurisprudencia Corte Suprema sobre intereses moratorios', categoriaEsperada: 'JURISPRUDENCIA' },
  { pregunta: 'jurisprudencia reporte a centrales de riesgo', categoriaEsperada: 'JURISPRUDENCIA' },
  { pregunta: 'accion pauliana ocultamiento de bienes', categoriaEsperada: 'JURISPRUDENCIA_AVANZADA' },
  { pregunta: 'diferencia entre proceso ejecutivo y monitorio', categoriaEsperada: 'DOCTRINA_MODERNA' },
  // Pruebas de doctrina avanzada
  { pregunta: 'que es el anatocismo', categoriaEsperada: 'DOCTRINA' },
  { pregunta: 'mora ex re en obligaciones a plazo', categoriaEsperada: 'DOCTRINA' },
  { pregunta: 'prescripcion extintiva de un pagare', categoriaEsperada: 'DOCTRINA' },
  // Pruebas de SARLAFT/SAGRILAFT
  { pregunta: 'que es el sagrilaft', categoriaEsperada: 'DOCTRINA_MODERNA' },
  { pregunta: 'que es el sarlaft', categoriaEsperada: 'SARLAFT' },
  // Pruebas de estrategia
  { pregunta: 'cuando conviene demandar', categoriaEsperada: 'ESTRATEGIA' },
  { pregunta: 'como negociar acuerdo de pago', categoriaEsperada: 'ESTRATEGIA' },
]

console.log('═══════════════════════════════════════════════════')
console.log('  VERIFICACIÓN DEL BOT JURÍDICO SENIOR')
console.log('═══════════════════════════════════════════════════\n')

// 1. Perfil profesional
console.log('【1】 PERFIL PROFESIONAL DEL BOT JURÍDICO')
console.log('   • Nombre:', PERFIL_BOT_JURIDICO.nombre)
console.log('   • Título:', PERFIL_BOT_JURIDICO.titulo)
console.log('   • Años de experiencia:', PERFIL_BOT_JURIDICO.aniosExperiencia)
console.log('   • Formación académica:')
PERFIL_BOT_JURIDICO.formacionAcademica.forEach((f) => {
  console.log(`     - ${f.nivel}: ${f.titulo} — ${f.institucion} (${f.año})`)
})
console.log('   • Especializaciones:', PERFIL_BOT_JURIDICO.especializaciones.length, 'áreas')
console.log('   • Áreas de práctica:', PERFIL_BOT_JURIDICO.areasPractica.length, 'áreas')
console.log('   • Publicaciones:', PERFIL_BOT_JURIDICO.publicacionesDoctrina.length, 'obras doctrinales')
console.log('   • Afiliaciones:', PERFIL_BOT_JURIDICO.afiliacionesProfesionales.length)
console.log('   • Idiomas:', PERFIL_BOT_JURIDICO.idiomas.length)
console.log()

// 2. Dataset del bot jurídico
const datasetJuridico = DATASETS_POR_BOT['JURIDICO'] || []
console.log('【2】 DATASET DEL BOT JURÍDICO')
console.log('   • Total items Q&A:', datasetJuridico.length)

// Contar por categoría
const porCategoria: Record<string, number> = {}
datasetJuridico.forEach((item) => {
  const cat = item.categoria || 'SIN_CATEGORIA'
  porCategoria[cat] = (porCategoria[cat] || 0) + 1
})
console.log('   • Categorías cubiertas:', Object.keys(porCategoria).length)
Object.entries(porCategoria)
  .sort(([, a], [, b]) => b - a)
  .forEach(([cat, count]) => {
    console.log(`     · ${cat}: ${count} items`)
  })

const totalSinonimos = datasetJuridico.reduce((s, it) => s + (it.sinonimos?.length || 0), 0)
console.log('   • Total sinónimos:', totalSinonimos)
console.log('   • Nombre de especialidad:', getNombreEspecialidad('JURIDICO'))
console.log()

// 3. Pruebas de validación del bot jurídico
console.log('【3】 PRUEBAS DE VALIDACIÓN (preguntas de test)')

const pruebas = PRUEBAS_VALIDACION_JURIDICO
console.log('   • Total pruebas:', pruebas.length)

let exitosas = 0
let fallidas = 0
const detalles: Array<{ pregunta: string; esperada: string; encontrada: string | null; score: number; exito: boolean }> = []

for (const prueba of pruebas) {
  const resultado = buscarMejorMatch(prueba.pregunta, datasetJuridico, 0.4)
  const exito = resultado.item !== null && resultado.score >= 0.4
  if (exito) exitosas++
  else fallidas++
  detalles.push({
    pregunta: prueba.pregunta,
    esperada: prueba.categoriaEsperada || '?',
    encontrada: resultado.item?.categoria || null,
    score: resultado.score,
    exito,
  })
}

console.log(`   • Exitosas: ${exitosas}/${pruebas.length}`)
console.log(`   • Fallidas: ${fallidas}/${pruebas.length}`)
console.log(`   • Tasa de éxito: ${((exitosas / pruebas.length) * 100).toFixed(1)}%`)
console.log()

console.log('   Detalle de pruebas:')
detalles.forEach((d, i) => {
  const status = d.exito ? '✓' : '✗'
  const cat = d.encontrada || '(no match)'
  console.log(`   ${status} [${i + 1}] "${d.pregunta}"`)
  console.log(`      Esperada: ${d.esperada} | Encontrada: ${cat} | Score: ${d.score.toFixed(2)}`)
})

// 4. Resumen del perfil para inyección en system prompt
console.log()
console.log('【4】 RESUMEN DEL PERFIL (primeros 800 caracteres):')
const resumen = construirResumenPerfilProfesional()
console.log(resumen.substring(0, 800))
console.log(`\n   (longitud total del resumen: ${resumen.length} caracteres)`)

// 5. Verificación final
console.log()
console.log('═══════════════════════════════════════════════════')
console.log('  RESUMEN FINAL')
console.log('═══════════════════════════════════════════════════')
console.log(`✓ Bot Jurídico Senior: ${PERFIL_BOT_JURIDICO.aniosExperiencia} años de experiencia`)
console.log(`✓ Formación: ${PERFIL_BOT_JURIDICO.formacionAcademica.length} programas académicos`)
console.log(`✓ Especialidades: ${PERFIL_BOT_JURIDICO.especializaciones.length} áreas de profundización`)
console.log(`✓ Dataset: ${datasetJuridico.length} items Q&A con ${totalSinonimos} sinónimos`)
console.log(`✓ Cobertura de validación: ${((exitosas / pruebas.length) * 100).toFixed(1)}% (${exitosas}/${pruebas.length})`)
console.log('═══════════════════════════════════════════════════')
