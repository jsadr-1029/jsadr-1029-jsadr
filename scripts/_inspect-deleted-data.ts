// Inspecciona el estado actual de la BD - versión corregida
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== ESTADO ACTUAL DE LA BD ===\n')

  const checks: Array<{ name: string; fn: () => Promise<{ count: number; last?: any[] }> }> = [
    { name: 'DocumentoGestor',       fn: () => prisma.documentoGestor.count().then(c => ({ count: c })).then(async r => ({ ...r, last: (await prisma.documentoGestor.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, createdAt: true, titulo: true } })) })) },
    { name: 'SolicitudWeb',          fn: () => prisma.solicitudWeb.count().then(c => ({ count: c })).then(async r => ({ ...r, last: (await prisma.solicitudWeb.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, createdAt: true, codigo: true, clienteNombre: true, estado: true } })) })) },
    { name: 'SolicitudNuevoCliente', fn: () => prisma.solicitudNuevoCliente.count().then(c => ({ count: c })).then(async r => ({ ...r, last: (await prisma.solicitudNuevoCliente.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, createdAt: true, codigo: true, nombre: true, apellido: true, estado: true } })) })) },
    { name: 'ConversacionChat',      fn: () => prisma.conversacionChat.count().then(c => ({ count: c })).then(async r => ({ ...r, last: (await prisma.conversacionChat.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, createdAt: true, codigo: true, asunto: true, estado: true } })) })) },
    { name: 'MensajeChat',           fn: () => prisma.mensajeChat.count().then(c => ({ count: c })).then(async r => ({ ...r, last: (await prisma.mensajeChat.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, createdAt: true } })) })) },
    { name: 'Cliente',               fn: () => prisma.cliente.count().then(c => ({ count: c })).then(async r => ({ ...r, last: (await prisma.cliente.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, createdAt: true, nombre: true, cedula: true } })) })) },
    { name: 'Prestamo',              fn: () => prisma.prestamo.count().then(c => ({ count: c })).then(async r => ({ ...r, last: (await prisma.prestamo.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, createdAt: true, codigo: true, monto: true, estado: true } })) })) },
  ]

  for (const c of checks) {
    try {
      const r = await c.fn()
      console.log(`${c.name.padEnd(28)} | count=${r.count}`)
      if (r.last && r.last.length) {
        for (const l of r.last) {
          console.log(`    └─ ${l.id.slice(-12)} | ${l.createdAt?.toISOString?.()?.slice(0,19) || '?'} | ${JSON.stringify(l).slice(0,150)}`)
        }
      }
    } catch (e: any) {
      console.log(`${c.name.padEnd(28)} | ERROR: ${e.message.slice(0, 120)}`)
    }
  }

  console.log('\n=== AUDIT LOG — Últimos 40 eventos (DELETE / ELIMINAR primero) ===')
  try {
    const audit = await prisma.auditLog.findMany({
      orderBy: { fecha: 'desc' },
      take: 40,
    })
    const dels = audit.filter(a => /DELETE|ELIMIN|LIMPIAR|VACIAR|BORRAR/i.test(a.accion || ''))
    const others = audit.filter(a => !/DELETE|ELIMIN|LIMPIAR|VACIAR|BORRAR/i.test(a.accion || ''))
    console.log(`Eventos DELETE/ELIMINAR/LIMPIAR: ${dels.length}`)
    for (const a of dels) {
      console.log(`  🗑️  ${a.fecha?.toISOString().slice(0,19)} | ${a.accion} | ${a.modulo} ${a.entidadId || ''} ${a.entidadNombre || ''} | by ${a.usuarioNombre || '?'} | ip=${a.ipOrigen || '?'} | exito=${a.exito}`)
    }
    console.log(`\nOtros eventos recientes: ${others.length}`)
    for (const a of others.slice(0,15)) {
      console.log(`  • ${a.fecha?.toISOString().slice(0,19)} | ${a.accion} | ${a.modulo} ${a.entidadId || ''} ${a.entidadNombre || ''} | by ${a.usuarioNombre || '?'}`)
    }
    console.log(`(total audit logs mostrados: ${audit.length})`)
  } catch (e: any) {
    console.log('No se pudo leer AuditLog:', e.message)
  }

  console.log('\n=== VERSIONES DE CONFIGURACIÓN (últimas 5) ===')
  try {
    const vers = await prisma.versionConfiguracion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    for (const v of vers) {
      console.log(`  ${v.createdAt?.toISOString().slice(0,19)} | v${v.numero} ${v.seccion} | ${v.descripcion?.slice(0,60)} | by ${v.usuarioNombre}`)
    }
  } catch (e: any) {
    console.log('No se pudo leer VersionConfiguracion:', e.message)
  }

  console.log('\n=== SNAPSHOTS DE PROYECTO ===')
  try {
    const snaps = await prisma.snapshotProyecto.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, nombre: true, tipo: true, tamanoBytes: true, createdAt: true, descripcion: true }
    })
    for (const s of snaps) {
      console.log(`  ${s.createdAt?.toISOString().slice(0,19)} | ${s.tipo} | ${(s.tamanoBytes/1024).toFixed(0)}KB | ${s.nombre} | ${(s.descripcion||'').slice(0,60)}`)
    }
  } catch (e: any) {
    console.log('No se pudo leer SnapshotProyecto:', e.message)
  }

  console.log('\n=== RESTAURACIONES DE BACKUP (Bitacora) ===')
  try {
    const bit = await prisma.bitacoraPrestamo.findMany({
      where: { tipo: 'OTRO' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    for (const b of bit) {
      const t = b.titulo + ' ' + b.descripcion
      if (/restaur|backup|recover|elimin|borrar|limpiar|vaciar/i.test(t)) {
        console.log(`  ${b.createdAt?.toISOString().slice(0,19)} | ${b.titulo} | ${(b.descripcion||'').slice(0,120)}`)
      }
    }
  } catch (e: any) {
    console.log('No se pudo leer BitacoraPrestamo:', e.message)
  }
}

main().catch(e => { console.error(e) }).finally(() => prisma.$disconnect())
