import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()
async function main() {
  const c = await db.cliente.findFirst({
    where: { cedula: '1214731649' },
    select: {
      id: true, cedula: true, nombre: true,
      claveHash: true, pinHash: true,
      activo: true, email: true, telefono: true,
      pinCreatedAt: true, pinIntentos: true, pinBloqueadoHasta: true,
      claveCreatedAt: true, claveIntentos: true, claveBloqueadoHasta: true,
      claveResetToken: true, claveResetExpira: true,
      claveTempToken: true, claveTempExpira: true,
      debeCambiarClave: true,
      tokenSesion: true, tokenExpira: true,
      ultimoAccesoPortal: true,
      updatedAt: true,
    }
  })
  console.log('=== CLIENTE 1214731649 ===')
  console.log(JSON.stringify(c, null, 2))

  if (c?.claveHash) {
    const match = await bcrypt.compare('Js951029*', c.claveHash)
    console.log('\n¿claveHash coincide con "Js951029*"?', match)
  }
  if (c?.pinHash) {
    const match = await bcrypt.compare('Js951029*', c.pinHash)
    console.log('¿pinHash coincide con "Js951029*"?', match)
  }

  const all = await db.cliente.findMany({
    select: {
      id: true, cedula: true, nombre: true,
      claveHash: true, pinHash: true,
      activo: true, debeCambiarClave: true,
      email: true, telefono: true,
      claveBloqueadoHasta: true, pinBloqueadoHasta: true,
    }
  })
  console.log('\n=== TODOS LOS CLIENTES ===')
  console.log('Total:', all.length)
  for (const cl of all) {
    console.log(`- ${cl.cedula} ${cl.nombre} (id=${cl.id})`)
    console.log(`  activo=${cl.activo} debeCambiarClave=${cl.debeCambiarClave}`)
    console.log(`  tieneClaveHash=${!!cl.claveHash} tienePinHash=${!!cl.pinHash}`)
    console.log(`  claveBloqueadoHasta=${cl.claveBloqueadoHasta} pinBloqueadoHasta=${cl.pinBloqueadoHasta}`)
    console.log(`  email=${cl.email} telefono=${cl.telefono}`)
  }

  const admins = await db.admin.findMany({
    select: {
      id: true, usuario: true, nombre: true, claveHash: true,
      rol: true, activo: true, primerLogin: true, email: true,
      intentosLogin: true, bloqueado: true,
    }
  })
  console.log('\n=== ADMINS ===')
  for (const a of admins) {
    console.log(`- ${a.usuario} (${a.nombre})`)
    console.log(`  rol=${a.rol} activo=${a.activo} bloqueado=${a.bloqueado} primerLogin=${a.primerLogin} intentosLogin=${a.intentosLogin}`)
    if (a.claveHash) {
      const match = await bcrypt.compare('Js951029*', a.claveHash)
      console.log(`  ¿claveHash coincide con "Js951029*"? ${match}`)
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
