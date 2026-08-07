// =====================================================
// /api/juridico/portal/casos/[id]/notas-internas
// v4.11 (QA M08 TC-JUR-011)
// =====================================================
//   POST → agregar nota interna al caso jurídico
//
// Body: { contenido, esImportante? }
//
// Autenticación:
//   - Token en header `x-juridico-token` o query `?token=`
//   - valida tokenExpira > now
//
// Autorización:
//   - ABOGADO: solo si el caso está asignado a él.
//   - GESTOR: cualquier caso.
//
// Trazabilidad:
//   - Como NotaInterna requiere conversacionId (modelo vinculado a chat),
//     guardamos la nota como CronologiaCaso con tipoEvento='OTRO',
//     titulo='Nota interna', actor=usuario.nombre, descripcion=contenido.
//   - Audit log separado con acción 'NOTA_INTERNA_CREADA'.
//
// Respuesta:
//   HTTP 201 + nota creada con autor=abogado actual.
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
    const { contenido, esImportante } = body || {}

    if (!contenido || !String(contenido).trim()) {
      return NextResponse.json(
        { success: false, error: 'contenido es obligatorio', codigo: 'MISSING_FIELDS' },
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

    // === Validar asignación ===
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

    // === Crear nota interna como CronologiaCaso (trazabilidad) ===
    // El modelo NotaInterna está vinculado a ConversacionChat, no a CasoJuridico.
    // Para mantener trazabilidad en el caso, usamos CronologiaCaso con tipoEvento='OTRO'.
    const nota = await db.cronologiaCaso.create({
      data: {
        casoId,
        tipoEvento: 'OTRO',
        titulo: esImportante ? 'Nota interna (importante)' : 'Nota interna',
        descripcion: String(contenido).trim(),
        resultado: null,
        actor: usuario.nombre, // autor = abogado actual
        fecha: new Date(),
      },
    })

    // === Audit log ===
    try {
      await registrarAuditLog({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion: 'NOTA_INTERNA_CREADA',
        modulo: 'juridico',
        entidadId: nota.id,
        entidadNombre: `Nota interna del caso ${casoId}`,
        detalles: JSON.stringify({
          casoId,
          autorId: usuario.id,
          autorNombre: usuario.nombre,
          esImportante: !!esImportante,
          contenidoLength: String(contenido).length,
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
        data: {
          ...nota,
          autor: {
            id: usuario.id,
            nombre: usuario.nombre,
            rol: usuario.rol,
          },
        },
        message: 'Nota interna agregada correctamente',
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
