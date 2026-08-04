// Inspección exhaustiva de TODAS las tablas
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function safe(name: string, fn: () => Promise<number>) {
  try {
    const c = await fn()
    console.log(`  ${name.padEnd(40)} ${c}`)
  } catch (e: any) {
    console.log(`  ${name.padEnd(40)} ERROR: ${e.message.slice(0, 80)}`)
  }
}

async function main() {
  console.log('=== CONTEO DE TODAS LAS TABLAS ===')
  await safe('Usuario',                   () => prisma.usuario.count())
  await safe('Cliente',                   () => prisma.cliente.count())
  await safe('Prestamo',                  () => prisma.prestamo.count())
  await safe('Pago',                      () => prisma.pago.count())
  await safe('DocumentoGestor',           () => prisma.documentoGestor.count())
  await safe('SolicitudWeb',              () => prisma.solicitudWeb.count())
  await safe('SolicitudNuevoCliente',     () => prisma.solicitudNuevoCliente.count())
  await safe('ConversacionChat',          () => prisma.conversacionChat.count())
  await safe('MensajeChat',               () => prisma.mensajeChat.count())
  await safe('CasoJuridico',              () => prisma.casoJuridico.count())
  await safe('Notificacion',              () => prisma.notificacion.count())
  await safe('NotificacionLog',           () => prisma.notificacionLog.count())
  await safe('Caja',                      () => prisma.caja.count())
  await safe('MovimientoCaja',            () => prisma.movimientoCaja.count())
  await safe('AuditLog',                  () => prisma.auditLog.count())
  await safe('BitacoraPrestamo',          () => prisma.bitacoraPrestamo.count())
  await safe('CodigoConfirmacion',        () => prisma.codigoConfirmacion.count())
  await safe('OtpCliente',                () => prisma.otpCliente.count())
  await safe('EnvioCorreo',               () => prisma.envioCorreo.count())
  await safe('ConexionAPI',               () => prisma.conexionAPI.count())
  await safe('CorreoInstitucional',       () => prisma.correoInstitucional.count())
  await safe('Integracion',               () => prisma.integracion.count())
  await safe('VariableGlobal',            () => prisma.variableGlobal.count())
  await safe('SnapshotProyecto',          () => prisma.snapshotProyecto.count())
  await safe('VersionConfiguracion',      () => prisma.versionConfiguracion.count())
  await safe('AuditoriaConfiguracion',    () => prisma.auditoriaConfiguracion.count())
  await safe('VersionSistema',            () => prisma.versionSistema.count())
  await safe('PrestamoBancario',          () => prisma.prestamoBancario.count())
  await safe('Categoria',                 () => prisma.categoria.count())
  await safe('Cuenta',                    () => prisma.cuenta.count())
  await safe('Campana',                   () => prisma.campana.count())
  await safe('AccesoPortal',              () => prisma.accesoPortal.count())
  await safe('FirmaElectronica',          () => prisma.firmaElectronica.count())
  await safe('TokenFirma',                () => prisma.tokenFirma.count())
  
  // === Préstamos activos (para verificar) ===
  console.log('\n=== PRÉSTAMOS ACTIVOS (deberían tener documentos/chats asociados) ===')
  const prestamos = await prisma.prestamo.findMany({
    select: { id: true, codigo: true, estado: true, monto: true, cliente: { select: { nombre: true, cedula: true } } },
    take: 20,
    orderBy: { createdAt: 'desc' },
  })
  for (const p of prestamos) {
    console.log(`  ${p.codigo} | ${p.estado} | ${p.monto} | ${p.cliente?.nombre} (${p.cliente?.cedula})`)
  }
  
  // === Verificar clientes con sus relaciones ===
  console.log('\n=== CLIENTES Y SUS RELACIONES ===')
  const clientes = await prisma.cliente.findMany({
    select: {
      id: true, nombre: true, cedula: true,
      _count: { select: {
        prestamos: true,
        documentos: true,
        solicitudesWeb: true,
        conversacionesChat: true,
      } },
    },
    take: 15,
  })
  for (const c of clientes) {
    console.log(`  ${c.nombre} (${c.cedula}) | préstamos=${c._count.prestamos} | docs=${c._count.documentos} | sol.web=${c._count.solicitudesWeb} | chats=${c._count.conversacionesChat}`)
  }
  
  // === Verificar AuditLog en busca de DELETE ===
  console.log('\n=== AUDIT LOG — Búsqueda exhaustiva de DELETE/ELIMINAR ===')
  const allAudit = await prisma.auditLog.findMany({
    where: { OR: [
      { accion: { contains: 'DELETE' } },
      { accion: { contains: 'ELIMIN' } },
      { accion: { contains: 'LIMPIAR' } },
      { accion: { contains: 'VACIAR' } },
      { accion: { contains: 'BORRAR' } },
      { accion: { contains: 'RESTAURAR' } },
      { modulo: { contains: 'documentosGestor' } },
      { modulo: { contains: 'solicitudWeb' } },
      { modulo: { contains: 'conversacionChat' } },
      { modulo: { contains: 'mensajeChat' } },
    ] },
    orderBy: { fecha: 'desc' },
    take: 50,
  })
  console.log(`Eventos de eliminación/restauración encontrados: ${allAudit.length}`)
  for (const a of allAudit) {
    console.log(`  ${a.fecha?.toISOString().slice(0,19)} | ${a.accion} | ${a.modulo} ${a.entidadId || ''} ${a.entidadNombre || ''} | by ${a.usuarioNombre || '?'} | exito=${a.exito}`)
  }
  
  // === Búsqueda amplia: cualquier evento de las últimas 72h ===
  console.log('\n=== AUDIT LOG — Todos los eventos de las últimas 72h ===')
  const recent = await prisma.auditLog.findMany({
    where: { fecha: { gte: new Date(Date.now() - 72 * 60 * 60 * 1000) } },
    orderBy: { fecha: 'desc' },
    take: 60,
  })
  console.log(`Total eventos en últimas 72h: ${recent.length}`)
  for (const a of recent) {
    const isDel = /DELETE|ELIMIN|LIMPIAR|VACIAR|BORRAR|RESTAUR/i.test(a.accion)
    console.log(`  ${isDel ? '🗑️' : '•'} ${a.fecha?.toISOString().slice(0,19)} | ${a.accion.padEnd(20)} | ${a.modulo.padEnd(20)} ${a.entidadId || ''} ${a.entidadNombre || ''} | by ${a.usuarioNombre || '?'}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
