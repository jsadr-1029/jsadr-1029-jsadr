// =====================================================
// auditoria-bot-juridico-integral.ts
// =====================================================
// Auditoría integral del Bot Jurídico que evalúa 12 dimensiones
// y calcula el porcentaje de cumplimiento total.
//
// Dimensiones auditadas:
//   D1.  Perfil profesional (25 años exp, especialización, maestría)
//   D2.  Sistema de memoria persistente (bot-memoria.ts + tabla BD)
//   D3.  Motor conversacional fluido (bot-conversacional.ts, no menú)
//   D4.  Datasets cargados (base + colombia + avanzado + masivo)
//   D5.  Pruebas de validación internas (26 preguntas de test)
//   D6.  Cobertura de áreas de práctica (12 ramas del derecho)
//   D7.  Sinónimos para matching fuzzy
//   D8.  Integración con LLM (z-ai-web-dev-sdk)
//   D9.  Sistema de escalamiento a humano
//   D10. Detección de tono y follow-ups naturales
//   D11. Cumplimiento normativo colombiano (leyes citadas)
//   D12. Estilo conversacional fluido (no menús numerados)
// =====================================================

import { DATASETS_POR_BOT, getNombreEspecialidad } from '../src/lib/bot-datasets'
import { buscarMejorMatch, normalizarTexto } from '../src/lib/bot-fuzzy-matcher'
import { PERFIL_BOT_JURIDICO, construirResumenPerfilProfesional } from '../src/lib/bot-juridico-perfil'
import * as fs from 'fs'
import * as path from 'path'

// =====================================================
// Tipos
// =====================================================
interface Hallazgo {
  dimension: string
  severidad: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO'
  descripcion: string
  detalle?: string
}

interface ResultadoDimension {
  dimension: string
  porcentaje: number
  maximo: number
  hallazgos: Hallazgo[]
  detalles: string[]
}

// =====================================================
// Pruebas de validación (espejo de bot-trainer.ts)
// =====================================================
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
  { pregunta: 'cuantos anos de experiencia tienes como abogado', categoriaEsperada: 'PERFIL_PROFESIONAL' },
  { pregunta: 'cual es tu formacion academica', categoriaEsperada: 'PERFIL_PROFESIONAL' },
  { pregunta: 'tienes maestria en derecho', categoriaEsperada: 'PERFIL_PROFESIONAL' },
  { pregunta: 'cual es tu especializacion', categoriaEsperada: 'PERFIL_PROFESIONAL' },
  { pregunta: 'eres abogado litigante', categoriaEsperada: 'PERFIL_PROFESIONAL' },
  { pregunta: 'jurisprudencia Corte Suprema sobre intereses moratorios', categoriaEsperada: 'JURISPRUDENCIA' },
  { pregunta: 'jurisprudencia reporte a centrales de riesgo', categoriaEsperada: 'JURISPRUDENCIA' },
  { pregunta: 'accion pauliana ocultamiento de bienes', categoriaEsperada: 'JURISPRUDENCIA_AVANZADA' },
  { pregunta: 'diferencia entre proceso ejecutivo y monitorio', categoriaEsperada: 'DOCTRINA_MODERNA' },
  { pregunta: 'que es el anatocismo', categoriaEsperada: 'DOCTRINA' },
  { pregunta: 'mora ex re en obligaciones a plazo', categoriaEsperada: 'DOCTRINA' },
  { pregunta: 'prescripcion extintiva de un pagare', categoriaEsperada: 'DOCTRINA' },
  { pregunta: 'que es el sagrilaft', categoriaEsperada: 'DOCTRINA_MODERNA' },
  { pregunta: 'que es el sarlaft', categoriaEsperada: 'SARLAFT' },
  { pregunta: 'cuando conviene demandar', categoriaEsperada: 'ESTRATEGIA' },
  { pregunta: 'como negociar acuerdo de pago', categoriaEsperada: 'ESTRATEGIA' },
]

// =====================================================
// 50 preguntas conversacionales adicionales para evaluar cobertura 500+
// =====================================================
const PREGUNTAS_CONVERSACIONALES_500: Array<{ pregunta: string; area: string }> = [
  // CIVIL
  { pregunta: 'que pasa si no me entregaron el dinero del prestamo pero firme el pagare', area: 'CIVIL' },
  { pregunta: 'puedo demandar si me deben hace mas de tres anos', area: 'CIVIL' },
  { pregunta: 'que hago si el codeudor de mi prestamo fallecio', area: 'CIVIL' },
  { pregunta: 'es valido un contrato que firme borracho', area: 'CIVIL' },
  { pregunta: 'puedo retractarme de un contrato firmado hace tres dias', area: 'CIVIL' },
  { pregunta: 'cuanto cobran de intereses por mora legalmente', area: 'CIVIL' },
  { pregunta: 'puedo demandar dano moral sin pruebas fisicas', area: 'CIVIL' },
  { pregunta: 'diferencia entre fianza y codeudor solidario', area: 'CIVIL' },
  { pregunta: 'puedo cobrar intereses sobre intereses anatocismo', area: 'CIVIL' },
  { pregunta: 'como se interpreta una clausula ambigua en mi contrato', area: 'CIVIL' },
  // COMERCIAL
  { pregunta: 'que es un titulo valor en colombia', area: 'COMERCIAL' },
  { pregunta: 'requisitos del pagare en colombia', area: 'COMERCIAL' },
  { pregunta: 'que es la accion cambiaria directa', area: 'COMERCIAL' },
  { pregunta: 'que es el endoso de un titulo valor', area: 'COMERCIAL' },
  { pregunta: 'que es el aval cambiario', area: 'COMERCIAL' },
  { pregunta: 'tipos de sociedades en colombia', area: 'COMERCIAL' },
  { pregunta: 'que es el mutuo mercantil', area: 'COMERCIAL' },
  { pregunta: 'como constituyo una sas en colombia', area: 'COMERCIAL' },
  { pregunta: 'que es el protesto notarial', area: 'COMERCIAL' },
  { pregunta: 'diferencia entre sas y limitada', area: 'COMERCIAL' },
  // PENAL ECONOMICO
  { pregunta: 'que es el delito de usura en colombia', area: 'PENAL' },
  { pregunta: 'que es el delito de estafa', area: 'PENAL' },
  { pregunta: 'que es el fraude procesal', area: 'PENAL' },
  { pregunta: 'que es el lavado de activos', area: 'PENAL' },
  { pregunta: 'responsabilidad penal de la empresa ley 1778', area: 'PENAL' },
  // PROCESAL
  { pregunta: 'que es el proceso ejecutivo', area: 'PROCESAL' },
  { pregunta: 'que son las medidas cautelares', area: 'PROCESAL' },
  { pregunta: 'como funciona el embargo y remate', area: 'PROCESAL' },
  { pregunta: 'que es el proceso monitorio', area: 'PROCESAL' },
  { pregunta: 'que es la conciliacion extrajudicial', area: 'PROCESAL' },
  { pregunta: 'que es el arbitramento', area: 'PROCESAL' },
  // LABORAL
  { pregunta: 'como se liquida un contrato de trabajo', area: 'LABORAL' },
  { pregunta: 'que es el despido sin justa causa', area: 'LABORAL' },
  { pregunta: 'como se calculan las cesantias', area: 'LABORAL' },
  { pregunta: 'que es el fuero de maternidad', area: 'LABORAL' },
  // FINANCIERO
  { pregunta: 'que es el microcredito ley 1520', area: 'FINANCIERO' },
  { pregunta: 'que es la tasa bancaria corriente', area: 'FINANCIERO' },
  { pregunta: 'que es el defensor del consumidor financiero', area: 'FINANCIERO' },
  { pregunta: 'que son las garantias mobiliarias ley 1676', area: 'FINANCIERO' },
  // CONSUMIDOR
  { pregunta: 'que es el estatuto del consumidor ley 1480', area: 'CONSUMIDOR' },
  { pregunta: 'que son las clausulas abusivas', area: 'CONSUMIDOR' },
  { pregunta: 'como presento una pqr', area: 'CONSUMIDOR' },
  // DATOS PERSONALES
  { pregunta: 'que son los derechos arco', area: 'DATOS' },
  { pregunta: 'que es el habeas data financiero', area: 'DATOS' },
  { pregunta: 'como reporto a datacredito', area: 'DATOS' },
  // CONSTITUCIONAL
  { pregunta: 'cuando procede la accion de tutela', area: 'CONSTITUCIONAL' },
  { pregunta: 'que es el minimo vital en cobranzas', area: 'CONSTITUCIONAL' },
  // TRIBUTARIO
  { pregunta: 'que es el impuesto de renta en colombia', area: 'TRIBUTARIO' },
  { pregunta: 'que es el 4 por mil gmf', area: 'TRIBUTARIO' },
  // CONCURSAL
  { pregunta: 'que es la reorganizacion empresarial ley 1116', area: 'CONCURSAL' },
  { pregunta: 'que es la liquidacion judicial', area: 'CONCURSAL' },
]

// =====================================================
// Función principal de auditoría
// =====================================================
function auditar() {
  const resultados: ResultadoDimension[] = []
  const hallazgosGlobales: Hallazgo[] = []

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  AUDITORÍA INTEGRAL — BOT JURÍDICO JSADR')
  console.log('  Fecha: ' + new Date().toLocaleString('es-CO'))
  console.log('═══════════════════════════════════════════════════════════════\n')

  // =================================================
  // D1. PERFIL PROFESIONAL (10 pts)
  // =================================================
  {
    const hallazgos: Hallazgo[] = []
    const detalles: string[] = []
    let puntos = 0
    const max = 10

    // 25 años de experiencia
    if (PERFIL_BOT_JURIDICO.aniosExperiencia >= 25) {
      puntos += 2
      detalles.push(`✓ Experiencia: ${PERFIL_BOT_JURIDICO.aniosExperiencia} años (meta >=25)`)
    } else {
      hallazgos.push({
        dimension: 'D1',
        severidad: 'CRITICO',
        descripcion: 'Años de experiencia insuficientes',
        detalle: `Tiene ${PERFIL_BOT_JURIDICO.aniosExperiencia}, se requieren >=25`,
      })
    }

    // Pregrado
    const pregrado = PERFIL_BOT_JURIDICO.formacionAcademica.find(f => f.nivel === 'PREGRADO')
    if (pregrado) {
      puntos += 1
      detalles.push(`✓ Pregrado: ${pregrado.titulo} — ${pregrado.institucion}`)
    } else {
      hallazgos.push({ dimension: 'D1', severidad: 'CRITICO', descripcion: 'Sin pregrado en derecho' })
    }

    // Especialización
    const espec = PERFIL_BOT_JURIDICO.formacionAcademica.find(f => f.nivel === 'ESPECIALIZACION')
    if (espec) {
      puntos += 2
      detalles.push(`✓ Especialización: ${espec.titulo} — ${espec.institucion}`)
    } else {
      hallazgos.push({ dimension: 'D1', severidad: 'ALTO', descripcion: 'Sin especialización' })
    }

    // Maestría
    const maestria = PERFIL_BOT_JURIDICO.formacionAcademica.find(f => f.nivel === 'MAESTRIA')
    if (maestria) {
      puntos += 3
      detalles.push(`✓ Maestría: ${maestria.titulo} — ${maestria.institucion}`)
    } else {
      hallazgos.push({ dimension: 'D1', severidad: 'ALTO', descripcion: 'Sin maestría' })
    }

    // Diplomados
    const diplomados = PERFIL_BOT_JURIDICO.formacionAcademica.filter(f => f.nivel === 'DIPLOMADO')
    if (diplomados.length >= 3) {
      puntos += 2
      detalles.push(`✓ Diplomados: ${diplomados.length} (meta >=3)`)
    } else if (diplomados.length > 0) {
      puntos += 1
      detalles.push(`△ Diplomados: ${diplomados.length} (recomendado >=3)`)
    } else {
      hallazgos.push({ dimension: 'D1', severidad: 'MEDIO', descripcion: 'Sin diplomados' })
    }

    // Especialidades (mínimo 10 áreas)
    if (PERFIL_BOT_JURIDICO.especializaciones.length >= 10) {
      detalles.push(`✓ Especialidades: ${PERFIL_BOT_JURIDICO.especializaciones.length} áreas`)
    } else {
      hallazgos.push({ dimension: 'D1', severidad: 'MEDIO', descripcion: 'Pocas especialidades declaradas' })
    }

    resultados.push({ dimension: 'D1. Perfil Profesional', porcentaje: puntos, maximo: max, hallazgos, detalles })
  }

  // =================================================
  // D2. SISTEMA DE MEMORIA PERSISTENTE (10 pts)
  // =================================================
  {
    const hallazgos: Hallazgo[] = []
    const detalles: string[] = []
    let puntos = 0
    const max = 10

    const memoriaPath = path.join(__dirname, '..', 'src', 'lib', 'bot-memoria.ts')
    if (fs.existsSync(memoriaPath)) {
      puntos += 3
      const content = fs.readFileSync(memoriaPath, 'utf8')
      detalles.push('✓ Archivo bot-memoria.ts existe')

      // Funciones clave
      const funcionesEsperadas = [
        'guardarMensajeMemoria',
        'recordarHecho',
        'recordarPreferencia',
        'guardarResumenConversacion',
        'cargarContextoMemoria',
        'construirTextoContexto',
        'detectarYRecordarHechos',
        'registrarAprendizaje',
        'cerrarYResumirConversacion',
        'borrarMemoriaUsuario',
      ]
      let encontradas = 0
      for (const fn of funcionesEsperadas) {
        if (content.includes(`export async function ${fn}`) || content.includes(`export function ${fn}`)) {
          encontradas++
        }
      }
      if (encontradas === funcionesEsperadas.length) {
        puntos += 4
        detalles.push(`✓ Las ${encontradas}/${funcionesEsperadas.length} funciones de memoria están implementadas`)
      } else {
        hallazgos.push({
          dimension: 'D2',
          severidad: 'ALTO',
          descripcion: `Faltan funciones de memoria: ${encontradas}/${funcionesEsperadas.length}`,
        })
      }

      // Tipos de memoria
      if (content.includes("'CONTEXTO'") && content.includes("'HECHO'") &&
          content.includes("'PREFERENCIA'") && content.includes("'RESUMEN'")) {
        puntos += 2
        detalles.push('✓ Tipos de memoria: CONTEXTO, HECHO, PREFERENCIA, RESUMEN')
      } else {
        hallazgos.push({ dimension: 'D2', severidad: 'MEDIO', descripcion: 'Faltan tipos de memoria' })
      }

      // Decaimento por antigüedad
      if (content.includes('decaerPeso') || content.includes('HALF_VIDA_DIAS')) {
        puntos += 1
        detalles.push('✓ Sistema de decaimiento de peso por antigüedad')
      } else {
        hallazgos.push({ dimension: 'D2', severidad: 'BAJO', descripcion: 'Sin decaimiento de peso' })
      }
    } else {
      hallazgos.push({ dimension: 'D2', severidad: 'CRITICO', descripcion: 'No existe bot-memoria.ts' })
    }

    // Verificar modelo en schema Prisma
    const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma')
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8')
      if (schema.includes('model MemoriaBot')) {
        puntos += 1
        detalles.push('✓ Modelo MemoriaBot en schema Prisma')
      } else {
        hallazgos.push({ dimension: 'D2', severidad: 'ALTO', descripcion: 'Falta model MemoriaBot en Prisma' })
      }
    }

    resultados.push({ dimension: 'D2. Memoria Persistente', porcentaje: puntos, maximo: max, hallazgos, detalles })
  }

  // =================================================
  // D3. MOTOR CONVERSACIONAL FLUIDO (10 pts)
  // =================================================
  {
    const hallazgos: Hallazgo[] = []
    const detalles: string[] = []
    let puntos = 0
    const max = 10

    const conversacionalPath = path.join(__dirname, '..', 'src', 'lib', 'bot-conversacional.ts')
    if (fs.existsSync(conversacionalPath)) {
      puntos += 2
      const content = fs.readFileSync(conversacionalPath, 'utf8')
      detalles.push('✓ Archivo bot-conversacional.ts existe')

      // Detección de tono (no menú)
      if (content.includes('detectarTono') && content.includes('TonoUsuario')) {
        puntos += 2
        detalles.push('✓ Detección de tono (URGENTE, CASUAL, FORMAL, FRUSTRADO, NEUTRO)')
      } else {
        hallazgos.push({ dimension: 'D3', severidad: 'ALTO', descripcion: 'Sin detección de tono' })
      }

      // Frases puente naturales (no "escribe menú" en código real, ignorando comentarios)
      const lineasSinComentarios = content.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      const contentLimpio = lineasSinComentarios.join('\n')
      if (content.includes('FRASES_PUENTE') && !contentLimpio.includes('escribe menú') && !contentLimpio.includes('escribe menu')) {
        puntos += 2
        detalles.push('✓ Frases puente naturales (sin menús numerados en respuestas)')
      } else {
        hallazgos.push({ dimension: 'D3', severidad: 'ALTO', descripcion: 'Usa menús numerados en respuestas' })
      }

      // Follow-ups naturales
      if (content.includes('FOLLOWUPS_POR_INTENT') && content.includes('elegirFollowUp')) {
        puntos += 2
        detalles.push('✓ Follow-ups contextuales naturales')
      } else {
        hallazgos.push({ dimension: 'D3', severidad: 'MEDIO', descripcion: 'Sin follow-ups' })
      }

      // Plantillas multi-variante
      if (content.includes('resolverPlantilla') && content.includes('SALUDOS_NATURALES')) {
        puntos += 2
        detalles.push('✓ Plantillas multi-variante para variabilidad')
      } else {
        hallazgos.push({ dimension: 'D3', severidad: 'MEDIO', descripcion: 'Sin plantillas multi-variante' })
      }
    } else {
      hallazgos.push({ dimension: 'D3', severidad: 'CRITICO', descripcion: 'No existe bot-conversacional.ts' })
    }

    resultados.push({ dimension: 'D3. Motor Conversacional Fluido', porcentaje: puntos, maximo: max, hallazgos, detalles })
  }

  // =================================================
  // D4. DATASETS CARGADOS (10 pts)
  // =================================================
  {
    const hallazgos: Hallazgo[] = []
    const detalles: string[] = []
    let puntos = 0
    const max = 10

    const dataset = DATASETS_POR_BOT['JURIDICO'] || []
    if (dataset.length > 0) {
      puntos += 2
      detalles.push(`✓ Dataset JURIDICO cargado: ${dataset.length} items`)
    } else {
      hallazgos.push({ dimension: 'D4', severidad: 'CRITICO', descripcion: 'Dataset JURIDICO vacío' })
    }

    // Verificar que el dataset MASIVO está cargado (algunos items JU-MAS-*)
    const tieneMasivo = dataset.some(d => d.id.startsWith('JU-MAS-'))
    if (tieneMasivo) {
      puntos += 3
      const countMasivo = dataset.filter(d => d.id.startsWith('JU-MAS-')).length
      detalles.push(`✓ DATASET_JURIDICO_MASIVO cargado: ${countMasivo} items conversacionales`)
    } else {
      hallazgos.push({
        dimension: 'D4',
        severidad: 'CRITICO',
        descripcion: 'DATASET_JURIDICO_MASIVO NO está siendo importado en bot-datasets.ts',
        detalle: 'Falta agregar import y referencia en JURIDICO array',
      })
    }

    // Verificar COLOMBIA
    const tieneColombia = dataset.some(d => d.id.startsWith('JU-COL-'))
    if (tieneColombia) {
      puntos += 2
      const countCol = dataset.filter(d => d.id.startsWith('JU-COL-')).length
      detalles.push(`✓ DATASET_JURIDICO_COLOMBIA cargado: ${countCol} items normativos`)
    } else {
      hallazgos.push({ dimension: 'D4', severidad: 'CRITICO', descripcion: 'DATASET_JURIDICO_COLOMBIA no cargado' })
    }

    // Verificar AVANZADO
    const tieneAvanzado = dataset.some(d => d.id.startsWith('JU-ADV-'))
    if (tieneAvanzado) {
      puntos += 2
      const countAdv = dataset.filter(d => d.id.startsWith('JU-ADV-')).length
      detalles.push(`✓ DATASET_JURIDICO_AVANZADO cargado: ${countAdv} items avanzados`)
    } else {
      hallazgos.push({ dimension: 'D4', severidad: 'CRITICO', descripcion: 'DATASET_JURIDICO_AVANZADO no cargado' })
    }

    // Mínimo 100 items
    if (dataset.length >= 100) {
      puntos += 1
      detalles.push(`✓ Dataset supera mínimo de 100 items (${dataset.length})`)
    } else {
      hallazgos.push({ dimension: 'D4', severidad: 'ALTO', descripcion: `Dataset insuficiente: ${dataset.length} (mínimo 100)` })
    }

    resultados.push({ dimension: 'D4. Datasets Cargados', porcentaje: puntos, maximo: max, hallazgos, detalles })
  }

  // =================================================
  // D5. PRUEBAS DE VALIDACIÓN (15 pts)
  // =================================================
  {
    const hallazgos: Hallazgo[] = []
    const detalles: string[] = []
    let puntos = 0
    const max = 15

    const dataset = DATASETS_POR_BOT['JURIDICO'] || []
    let exitosas = 0
    let fallidas = 0
    const detallesFalla: string[] = []

    for (const prueba of PRUEBAS_VALIDACION_JURIDICO) {
      const resultado = buscarMejorMatch(prueba.pregunta, dataset, 0.4)
      const exito = resultado.item !== null && resultado.score >= 0.4
      if (exito) exitosas++
      else {
        fallidas++
        detallesFalla.push(`  ✗ "${prueba.pregunta}" → esperada ${prueba.categoriaEsperada}, score ${resultado.score.toFixed(2)}`)
      }
    }

    const tasa = (exitosas / PRUEBAS_VALIDACION_JURIDICO.length) * 100
    puntos = Math.round((exitosas / PRUEBAS_VALIDACION_JURIDICO.length) * max)

    detalles.push(`✓ Pruebas exitosas: ${exitosas}/${PRUEBAS_VALIDACION_JURIDICO.length} (${tasa.toFixed(1)}%)`)

    if (fallidas > 0) {
      hallazgos.push({
        dimension: 'D5',
        severidad: fallidas > 5 ? 'CRITICO' : 'ALTO',
        descripcion: `${fallidas} pruebas fallidas de ${PRUEBAS_VALIDACION_JURIDICO.length}`,
        detalle: detallesFalla.join('\n'),
      })
    }

    if (tasa >= 95) {
      detalles.push(`✓ Tasa >= 95% — cumplimiento óptimo`)
    } else if (tasa >= 80) {
      detalles.push(`△ Tasa >= 80% — cumplimiento aceptable pero mejorable`)
    } else {
      hallazgos.push({
        dimension: 'D5',
        severidad: 'CRITICO',
        descripcion: `Tasa de éxito por debajo del 80%`,
      })
    }

    resultados.push({ dimension: 'D5. Pruebas de Validación (26)', porcentaje: puntos, maximo: max, hallazgos, detalles })
  }

  // =================================================
  // D6. COBERTURA DE ÁREAS DE PRÁCTICA (10 pts)
  // =================================================
  {
    const hallazgos: Hallazgo[] = []
    const detalles: string[] = []
    let puntos = 0
    const max = 10

    const areasEsperadas = [
      'Civil', 'Comercial', 'Procesal', 'Financiero', 'Consumidor',
      'Datos', 'Penal', 'Laboral', 'Tributario', 'Concursal',
      'Constitucional', 'Compliance',
    ]

    const dataset = DATASETS_POR_BOT['JURIDICO'] || []
    const todasLasPreguntas = dataset.map(d => (d.pregunta + ' ' + (d.sinonimos?.join(' ') || '')).toLowerCase())

    let areasCubiertas = 0
    for (const area of areasEsperadas) {
      const encontrada = todasLasPreguntas.some(p => p.includes(area.toLowerCase()))
      if (encontrada) areasCubiertas++
      else {
        hallazgos.push({
          dimension: 'D6',
          severidad: 'MEDIO',
          descripcion: `Área no cubierta en dataset: ${area}`,
        })
      }
    }

    puntos = Math.round((areasCubiertas / areasEsperadas.length) * max)
    detalles.push(`✓ Áreas cubiertas: ${areasCubiertas}/${areasEsperadas.length}`)

    // Verificar que el perfil tiene las 12 áreas
    if (PERFIL_BOT_JURIDICO.areasPractica.length >= 12) {
      detalles.push(`✓ Perfil declara ${PERFIL_BOT_JURIDICO.areasPractica.length} áreas de práctica`)
    } else {
      hallazgos.push({
        dimension: 'D6',
        severidad: 'BAJO',
        descripcion: `Perfil declara ${PERFIL_BOT_JURIDICO.areasPractica.length} áreas (recomendado 12)`,
      })
    }

    resultados.push({ dimension: 'D6. Cobertura Áreas de Práctica (12)', porcentaje: puntos, maximo: max, hallazgos, detalles })
  }

  // =================================================
  // D7. SINÓNIMOS PARA MATCHING FUZZY (5 pts)
  // =================================================
  {
    const hallazgos: Hallazgo[] = []
    const detalles: string[] = []
    let puntos = 0
    const max = 5

    const dataset = DATASETS_POR_BOT['JURIDICO'] || []
    const totalSinonimos = dataset.reduce((s, it) => s + (it.sinonimos?.length || 0), 0)
    const promedioSinonimos = dataset.length > 0 ? totalSinonimos / dataset.length : 0

    if (promedioSinonimos >= 5) {
      puntos = max
      detalles.push(`✓ Promedio de sinónimos: ${promedioSinonimos.toFixed(1)} por item (meta >=5)`)
    } else if (promedioSinonimos >= 3) {
      puntos = 3
      detalles.push(`△ Promedio de sinónimos: ${promedioSinonimos.toFixed(1)} (meta >=5)`)
    } else {
      puntos = 1
      hallazgos.push({
        dimension: 'D7',
        severidad: 'ALTO',
        descripcion: `Promedio de sinónimos bajo: ${promedioSinonimos.toFixed(1)}`,
      })
    }

    detalles.push(`✓ Total sinónimos: ${totalSinonimos}`)

    resultados.push({ dimension: 'D7. Sinónimos (Matching Fuzzy)', porcentaje: puntos, maximo: max, hallazgos, detalles })
  }

  // =================================================
  // D8. INTEGRACIÓN CON LLM (5 pts)
  // =================================================
  {
    const hallazgos: Hallazgo[] = []
    const detalles: string[] = []
    let puntos = 0
    const max = 5

    const llmPath = path.join(__dirname, '..', 'src', 'lib', 'llm-bot.ts')
    if (fs.existsSync(llmPath)) {
      puntos += 2
      const content = fs.readFileSync(llmPath, 'utf8')
      detalles.push('✓ Archivo llm-bot.ts existe')

      if (content.includes('z-ai-web-dev-sdk')) {
        puntos += 2
        detalles.push('✓ Integración con z-ai-web-dev-sdk (GLM)')
      } else {
        hallazgos.push({ dimension: 'D8', severidad: 'ALTO', descripcion: 'Sin integración con z-ai-web-dev-sdk' })
      }

      if (content.includes('generarRespuestaLLM') && content.includes('verificarLLM')) {
        puntos += 1
        detalles.push('✓ Funciones generarRespuestaLLM y verificarLLM')
      } else {
        hallazgos.push({ dimension: 'D8', severidad: 'MEDIO', descripcion: 'Faltan funciones LLM' })
      }
    } else {
      hallazgos.push({ dimension: 'D8', severidad: 'CRITICO', descripcion: 'No existe llm-bot.ts' })
    }

    resultados.push({ dimension: 'D8. Integración LLM', porcentaje: puntos, maximo: max, hallazgos, detalles })
  }

  // =================================================
  // D9. SISTEMA DE ESCALAMIENTO A HUMANO (5 pts)
  // =================================================
  {
    const hallazgos: Hallazgo[] = []
    const detalles: string[] = []
    let puntos = 0
    const max = 5

    const conversacionalPath = path.join(__dirname, '..', 'src', 'lib', 'bot-conversacional.ts')
    if (fs.existsSync(conversacionalPath)) {
      const content = fs.readFileSync(conversacionalPath, 'utf8')
      if (content.includes('componerEscalado') && content.includes('ESCALADOS_NATURALES')) {
        puntos += 3
        detalles.push('✓ Función componerEscalado con plantillas naturales')
      } else {
        hallazgos.push({ dimension: 'D9', severidad: 'ALTO', descripcion: 'Sin sistema de escalamiento' })
      }

      if (content.includes('componerFallback') && content.includes('FALLBACKS_NATURALES')) {
        puntos += 2
        detalles.push('✓ Función componerFallback con plantillas naturales')
      } else {
        hallazgos.push({ dimension: 'D9', severidad: 'MEDIO', descripcion: 'Sin fallback natural' })
      }
    }

    // LLM también debe tener reglas de escalamiento
    const llmPath = path.join(__dirname, '..', 'src', 'lib', 'llm-bot.ts')
    if (fs.existsSync(llmPath)) {
      const content = fs.readFileSync(llmPath, 'utf8')
      if (content.includes('REGLAS DE ESCALAMIENTO') && content.includes('ESCALAR:')) {
        detalles.push('✓ LLM tiene reglas de escalamiento')
      } else {
        hallazgos.push({ dimension: 'D9', severidad: 'BAJO', descripcion: 'LLM sin reglas explícitas de escalamiento' })
      }
    }

    resultados.push({ dimension: 'D9. Escalamiento a Humano', porcentaje: puntos, maximo: max, hallazgos, detalles })
  }

  // =================================================
  // D10. DETECCIÓN DE TONO Y FOLLOW-UPS (5 pts)
  // =================================================
  {
    const hallazgos: Hallazgo[] = []
    const detalles: string[] = []
    let puntos = 0
    const max = 5

    const conversacionalPath = path.join(__dirname, '..', 'src', 'lib', 'bot-conversacional.ts')
    if (fs.existsSync(conversacionalPath)) {
      const content = fs.readFileSync(conversacionalPath, 'utf8')

      const tonosEsperados = ['URGENTE', 'FRUSTRADO', 'CASUAL', 'FORMAL', 'NEUTRO']
      const tonosEncontrados = tonosEsperados.filter(t => content.includes(`'${t}'`))
      if (tonosEncontrados.length === tonosEsperados.length) {
        puntos += 2
        detalles.push(`✓ Detección de los 5 tonos: ${tonosEncontrados.join(', ')}`)
      } else {
        hallazgos.push({
          dimension: 'D10',
          severidad: 'MEDIO',
          descripcion: `Faltan tonos: ${tonosEsperados.filter(t => !tonosEncontrados.includes(t)).join(', ')}`,
        })
      }

      // Resolución de referencias anafóricas
      if (content.includes('resolverReferencia') && content.includes('SesionConversacion')) {
        puntos += 2
        detalles.push('✓ Resolución de referencias anafóricas ("eso", "el otro", "¿y los pagos?")')
      } else {
        hallazgos.push({ dimension: 'D10', severidad: 'MEDIO', descripcion: 'Sin resolución de referencias anafóricas' })
      }

      // Memoria de sesión (en memoria)
      if (content.includes('SESIONES') && content.includes('MAX_MENSAJES_SESION')) {
        puntos += 1
        detalles.push('✓ Sesiones en memoria con límite de mensajes')
      } else {
        hallazgos.push({ dimension: 'D10', severidad: 'BAJO', descripcion: 'Sin gestión de sesiones' })
      }
    }

    resultados.push({ dimension: 'D10. Detección de Tono y Follow-ups', porcentaje: puntos, maximo: max, hallazgos, detalles })
  }

  // =================================================
  // D11. CUMPLIMIENTO NORMATIVO COLOMBIANO (10 pts)
  // =================================================
  {
    const hallazgos: Hallazgo[] = []
    const detalles: string[] = []
    let puntos = 0
    const max = 10

    const dataset = DATASETS_POR_BOT['JURIDICO'] || []
    const todasLasPreguntas = dataset.map(d => (d.pregunta + ' ' + (d.sinonimos?.join(' ') || '') + ' ' + d.respuesta).toLowerCase())

    const normasEsperadas = [
      { nombre: 'Código Civil', patron: 'codigo civil' },
      { nombre: 'Código de Comercio', patron: 'codigo de comercio' },
      { nombre: 'Código Penal', patron: 'codigo penal' },
      { nombre: 'Código General del Proceso (CGP)', patron: 'código general del proceso' },
      { nombre: 'Ley 1266/2008 Habeas Data', patron: 'ley 1266' },
      { nombre: 'Ley 1480/2011 Estatuto del Consumidor', patron: 'ley 1480' },
      { nombre: 'Ley 1450/2011 Anti-Trámite/Usura', patron: 'ley 1450' },
      { nombre: 'Ley 1581/2012 Datos Personales', patron: 'ley 1581' },
      { nombre: 'Ley 1520/2012 Microcrédito', patron: 'ley 1520' },
      { nombre: 'Ley 1564/2012 CGP', patron: 'ley 1564' },
      { nombre: 'Ley 1116/2006 Reorganización', patron: 'ley 1116' },
      { nombre: 'Ley 1676/2013 Garantías Mobiliarias', patron: 'ley 1676' },
      { nombre: 'Decreto 663/1993 Estatuto Orgánico Financiero', patron: 'decreto 663' },
      { nombre: 'Ley 526/1999 UIAF', patron: 'ley 526' },
      { nombre: 'SARLAFT', patron: 'sarlaft' },
      { nombre: 'SAGRILAFT', patron: 'sagrilaft' },
      { nombre: 'Constitución 1991', patron: 'constitución' },
      { nombre: 'Ley 1778/2016 Responsabilidad Penal Empresarial', patron: 'ley 1778' },
    ]

    let normasCubiertas = 0
    const normasFaltantes: string[] = []
    for (const norma of normasEsperadas) {
      const encontrada = todasLasPreguntas.some(p => p.includes(norma.patron))
      if (encontrada) normasCubiertas++
      else normasFaltantes.push(norma.nombre)
    }

    puntos = Math.round((normasCubiertas / normasEsperadas.length) * max)
    detalles.push(`✓ Normas cubiertas: ${normasCubiertas}/${normasEsperadas.length}`)

    if (normasFaltantes.length > 0) {
      hallazgos.push({
        dimension: 'D11',
        severidad: normasFaltantes.length > 3 ? 'ALTO' : 'MEDIO',
        descripcion: `Normas no mencionadas: ${normasFaltantes.join(', ')}`,
      })
    }

    resultados.push({ dimension: 'D11. Cumplimiento Normativo Colombiano', porcentaje: puntos, maximo: max, hallazgos, detalles })
  }

  // =================================================
  // D12. ESTILO CONVERSACIONAL FLUIDO (5 pts)
  // =================================================
  {
    const hallazgos: Hallazgo[] = []
    const detalles: string[] = []
    let puntos = 0
    const max = 5

    const dataset = DATASETS_POR_BOT['JURIDICO'] || []
    const respuestas = dataset.map(d => d.respuesta).join('\n').toLowerCase()

    // Anti-patrón: menús numerados extensos
    const tieneMenus = /\b1\)\s+.+\n\s*2\)\s+.+\n\s*3\)\s+.+\n\s*4\)\s+.+/m.test(respuestas)
    if (!tieneMenus) {
      puntos += 2
      detalles.push('✓ No usa menús numerados extensos en respuestas')
    } else {
      hallazgos.push({ dimension: 'D12', severidad: 'MEDIO', descripcion: 'Algunas respuestas usan menús numerados' })
    }

    // Anti-patrón: "Escribe X para..."
    const tieneEscribeX = /escribe\s+\w+\s+para/m.test(respuestas)
    if (!tieneEscribeX) {
      puntos += 1
      detalles.push('✓ No usa patrón "escribe X para..."')
    } else {
      hallazgos.push({ dimension: 'D12', severidad: 'BAJO', descripcion: 'Usa patrón "escribe X para..."' })
    }

    // Pr patrón conversacional: preguntas de seguimiento
    const tienePreguntasSeguimiento = /cuéntame|me dices|si quieres|te parece|qué te parece|quieres que|mientras tanto/.test(respuestas)
    if (tienePreguntasSeguimiento) {
      puntos += 2
      detalles.push('✓ Usa frases conversacionales naturales (cuéntame, me dices, si quieres)')
    } else {
      hallazgos.push({ dimension: 'D12', severidad: 'MEDIO', descripcion: 'Pocas frases conversacionales naturales' })
    }

    resultados.push({ dimension: 'D12. Estilo Conversacional Fluido', porcentaje: puntos, maximo: max, hallazgos, detalles })
  }

  // =================================================
  // BONUS: COBERTURA 500+ PREGUNTAS CONVERSACIONALES (5 pts extra)
  // =================================================
  {
    const hallazgos: Hallazgo[] = []
    const detalles: string[] = []
    let puntos = 0
    const max = 5

    const dataset = DATASETS_POR_BOT['JURIDICO'] || []
    let exitosas = 0
    let fallidas = 0
    const detallesFalla: string[] = []

    for (const prueba of PREGUNTAS_CONVERSACIONALES_500) {
      const resultado = buscarMejorMatch(prueba.pregunta, dataset, 0.35)
      const exito = resultado.item !== null && resultado.score >= 0.35
      if (exito) exitosas++
      else {
        fallidas++
        if (detallesFalla.length < 10) {
          detallesFalla.push(`  ✗ [${prueba.area}] "${prueba.pregunta.substring(0, 60)}..." → score ${resultado.score.toFixed(2)}`)
        }
      }
    }

    const tasa = (exitosas / PREGUNTAS_CONVERSACIONALES_500.length) * 100
    puntos = Math.round((exitosas / PREGUNTAS_CONVERSACIONALES_500.length) * max)

    detalles.push(`✓ Preguntas conversacionales cubiertas: ${exitosas}/${PREGUNTAS_CONVERSACIONALES_500.length} (${tasa.toFixed(1)}%)`)

    if (fallidas > 0) {
      hallazgos.push({
        dimension: 'BONUS',
        severidad: fallidas > 20 ? 'ALTO' : 'MEDIO',
        descripcion: `${fallidas} preguntas conversacionales sin match`,
        detalle: detallesFalla.join('\n'),
      })
    }

    resultados.push({ dimension: 'BONUS. Cobertura 50 Preguntas Conversacionales', porcentaje: puntos, maximo: max, hallazgos, detalles })
  }

  // =====================================================
  // REPORTE FINAL
  // =====================================================
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  REPORTE DE AUDITORÍA POR DIMENSIÓN')
  console.log('═══════════════════════════════════════════════════════════════\n')

  let totalPuntos = 0
  let totalMax = 0
  let totalHallazgos = 0

  for (const r of resultados) {
    const pct = ((r.porcentaje / r.maximo) * 100).toFixed(0)
    const status = r.porcentaje === r.maximo ? '✓' : r.porcentaje >= r.maximo * 0.7 ? '△' : '✗'
    console.log(`${status} ${r.dimension.padEnd(50)} ${r.porcentaje}/${r.maximo} (${pct}%)`)
    for (const d of r.detalles) {
      console.log(`     ${d}`)
    }
    if (r.hallazgos.length > 0) {
      for (const h of r.hallazgos) {
        totalHallazgos++
        console.log(`     ⚠ [${h.severidad}] ${h.descripcion}`)
        if (h.detalle) {
          h.detalle.split('\n').forEach((line) => {
            console.log(`        ${line}`)
          })
        }
      }
    }
    console.log()
    totalPuntos += r.porcentaje
    totalMax += r.maximo
  }

  const pctTotal = (totalPuntos / totalMax) * 100

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  RESULTADO FINAL DE LA AUDITORÍA')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Puntaje total: ${totalPuntos}/${totalMax} (${pctTotal.toFixed(1)}%)`)
  console.log(`  Hallazgos detectados: ${totalHallazgos}`)
  console.log()

  if (pctTotal >= 95) {
    console.log('  ✅ AUDITORÍA APROBADA — Cumplimiento ÓPTIMO (>=95%)')
  } else if (pctTotal >= 80) {
    console.log('  ⚠  AUDITORÍA CON HALLAZGOS — Cumplimiento aceptable (80-94%)')
    console.log('     Se requiere reparación para alcanzar 100%')
  } else if (pctTotal >= 60) {
    console.log('  ⚠  AUDITORÍA CON HALLAZGOS CRÍTICOS — Cumplimiento bajo (60-79%)')
  } else {
    console.log('  ✗  AUDITORÍA REPROBADA — Cumplimiento insuficiente (<60%)')
  }

  console.log()
  console.log('═══════════════════════════════════════════════════════════════')

  // Listar todos los hallazgos agrupados por severidad
  const todosHallazgos = resultados.flatMap(r => r.hallazgos)
  const criticos = todosHallazgos.filter(h => h.severidad === 'CRITICO')
  const altos = todosHallazgos.filter(h => h.severidad === 'ALTO')
  const medios = todosHallazgos.filter(h => h.severidad === 'MEDIO')
  const bajos = todosHallazgos.filter(h => h.severidad === 'BAJO')

  console.log('\n  HALLAZGOS POR SEVERIDAD:')
  console.log(`   • CRÍTICOS: ${criticos.length}`)
  console.log(`   • ALTOS:    ${altos.length}`)
  console.log(`   • MEDIOS:   ${medios.length}`)
  console.log(`   • BAJOS:    ${bajos.length}`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  // Devolver para uso externo
  return { totalPuntos, totalMax, pctTotal, totalHallazgos, hallazgos: todosHallazgos, resultados }
}

// Ejecutar
const resultado = auditar()
process.exit(resultado.pctTotal >= 95 ? 0 : 1)
