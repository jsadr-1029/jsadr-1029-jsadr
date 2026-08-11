// Script para importar clientes desde el Excel CONTACTOS.xlsx a la BD Neon.
//
// Reglas (indicadas por el usuario):
//   - Todos los clientes con tasa personalizada del 20% mensual
//   - Todos SIN referido (referidoPorId = null) — el usuario lo asignará manualmente
//   - Todos los acomoda en la cuenta (sin cuenta de recaudo específica — se asignará luego)
//
// El script:
//   1. Lee el Excel (Hoja1)
//   2. Para cada fila (saltando la fila 1 que es header duplicado):
//      - Genera una clave temporal aleatoria (10 chars)
//      - Hashea con bcrypt (12 rounds, igual que src/lib/security.ts)
//      - Genera claveTempToken (32 bytes hex) y claveTempExpira (24h)
//      - Marca debeCambiarClave=true
//      - Asigna tieneTasaPersonalizada=true, tasaPersonalizada=20.0
//      - referidoPorId=null, categoriaId=null, cuentaRecaudoId=null
//      - Si ya existe un cliente con esa cédula, lo salta (no duplica)
//   3. Imprime un resumen al final con:
//      - Cuántos clientes se crearon
//      - Cuántos se saltaron por cédula duplicada
//      - Cuántos se saltaron por email duplicado
//      - Lista de claves temporales generadas (para que el gestor las comunique)
//
// Uso: node scripts/import-clientes-excel.js

require('dotenv').config({ path: '.env', override: true })

const XLSX = require('xlsx')
const path = require('path')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const EXCEL_PATH = '/home/z/my-project/upload/CONTACTOS.xlsx'
const TASA_MENSUAL = 20.0 // 20% mensual

// === Generador de claves temporales (igual que src/app/api/clientes/route.ts) ===
function generarClaveTemporal(longitud = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%&*'
  const bytes = crypto.randomBytes(longitud)
  let clave = ''
  for (let i = 0; i < longitud; i++) {
    clave += chars[bytes[i] % chars.length]
  }
  return clave
}

// === Limpieza de valores ===
function limpiar(valor) {
  if (valor == null) return ''
  return String(valor).trim()
}

// Convierte "$ 2,000,000" → 2000000.0
function parseIngresos(valor) {
  if (!valor) return null
  const limpio = String(valor).replace(/[$,\s]/g, '').replace(/[^\d.]/g, '')
  const num = parseFloat(limpio)
  return isNaN(num) ? null : num
}

// Valida y normaliza email. Si viene con asteriscos (dato privado), retorna null.
function parseEmail(valor) {
  const s = limpiar(valor)
  if (!s) return null
  // Si contiene asteriscos (dato oculto en el Excel), no usar
  if (/[*]/.test(s)) return null
  // Validación básica de formato
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null
  return s.toLowerCase()
}

// Valida cédula. Si viene con asteriscos, retorna null.
function parseCedula(valor) {
  const s = limpiar(valor)
  if (!s) return null
  if (/[*]/.test(s)) return null
  // Solo dígitos, entre 5 y 15
  if (!/^\d{5,15}$/.test(s)) return null
  return s
}

// Normaliza teléfono (solo dígitos, prefijo +57 si no lo tiene)
function parseTelefono(valor) {
  const s = limpiar(valor)
  if (!s) return null
  const digitos = s.replace(/\D/g, '')
  if (digitos.length < 7) return null
  return digitos
}

async function main() {
  console.log('=== Importación de clientes desde Excel ===\n')
  console.log(`Archivo: ${EXCEL_PATH}`)
  console.log(`Tasa mensual: ${TASA_MENSUAL}%`)
  console.log(`Referido: SIN REFERIDO (null) — el usuario lo asignará manualmente\n`)

  // 1. Leer Excel
  const wb = XLSX.readFile(EXCEL_PATH)
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const filas = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' })
  console.log(`Total filas en el Excel: ${filas.length}\n`)

  // 2. Filtrar filas válidas
  // La primera fila es header duplicado (NOMBRE_COMPLETO, CEDULA, etc.) — la saltamos
  const clientesData = []
  let saltadasHeader = 0
  let saltadasInvalidas = 0

  for (const fila of filas) {
    const nombre = limpiar(fila['NOMBRE_COMPLETO'])
    // Saltar fila de header duplicada
    if (nombre === 'NOMBRE_COMPLETO' || !nombre) {
      saltadasHeader++
      continue
    }

    const cedula = parseCedula(fila['CEDULA'])
    const telefono = parseTelefono(fila['CELULAR'])
    const email = parseEmail(fila['CORREO'])
    const direccion = limpiar(fila['DIRECCION'])
    const barrio = limpiar(fila['BARRIO'])
    const ciudad = limpiar(fila['CIUDAD'])
    const ocupacion = limpiar(fila['OCUPACION'])
    const ingresos = parseIngresos(fila['INGRESOS'])
    const bancoCliente = limpiar(fila['BANCO_CLIENTE'])
    const tipoCuentaCliente = limpiar(fila['TIPO_CUENTA'])
    const numeroCuentaCliente = limpiar(fila['N°_CUENTA'])

    // Saltar filas sin cédula válida o sin teléfono (datos mínimos)
    if (!cedula || !telefono) {
      saltadasInvalidas++
      console.log(`  ⚠️  SALTADA: ${nombre || '(sin nombre)'} — cédula o teléfono inválido`)
      continue
    }

    clientesData.push({
      nombre,
      cedula,
      telefono,
      email: email || null,
      direccion: direccion && !/[*]/.test(direccion) ? direccion : null,
      barrio: barrio && !/[*]/.test(barrio) ? barrio : null,
      ciudad: ciudad && !/[*]/.test(ciudad) ? ciudad : null,
      ocupacion: ocupacion || 'Empleado',
      salario: ingresos,
      bancoCliente: bancoCliente && !/[*]/.test(bancoCliente) ? bancoCliente : null,
      tipoCuentaCliente: tipoCuentaCliente && !/[*]/.test(tipoCuentaCliente) ? tipoCuentaCliente : null,
      numeroCuentaCliente: numeroCuentaCliente && !/[*]/.test(numeroCuentaCliente) ? numeroCuentaCliente : null,
    })
  }

  console.log(`\nResumen de filtrado:`)
  console.log(`  Filas válidas para importar: ${clientesData.length}`)
  console.log(`  Headers duplicados saltados: ${saltadasHeader}`)
  console.log(`  Filas inválidas saltadas: ${saltadasInvalidas}\n`)

  if (clientesData.length === 0) {
    console.log('No hay clientes para importar. Termina el script.')
    return
  }

  // 3. Importar clientes
  console.log('=== Iniciando importación ===\n')
  const creados = []
  let duplicadosCedula = 0
  let duplicadosEmail = 0
  let errores = 0

  for (const [i, c] of clientesData.entries()) {
    try {
      // Verificar cédula duplicada
      const existente = await prisma.cliente.findUnique({ where: { cedula: c.cedula } })
      if (existente) {
        duplicadosCedula++
        console.log(`  ⏭️  [${i + 1}/${clientesData.length}] DUPLICADO cédula: ${c.nombre} (${c.cedula})`)
        continue
      }

      // Verificar email duplicado (si el cliente trae email)
      if (c.email) {
        const emailExistente = await prisma.cliente.findFirst({
          where: { email: { equals: c.email, mode: 'insensitive' } },
          select: { id: true, nombre: true, cedula: true },
        })
        if (emailExistente) {
          duplicadosEmail++
          console.log(
            `  ⏭️  [${i + 1}/${clientesData.length}] DUPLICADO email: ${c.nombre} (${c.email} ya está en ${emailExistente.nombre})`,
          )
          // No abortar — crear el cliente SIN email
          c.email = null
        }
      }

      // Generar clave temporal
      const claveTemporalPlana = generarClaveTemporal(10)
      const claveHash = await bcrypt.hash(claveTemporalPlana, 12)
      const ahora = new Date()
      const claveTempToken = crypto.randomBytes(32).toString('hex')
      const claveTempExpira = new Date(ahora.getTime() + 24 * 60 * 60 * 1000) // 24h

      const cliente = await prisma.cliente.create({
        data: {
          nombre: c.nombre,
          cedula: c.cedula,
          telefono: c.telefono,
          email: c.email,
          direccion: c.direccion,
          ciudad: c.ciudad,
          barrio: c.barrio,
          salario: c.salario,
          // notas: guardar ocupación en notas hasta que se modele como campo aparte
          notas: c.ocupacion ? `Ocupación: ${c.ocupacion}` : null,
          bancoCliente: c.bancoCliente,
          tipoCuentaCliente: c.tipoCuentaCliente,
          numeroCuentaCliente: c.numeroCuentaCliente,
          // Sin referido — el usuario lo asignará manualmente
          referidoPorId: null,
          categoriaId: null,
          cuentaRecaudoId: null,
          // Tasa personalizada del 20% mensual
          tieneTasaPersonalizada: true,
          tasaPersonalizada: TASA_MENSUAL,
          // Preferencia de notificación por defecto
          preferenciaNotificacion: c.email ? 'AMBOS' : 'WHATSAPP',
          // Clave temporal para primer ingreso
          claveHash,
          claveCreatedAt: ahora,
          claveIntentos: 0,
          claveBloqueadoHasta: null,
          debeCambiarClave: true,
          claveTempToken,
          claveTempExpira,
        },
      })

      creados.push({
        nombre: cliente.nombre,
        cedula: cliente.cedula,
        telefono: cliente.telefono,
        email: cliente.email,
        tasaPersonalizada: TASA_MENSUAL,
        claveTemporal: claveTemporalPlana,
        claveTempExpira: claveTempExpira.toISOString(),
        clienteId: cliente.id,
      })

      console.log(
        `  ✅ [${i + 1}/${clientesData.length}] CREADO: ${cliente.nombre} (cédula ${cliente.cedula}, ${c.email || 'sin email'}) — clave: ${claveTemporalPlana}`,
      )
    } catch (err) {
      errores++
      console.error(`  ❌ [${i + 1}/${clientesData.length}] ERROR con ${c.nombre} (${c.cedula}):`, err.message)
    }
  }

  // 4. Resumen final
  console.log('\n=== RESUMEN FINAL ===')
  console.log(`Total filas en Excel: ${filas.length}`)
  console.log(`Clientes válidos: ${clientesData.length}`)
  console.log(`  ✅ Creados: ${creados.length}`)
  console.log(`  ⏭️  Duplicados por cédula: ${duplicadosCedula}`)
  console.log(`  ⏭️  Duplicados por email (creados sin email): ${duplicadosEmail}`)
  console.log(`  ❌ Errores: ${errores}`)

  if (creados.length > 0) {
    console.log('\n=== CLIENTES CREADOS CON CLAVES TEMPORALES ===')
    console.log('(El gestor debe comunicar estas claves a cada cliente por canal seguro)')
    console.log('')
    creados.forEach((c, i) => {
      console.log(`${i + 1}. ${c.nombre}`)
      console.log(`   Cédula: ${c.cedula}`)
      console.log(`   Teléfono: ${c.telefono}`)
      console.log(`   Email: ${c.email || '(sin email)'}`)
      console.log(`   Tasa personalizada: ${c.tasaPersonalizada}% mensual`)
      console.log(`   Clave temporal (24h): ${c.claveTemporal}`)
      console.log(`   Cliente ID: ${c.clienteId}`)
      console.log('')
    })

    // Guardar las claves temporales en un archivo para que el gestor las tenga
    const fs = require('fs')
    const outputPath = '/home/z/my-project/download/clientes-importados-claves.json'
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, JSON.stringify(creados, null, 2), 'utf-8')
    console.log(`\n📄 Lista completa de claves temporales guardada en: ${outputPath}`)
  }
}

main()
  .catch((err) => {
    console.error('Error fatal:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
