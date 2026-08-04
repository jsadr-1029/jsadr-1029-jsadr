// Cuenta préstamos pendientes y muestra muestra de clientes con email
const fs = require('fs')
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    let v = m[2]
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}

const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
;(async () => {
  try {
    const count = await p.prestamo.count({ where: { estado: 'PENDIENTE_ACEPTACION' } })
    console.log('Préstamos PENDIENTE_ACEPTACION:', count)
    const muestra = await p.prestamo.findMany({
      where: { estado: 'PENDIENTE_ACEPTACION' },
      include: { cliente: { select: { nombre: true, email: true, cedula: true, telefono: true } } },
      take: 5,
      orderBy: { fechaSolicitud: 'asc' },
    })
    console.log('\nMuestra (primeros 5):')
    muestra.forEach(pr => console.log(` - ${pr.codigo} | ${pr.cliente?.nombre} | ${pr.cliente?.email || '(sin email)'} | ${pr.cliente?.cedula}`))
    const conEmail = await p.prestamo.count({
      where: { estado: 'PENDIENTE_ACEPTACION', cliente: { email: { not: null } } },
    })
    const sinEmail = count - conEmail
    console.log(`\nCon email: ${conEmail} | Sin email: ${sinEmail}`)
  } catch (e) {
    console.error('ERROR:', e.message)
  } finally {
    await p.$disconnect()
  }
})()
