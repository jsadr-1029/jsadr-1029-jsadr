// =====================================================
// /api/bots/devops-sentinel — Control del Sentinel DevOps IA
//   GET    → obtiene estado actual del sentinel (always-on)
//   POST   → acciones sobre el sentinel:
//             { accion: 'iniciar' | 'pausar' | 'reactivar' | 'auditoria_completa' }
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { getClientInfo, registrarAuditLog } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'
import {
  iniciarSentinel,
  pausarSentinel,
  reactivarSentinel,
  obtenerEstadoSentinel,
  ejecutarAuditoriaCompleta,
} from '@/lib/devops-sentinel'

// =====================================================
// GET — Estado del sentinel
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (auth instanceof NextResponse) return auth

    const estado = obtenerEstadoSentinel()

    return NextResponse.json({
      success: true,
      data: estado,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// =====================================================
// POST — Acciones del sentinel
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const clientInfo = getClientInfo(req)
    const body = await req.json()
    const { accion, codigoConfirmacion, duracionMinutos } = body

    if (!accion) {
      return NextResponse.json(
        { success: false, error: 'accion es requerida (iniciar | pausar | reactivar | auditoria_completa)' },
        { status: 400 }
      )
    }

    let resultado: any
    let mensajeLog = ''

    switch (accion) {
      case 'iniciar': {
        resultado = await iniciarSentinel()
        mensajeLog = `Sentinel iniciado por ${auth.username}. Ya estaba activo: ${resultado.yaEstabaActivo}`
        break
      }

      case 'pausar': {
        if (!codigoConfirmacion) {
          return NextResponse.json(
            {
              success: false,
              error: 'Para pausar el sentinel se requiere codigoConfirmacion = "DEVOPS-PAUSA-CONFIRMAR"',
              hint: 'El sentinel está diseñado para no apagarse. Esta pausa es temporal (default: 30 min, máx: 4h) y expira automáticamente.',
            },
            { status: 400 }
          )
        }
        resultado = await pausarSentinel(
          auth.username,
          codigoConfirmacion,
          duracionMinutos || 30
        )
        mensajeLog = `Sentinel pausado por ${auth.username}. Resultado: ${resultado.exito}`
        break
      }

      case 'reactivar': {
        resultado = await reactivarSentinel(auth.username)
        mensajeLog = `Sentinel reactivado por ${auth.username}`
        break
      }

      case 'auditoria_completa': {
        resultado = await ejecutarAuditoriaCompleta()
        mensajeLog = `Auditoría completa ejecutada por ${auth.username}. ${resultado.recomendaciones.length} recomendaciones.`
        break
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Acción no válida: ${accion}. Use: iniciar | pausar | reactivar | auditoria_completa`,
          },
          { status: 400 }
        )
    }

    // Registrar en audit log
    try {
      await registrarAuditLog({
        usuarioId: auth.id,
        usuarioNombre: auth.username,
        accion: `SENTINEL_${accion.toUpperCase()}`,
        modulo: 'devops',
        entidadNombre: 'DevOps Sentinel',
        detalles: mensajeLog,
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        exito: true,
      })
    } catch (e) {
      // no bloquear
    }

    return NextResponse.json({
      success: true,
      data: resultado,
      message: mensajeLog,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
