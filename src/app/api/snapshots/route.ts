// =====================================================
// /api/snapshots — Control de Versiones y Snapshots
// GET: listar snapshots
// POST: crear snapshot manual
// Seguridad: requireRole ADMIN + Zod + rate limit
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { rateLimit, getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import { crearSnapshot, generarUUID, sugerirVersion } from '@/lib/snapshot-manager'
import { z } from 'zod'

const crearSchema = z.object({
  nombre: z.string().min(3, 'Nombre muy corto').max(200),
  descripcion: z.string().max(2000).optional(),
  version: z.string().optional(),
  tipo: z.enum(['MANUAL', 'AUTO_PRE_CAMBIO', 'AUTO_PRE_REFACTOR']).default('MANUAL'),
  motivo: z.string().max(500).optional(),
})

// === GET — Listar snapshots (CONSULTOR+) ===
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const descargar = searchParams.get('descargar')

    // Descargar snapshot por UUID
    if (descargar) {
      const snapshot = await db.snapshotProyecto.findUnique({ where: { uuid: descargar } })
      if (!snapshot) {
        return NextResponse.json({ success: false, error: 'Snapshot no encontrado' }, { status: 404 })
      }
      const fs = require('fs')
      const path = require('path')
      const rutaFisica = path.join(process.cwd(), snapshot.rutaArchivo)
      if (!fs.existsSync(rutaFisica)) {
        return NextResponse.json({ success: false, error: 'Archivo no existe' }, { status: 404 })
      }
      const contenido = fs.readFileSync(rutaFisica)
      return new NextResponse(contenido, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="snapshot_${snapshot.uuid}.json"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const snapshots = await db.snapshotProyecto.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ success: true, data: snapshots })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// === POST — Crear snapshot (ADMIN) ===
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    // Rate limit (snapshot es costoso)
    const clientInfo = getClientInfo(req)
    const rl = rateLimit(`snapshots:${clientInfo.ip}`, 5) // 5 por minuto
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Los snapshots son costosos. Espera 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const validacion = crearSchema.safeParse(body)
    if (!validacion.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', fieldErrors: validacion.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = validacion.data

    // Generar UUID y versión
    const uuid = generarUUID()

    // Obtener versiones existentes para sugerir
    const existentes = await db.snapshotProyecto.findMany({
      select: { version: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    const version = data.version || sugerirVersion(existentes.map(s => s.version))

    // Crear snapshot
    const { data: snapshotData, rutaArchivo, tamano, checksum } = crearSnapshot({
      uuid,
      version,
      nombre: data.nombre,
      descripcion: data.descripcion || '',
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      motivo: data.motivo,
    })

    // Guardar en BD
    const snapshot = await db.snapshotProyecto.create({
      data: {
        uuid,
        version,
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        estado: 'COMPLETADO',
        tamano,
        rutaArchivo: path.relative(process.cwd(), rutaArchivo),
        checksum,
        archivosTotal: snapshotData.metadata.totalFiles,
        modulosAfectados: JSON.stringify(snapshotData.metadata.modulos),
        tipo: data.tipo,
        usuarioId: auth.id,
        usuarioNombre: auth.nombre,
        motivo: data.motivo || null,
        metadata: JSON.stringify({
          timestamp: snapshotData.timestamp,
          totalSize: snapshotData.metadata.totalSize,
          nodeVersion: snapshotData.metadata.nodeVersion,
          prismaVersion: snapshotData.metadata.prismaVersion,
        }),
      },
    })

    // Audit log
    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: 'SNAPSHOT_CREADO',
      modulo: 'snapshots',
      entidadId: snapshot.id,
      entidadNombre: `${snapshot.version} - ${snapshot.nombre}`,
      detalles: `Snapshot ${uuid} v${version} con ${snapshotData.metadata.totalFiles} archivos (${tamano} bytes)`,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      exito: true,
    })

    return NextResponse.json({
      success: true,
      data: snapshot,
      mensaje: `Snapshot ${version} creado con ${snapshotData.metadata.totalFiles} archivos`,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// Need to import path at top level
import path from 'path'
