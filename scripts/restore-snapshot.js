#!/usr/bin/env node
// =====================================================
// restore-snapshot.js — Restaurar proyecto desde snapshot JSON
// =====================================================
// Extrae todos los archivos del snapshot al directorio
// del proyecto, sobreescribiendo el estado actual.
// =====================================================

const fs = require('fs')
const path = require('path')

const SNAPSHOT_PATH = '/home/z/my-project/upload/snapshot_460e3f9a-8fbf-411c-913d-74ca4f310424.json'
const PROJECT_ROOT = '/home/z/my-project'

console.log('=== Restaurando proyecto desde snapshot ===')
console.log('Snapshot:', SNAPSHOT_PATH)
console.log('Destino: ', PROJECT_ROOT)
console.log()

const data = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
console.log(`Versión snapshot : ${data.version}`)
console.log(`Nombre           : ${data.nombre}`)
console.log(`Timestamp        : ${data.timestamp}`)
console.log(`Archivos a restaurar: ${data.files.length}`)
console.log()

let ok = 0
let fail = 0
const errores = []

for (const f of data.files) {
  try {
    const dest = path.join(PROJECT_ROOT, f.path)
    // Crear directorios padre si no existen
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    // Escribir contenido (decodificar de base64 si está en b64, usar content directo si es string)
    let contenido
    if (typeof f.content === 'string') {
      // Verificar si es base64 o texto plano
      // Heurística: si parece base64 (solo chars A-Za-z0-9+/= y largo > 100)
      if (f.content.length > 100 && /^[A-Za-z0-9+/=\n\r]+$/.test(f.content) && f.content.length % 4 === 0) {
        try {
          contenido = Buffer.from(f.content, 'base64')
        } catch {
          contenido = Buffer.from(f.content, 'utf8')
        }
      } else {
        contenido = Buffer.from(f.content, 'utf8')
      }
    } else {
      contenido = Buffer.from('')
    }
    fs.writeFileSync(dest, contenido)
    ok++
  } catch (e) {
    fail++
    errores.push(`${f.path}: ${e.message}`)
  }
}

console.log(`✓ Restaurados: ${ok}`)
console.log(`✗ Fallidos  : ${fail}`)
if (errores.length > 0) {
  console.log('\nPrimeros 5 errores:')
  errores.slice(0, 5).forEach((e) => console.log('  -', e))
}

console.log('\n=== Restauración completada ===')
