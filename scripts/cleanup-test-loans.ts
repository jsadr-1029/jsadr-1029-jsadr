// Limpia préstamos de prueba creados por create-test-loan-and-send-otp.ts
import * as dotenv from 'dotenv'
dotenv.config()
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://neondb_owner:npg_QJe0IjHNfF8p@ep-small-lab-ax4gzg9p-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&schema=public'
}
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  // Eliminar firmas y OTPs asociados a préstamos de prueba
  const prestamosPrueba = await db.prestamo.findMany({
    where: { codigo: { startsWith: 'PREST-TEST-OTP-' } },
    select: { id: true, codigo: true, clienteId: true },
  })
  console.log(`Encontrados ${prestamosPrueba.length} préstamos de prueba`)
  for (const p of prestamosPrueba) {
    console.log(`Eliminando ${p.codigo}...`)
    await db.notificacionLog.deleteMany({ where: { prestamoId: p.id } }).catch(() => {})
    await db.firmaElectronica.deleteMany({ where: { prestamoId: p.id } }).catch(() => {})
    await db.otpRegistro.deleteMany({ where: { entidadRefId: p.id } }).catch(() => {})
    await db.prestamo.delete({ where: { id: p.id } })
  }
  console.log('✅ Limpieza completa')

  // Mostrar préstamos restantes con código PREST-TEST
  const restantes = await db.prestamo.findMany({
    where: { codigo: { startsWith: 'PREST-TEST' } },
    select: { id: true, codigo: true },
  })
  console.log(`Préstamos PREST-TEST restantes: ${restantes.length}`)
}

main().catch(console.error).finally(() => db.$disconnect())
