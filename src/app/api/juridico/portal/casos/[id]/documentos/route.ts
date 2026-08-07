// =====================================================
// /api/juridico/portal/casos/[id]/documentos
// v4.11 (QA M08 TC-JUR-009)
// =====================================================
//   POST → subir documento legal al caso
//
// Body: { tipo, nombre, descripcion?, contenido? }
//
// Autenticación:
//   - Token en header `x-juridico-token` o query `?token=`
//   - valida tokenExpira > now
//
// Autorización:
//   - ABOGADO: solo si el caso está asignado a él.
//   - GESTOR: cualquier caso.
//
// Respuesta:
//   HTTP 201 + documento creado + trazabilidad (DocumentoLegal + AuditLog +
//   CronologiaCaso con tipoEvento='OTRO' y titulo='Documento agregado').
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { verificarTokenPortal } from '../../../auth/route'
import { registrarAuditLog, getClientInfo } from '@/lib/security'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: casoId } = await params

    // === Token ===
    const headerToken = req.headers.get('x-juridico-token')
    const queryToken = new URL(req.url).searchParams.get('token')
    const token = headerToken || queryToken

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token de sesión requerido' },
        { status: 401 }
      )
    }

    const usuario = await verificarTokenPortal(token)
    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' },
        { status: 401 }
      )
    }

    // === Validar body ===
    const body = await req.json()
    const { tipo, nombre, descripcion, contenido } = body || {}

    if (!nombre || !tipo) {
      return NextResponse.json(
        { success: false, error: 'nombre y tipo son obligatorios', codigo: 'MISSING_FIELDS' },
        { status: 400 }
      )
    }

    // === Buscar el caso ===
    const caso = await db.casoJuridico.findUnique({
      where: { id: casoId },
      select: {
        id: true,
        abogadoEmail: true,
        abogadoNombre: true,
        prestamo: { select: { codigo: true } },
      },
    })

    if (!caso) {
      return NextResponse.json(
        { success: false, error: 'Caso no encontrado' },
        { status: 404 }
      )
    }

    // === Validar asignación (TC-JUR-010 reutilizado) ===
    if (usuario.rol === 'ABOGADO') {
      const esAsignado =
        (usuario.cedula && caso.abogadoEmail?.includes(usuario.cedula)) ||
        caso.abogadoNombre?.includes(usuario.nombre)
      if (!esAsignado) {
        return NextResponse.json(
          {
            success: false,
            error: 'No autorizado. Este caso no está asignado a tu usuario.',
            codigo: 'CASO_AJENO',
          },
          { status: 403 }
        )
      }
    }

    const clientInfo = getClientInfo(req)

    // === Crear documento + cronología + audit log (transacción) ===
    const documento = await db.$transaction(async (tx) => {
      const doc = await tx.documentoLegal.create({
        data: {
          casoId,
          tipo,
          nombre,
          descripcion: descripcion || null,
          contenido: contenido || null,
        },
      })

      // Trazabilidad en cronología del caso
      await tx.cronologiaCaso.create({
        data: {
          casoId,
          tipoEvento: 'OTRO',
          titulo: 'Documento agregado',
          descripcion: `Documento "${nombre}" (tipo ${tipo}) agregado por ${usuario.nombre}`,
          resultado: 'Documento guardado',
          actor: usuario.nombre,
          fecha: new Date(),
        },
      })

      return doc
    })

    // === Audit log ===
    try {
      await registrarAuditLog({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'CREATE',
        modulo: 'juridico',
        entidadId: documento.id,
        entidadNombre: `Documento ${documento.nombre} del caso ${casoId}`,
        detalles: JSON.stringify({
          casoId,
          tipo,
          nombre,
          prestamoCodigo: caso.prestamo?.codigo,
        }),
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })
    } catch {
      // no bloquear
    }

    return NextResponse.json(
      {
        success: true,
        data: documento,
        message: 'Documento guardado correctamente',
      },
      { status: 201 }
    )
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
