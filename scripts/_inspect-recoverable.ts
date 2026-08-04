// Inspecciona EnvioCorreo, AccesoPortal y Prestamo para ver qué se puede recuperar
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== ENVIOS DE CORREO (existen: 20) ===')
  const envios = await prisma.envioCorreo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  for (const e of envios) {
    console.log(`\n--- EnvioCorreo ${e.id.slice(-8)} ---`)
    console.log(`  Para: ${e.destinatario}`)
    console.log(`  Asunto: ${e.asunto}`)
    console.log(`  Estado: ${e.estado} | fecha: ${e.fechaEnvio?.toISOString?.()?.slice(0,19) || e.createdAt.toISOString().slice(0,19)}`)
    if (e.cuerpo) {
      console.log(`  Cuerpo (primeros 500 chars): ${e.cuerpo.slice(0, 500)}`)
    }
    if (e.mensajeError) console.log(`  Error: ${e.mensajeError}`)
  }
  
  console.log('\n\n=== ACCESOS PORTAL (8) ===')
  const accesos = await prisma.accesoPortal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  for (const a of accesos) {
    console.log(`  ${a.createdAt.toISOString().slice(0,19)} | ${a.clienteNombre || '?'} (${a.clienteCedula || '?'}) | modulo=${a.modulo} | accion=${a.accion} | ip=${a.ip}`)
  }
  
  console.log('\n\n=== PRÉSTAMOS CON TYC_ENVIADO ===')
  const prestamos = await prisma.prestamo.findMany({
    where: { tycEnviado: true },
    take: 30,
    orderBy: { createdAt: 'desc' },
  })
  console.log(`Total préstamos con tycEnviado=true: ${prestamos.length}`)
  for (const p of prestamos) {
    console.log(`  ${p.codigo} | estado=${p.estado} | tyAccepted=${p.tycAceptado} | fechaAcept=${p.tycFechaAceptacion?.toISOString?.().slice(0,19) || '-'} | metodoConf=${p.metodoConfirmacion}`)
  }
  
  console.log('\n\n=== TODOS LOS PRÉSTAMOS (resumen) ===')
  const allP = await prisma.prestamo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, codigo: true, estado: true, montoPrincipal: true,
      fechaSolicitud: true, fechaDesembolso: true,
      requiereDocumentos: true, generarPagare: true, generarCarta: true,
      tycEnviado: true, tycAceptado: true, metodoConfirmacion: true,
      cliente: { select: { nombre: true, cedula: true, email: true } },
      _count: { select: { pagos: true, documentos: true } },
    },
  })
  for (const p of allP) {
    console.log(`  ${p.codigo} | ${p.estado} | $${p.montoPrincipal} | ${p.cliente?.nombre} (${p.cliente?.cedula})`)
    console.log(`    reqDocs=${p.requiereDocumentos} | pagare=${p.generarPagare} | carta=${p.generarCarta} | tycEnviado=${p.tycEnviado} | tycAceptado=${p.tycAceptado} | metodo=${p.metodoConfirmacion}`)
    console.log(`    pagos=${p._count.pagos} | documentos=${p._count.documentos}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
