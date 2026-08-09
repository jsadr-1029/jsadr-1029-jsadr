// Test local de buscarConocimientoPlataforma — escribe un JS puro temporal
const ts = require('typescript')
const fs = require('fs')

const src = fs.readFileSync('/home/z/my-project/src/lib/bot-conocimiento-plataforma.ts', 'utf8')
const result = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
})

// Reemplazar el import por un stub
let code = result.outputText
code = code.replace(/const bot_fuzzy_matcher_1 = require\([^)]+\);/g, 'const bot_fuzzy_matcher_1 = {};')

// Agregar exports al final
code += '\nmodule.exports = { buscarConocimientoPlataforma, DATASET: exports.DATASET_CONOCIMIENTO_PLATAFORMA };\n'

fs.writeFileSync('/tmp/_bot-conocimiento-test.js', code)
const mod = require('/tmp/_bot-conocimiento-test.js')
const buscarConocimientoPlataforma = mod.buscarConocimientoPlataforma
const DATASET_CONOCIMIENTO_PLATAFORMA = mod.DATASET

console.log(`Dataset cargado: ${DATASET_CONOCIMIENTO_PLATAFORMA.length} items\n`)

const tests = [
  'que cajas tiene el sistema',
  'que seguridad tiene la plataforma',
  'como entro al portal juridico',
  'que es el portal admin companion',
  'por que preguntas negocio o personal',
  'como entro al portal admin',
  'que modulos tiene la plataforma',
  'cuanto cuesta usar la plataforma',
  'que roles hay en el sistema',
  'como se crea un prestamo',
  'que es el audit log',
]

console.log('=== Test buscarConocimientoPlataforma ===\n')
for (const t of tests) {
  console.log(`>>> "${t}"`)
  const r = buscarConocimientoPlataforma(t)
  if (r) {
    console.log('  MATCH:', r.substring(0, 100).replace(/\n/g, ' ') + '...')
  } else {
    console.log('  NO MATCH ❌')
  }
  console.log('')
}
