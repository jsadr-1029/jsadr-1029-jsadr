import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encryptSensitive, registrarAuditLog, getClientInfo } from '@/lib/security'
import { conexionApiSchema, validateInput } from '@/lib/validators'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'

// GET - listar todas las conexiones API (Reforzado: requiere GESTOR+)
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth
    const conexiones = await db.conexionAPI.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // No exponer passwords/apiKeys en texto plano, solo si están seteados
    const safe = conexiones.map((c) => ({
      ...c,
      apiKey: c.apiKey ? '••••••••' : null,
      apiSecret: c.apiSecret ? '••••••••' : null,
      password: c.password ? '••••••••' : null,
    }))

    return NextResponse.json({ success: true, data: safe })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// POST - crear nueva conexión API
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const clientInfo = getClientInfo(req)

    // Reforzado: validar con Zod antes de procesar
    const validacion = validateInput(conexionApiSchema, body)
    if (!validacion.success) {
      return NextResponse.json(
        { success: false, error: validacion.error, fieldErrors: validacion.fieldErrors },
        { status: 400 }
      )
    }

    const {
      nombre,
      tipo,
      descripcion,
      url,
      apiKey,
      apiSecret,
      usuario,
      password,
      accountId,
      telefonoOrigen,
      configuracionExtra,
      activa,
    } = body

    if (!nombre || !tipo) {
      return NextResponse.json(
        { success: false, error: 'Nombre y tipo son obligatorios' },
        { status: 400 }
      )
    }

    // Si se está activando, desactivar otras del mismo tipo (solo una activa por tipo)
    if (activa) {
      await db.conexionAPI.updateMany({
        where: { tipo },
        data: { activa: false },
      })
    }

    // Encriptar datos sensibles antes de guardar
    const conexion = await db.conexionAPI.create({
      data: {
        nombre,
        tipo,
        descripcion: descripcion || null,
        url: url || null,
        apiKey: apiKey ? encryptSensitive(apiKey) : null,
        apiSecret: apiSecret ? encryptSensitive(apiSecret) : null,
        usuario: usuario || null,
        password: password ? encryptSensitive(password) : null,
        accountId: accountId || null,
        telefonoOrigen: telefonoOrigen || null,
        configuracionExtra: configuracionExtra || null,
        activa: !!activa,
      },
    })

    await registrarAuditLog({
      usuarioNombre: 'Admin',
      accion: 'CONEXION_API_CREADA',
      modulo: 'conexiones',
      entidadId: conexion.id,
      entidadNombre: nombre,
      detalles: JSON.stringify({ tipo, activa }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    return NextResponse.json({ success: true, data: conexion })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
