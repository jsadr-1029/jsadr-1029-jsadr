import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { registrarAuditLog, getClientInfo } from '@/lib/security'
import crypto from 'crypto'

// =====================================================
// /api/pagos/[id]/comprobante v4.0 — OLA 2
// Sube/valida comprobante de pago (foto de transferencia).
// POST multipart: file (imagen/PDF) + opcionalmente observacion
// POST JSON: { accion: 'validar', observacion? } para validar comprobante existente
// =====================================================

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult as any

    const { id } = await params
    const pago = await db.pago.findUnique({
      where: { id },
      include: { prestamo: { include: { cliente: true } } },
    })
    if (!pago) return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 })

    const contentType = req.headers.get('content-type') || ''

    // === Subir comprobante ===
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json({ success: false, error: 'Archivo no proporcionado' }, { status: 400 })
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ success: false, error: `El archivo excede 5MB (tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB)` }, { status: 400 })
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ success: false, error: `Tipo de archivo no soportado: ${file.type}. Permitidos: JPG, PNG, WEBP, PDF` }, { status: 400 })
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const hash = crypto.createHash('sha256').update(buffer).digest('hex')

      // Guardar el archivo en disco bajo /home/z/my-project/uploads/comprobantes/
      // (en producción usar S3 u otro object storage)
      const uploadsDir = '/home/z/my-project/uploads/comprobantes'
      const fs = await import('fs/promises')
      await fs.mkdir(uploadsDir, { recursive: true })
      const extension = file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg')
      const filename = `${id}_${Date.now()}.${extension}`
      const filepath = `${uploadsDir}/${filename}`
      await fs.writeFile(filepath, buffer)
      const url = `/uploads/comprobantes/${filename}`

      await db.pago.update({
        where: { id },
        data: {
          comprobanteUrl: url,
          comprobanteHash: hash,
          comprobanteValidado: false,
        },
      })

      const clientInfo = getClientInfo(req)
      await registrarAuditLog({
        usuarioId: user.id, usuarioNombre: user.nombre,
        accion: 'COMPROBANTE_SUBIDO', modulo: 'pagos',
        entidadId: id, entidadNombre: `Pago ${pago.codigo || id}`,
        detalles: JSON.stringify({
          filename: file.name, size: file.size, type: file.type, hash,
        }),
        ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
      })

      return NextResponse.json({
        success: true,
        data: { url, hash, size: file.size, type: file.type },
      })
    }

    // === Validar comprobante (JSON) ===
    const body = await req.json()
    if (body.accion === 'validar') {
      if (!pago.comprobanteUrl) {
        return NextResponse.json({ success: false, error: 'Este pago no tiene comprobante cargado' }, { status: 400 })
      }
      await db.pago.update({
        where: { id },
        data: {
          comprobanteValidado: true,
          comprobanteValidadoPorId: user.id,
          comprobanteFechaValidacion: new Date(),
        },
      })
      const clientInfo = getClientInfo(req)
      await registrarAuditLog({
        usuarioId: user.id, usuarioNombre: user.nombre,
        accion: 'COMPROBANTE_VALIDADO', modulo: 'pagos',
        entidadId: id, entidadNombre: `Pago ${pago.codigo || id}`,
        detalles: JSON.stringify({ observacion: body.observacion || '' }),
        ipOrigen: clientInfo.ip, userAgent: clientInfo.userAgent,
      })
      return NextResponse.json({ success: true, mensaje: 'Comprobante validado' })
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
