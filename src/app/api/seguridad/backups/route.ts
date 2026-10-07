import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/seguridad/backups — listar backups
// POST /api/seguridad/backups — crear backup manual
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth
    const backups = await db.backup.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
    return NextResponse.json({ success: true, data: backups })
  } catch (e) {
    return NextResponse.json({ success: false, error: sanitizeError(e).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth
    const body = await req.json()

    // Crear registro de backup
    const backup = await db.backup.create({
      data: {
        nombre: `Backup-${new Date().toISOString().slice(0,10)}`,
        tipo: body.tipo || 'MANUAL',
        tamano: 0,
        rutaArchivo: '/backups/manual',
        entidadTipo: 'COMPLETO',
        generadoPor: 'admin',
        metadata: JSON.stringify({
          descripcion: body.descripcion || 'Backup manual',
          fecha: new Date().toISOString(),
          prestamosActivos: await db.prestamo.count({ where: { estado: { in: ['ACTIVO', 'EN_MORA'] } } }),
          totalClientes: await db.cliente.count(),
        }),
      },
    })
    return NextResponse.json({ success: true, data: backup })
  } catch (e) {
    return NextResponse.json({ success: false, error: sanitizeError(e).message }, { status: 500 })
  }
}
