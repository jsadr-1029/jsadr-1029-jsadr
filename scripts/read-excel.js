// Script para leer y mostrar el contenido del Excel CONTACTOS.xlsx
require('dotenv').config({ path: '.env', override: true })
const XLSX = require('xlsx')
const path = require('path')

const filePath = '/home/z/my-project/upload/CONTACTOS.xlsx'
const wb = XLSX.readFile(filePath)

console.log('=== Hojas en el Excel ===')
console.log(wb.SheetNames)

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
  console.log(`\n=== Hoja: ${sheetName} ===`)
  console.log(`Total filas: ${data.length}`)
  console.log('\n--- Primeras 5 filas (raw) ---')
  data.slice(0, 5).forEach((row, i) => {
    console.log(`Fila ${i}:`, JSON.stringify(row))
  })
  console.log('\n--- Últimas 3 filas ---')
  data.slice(-3).forEach((row, i) => {
    console.log(`Fila ${data.length - 3 + i}:`, JSON.stringify(row))
  })

  // Si hay filas, mostrar como objetos usando la primera fila como header
  if (data.length > 1) {
    const headers = data[0]
    console.log('\n--- Headers (fila 1) ---')
    headers.forEach((h, i) => console.log(`  Col ${i}: "${h}"`))

    const objects = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' })
    console.log(`\n--- Primeros 3 registros como objetos ---`)
    objects.slice(0, 3).forEach((obj, i) => {
      console.log(`Registro ${i}:`, JSON.stringify(obj, null, 2))
    })
    console.log(`\n--- Últimos 3 registros ---`)
    objects.slice(-3).forEach((obj, i) => {
      console.log(`Registro ${objects.length - 3 + i}:`, JSON.stringify(obj, null, 2))
    })
  }
}
