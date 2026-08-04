// =====================================================
// /api/seguridad/credenciales/eliminar
// -----------------------------------------------------
// POST /api/seguridad/credenciales/eliminar
//   { plataforma: 'BREVO_SMTP' | 'VERCEL' | 'GITHUB' | 'NEON',
//     clave: 'Eliminar' }
//
// Elimina (bloquea) las credenciales de la plataforma indicada.
// Requiere la clave maestra "Eliminar" (constante del backend,
// no caduca, no se almacena en BD).
//
// Para BREVO_SMTP: limpia ConexionAPI.EMAIL_SMTP.password,
//                  CorreoInstitucional.smtpPass
//                  y BREVO_SMTP_KEY en Vercel env vars
// Para VERCEL:     limpia PlataformaSync.VERCEL.tokenCifrado
//                  y VERCEL_TOKEN en Vercel env vars
// Para GITHUB:     limpia PlataformaSync.GITHUB.tokenCifrado
// Para NEON:       limpia PlataformaSync.NEON.tokenCifrado
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { sanitizeError } from '@/lib/error-handler'
import { registrarAuditLog, getClientInfo, decryptSensitive } from '@/lib/security'

// Clave maestra de eliminación (constante del backend, no caduca)
const CLAVE_ELIMINACION_MAESTRA = 'Eliminar'

// Configuración de Vercel
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID

// =====================================================
// Eliminar env var de Vercel (busca por key y la borra)
// =====================================================
async function eliminarVercelEnvVar(token: string, envKey: string): Promise<{ ok: boolean; mensaje: string }> {
  if (!VERCEL_PROJECT_ID || !VERCEL_TEAM_ID) {
    return { ok: false, mensaje: 'VERCEL_PROJECT_ID o VERCEL_TEAM_ID no configurados en el servidor' }
  }
  try {
    // Listar env vars existentes
    const listRes = await fetch(
      `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!listRes.ok) {
      return { ok: false, mensaje: `No se pudo listar env vars de Vercel: HTTP ${listRes.status}` }
    }
    const listJson = await listRes.json()
    const existing = (listJson.envs || []).find((e: any) => e.key === envKey)
    if (!existing) {
      return { ok: true, mensaje: `Env var '${envKey}' no existía en Vercel` }
    }
    // Eliminar
    const delRes = await fetch(
      `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env/${existing.id}?teamId=${VERCEL_TEAM_ID}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    if (delRes.ok) {
      return { ok: true, mensaje: `Env var '${envKey}' eliminada de Vercel` }
    }
    return { ok: false, mensaje: `Fallo al eliminar '${envKey}' de Vercel: HTTP ${delRes.status}` }
  } catch (e: any) {
    return { ok: false, mensaje: `Excepción eliminando '${envKey}' de Vercel: ${e.message}` }
  }
}

// =====================================================
// POST
// =====================================================
export async function POST(req: NextRequest) {
  try {
    // Solo ADMIN puede eliminar credenciales
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const user = authResult
    const clientInfo = getClientInfo(req)

    const body = await req.json()
    const { plataforma, clave } = body || {}

    // === Validar clave maestra ===
    if (!clave || clave !== CLAVE_ELIMINACION_MAESTRA) {
      await registrarAuditLog({
        usuarioId: user.id === 'system' ? null : user.id,
        usuarioNombre: user.nombre,
        accion: 'CREDENCIAL_ELIMINAR_INTENTO_FALLIDO',
        modulo: 'seguridad',
        detalles: JSON.stringify({
          plataforma: plataforma || 'UNKNOWN',
          motivo: 'Clave maestra incorrecta',
        }),
        exito: false,
        errorMessage: 'Clave maestra incorrecta',
        ipOrigen: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Clave maestra incorrecta. Se requiere la palabra "Eliminar".',
          code: 'CLAVE_INCORRECTA',
        },
        { status: 403 }
      )
    }

    if (!plataforma || typeof plataforma !== 'string') {
      return NextResponse.json(
        { success: false, error: 'plataforma es requerido' },
        { status: 400 }
      )
    }

    const resultados: string[] = []
    let totalOk = true

    // === Caso 1: BREVO_SMTP ===
    if (plataforma === 'BREVO_SMTP') {
      // Limpiar ConexionAPI.EMAIL_SMTP
      const smtp = await db.conexionAPI.findFirst({ where: { tipo: 'EMAIL_SMTP' } })
      if (smtp) {
        await db.conexionAPI.update({
          where: { id: smtp.id },
          data: {
            password: null,
            apiKey: null,
            activa: false,
            fechaUltimaPrueba: new Date(),
            probada: false,
            resultadoUltimaPrueba: 'Credenciales eliminadas por administrador',
          },
        })
        resultados.push('ConexionAPI.EMAIL_SMTP.password limpiada')
      } else {
        resultados.push('ConexionAPI.EMAIL_SMTP no existía')
      }

      // Limpiar CorreoInstitucional.smtpPass para el email jsa@jsadr.com.co
      const correos = await db.correoInstitucional.findMany({
        where: { email: 'jsa@jsadr.com.co' },
      })
      for (const c of correos) {
        await db.correoInstitucional.update({
          where: { id: c.id },
          data: {
            smtpPass: null,
            estado: 'inactivo',
          },
        })
        resultados.push(`CorreoInstitucional ${c.email} smtpPass limpiada`)
      }

      // Eliminar BREVO_SMTP_KEY de Vercel env vars
      // Para esto necesitamos un Vercel token válido
      const vercelPlat = await db.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } })
      if (vercelPlat?.tokenCifrado) {
        try {
          const vercelToken = decryptSensitive(vercelPlat.tokenCifrado)
          const del = await eliminarVercelEnvVar(vercelToken, 'BREVO_SMTP_KEY')
          resultados.push(del.mensaje)
          if (!del.ok) totalOk = false
        } catch (e: any) {
          resultados.push(`No se pudo eliminar BREVO_SMTP_KEY de Vercel: ${e.message}`)
          totalOk = false
        }
      } else {
        resultados.push('No se eliminó BREVO_SMTP_KEY de Vercel: VERCEL token no configurado en BD')
      }
    }
    // === Caso 2: VERCEL ===
    else if (plataforma === 'VERCEL') {
      const vercel = await db.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } })
      if (vercel?.tokenCifrado) {
        // Antes de limpiar el token, usarlo para eliminar VERCEL_TOKEN de Vercel env vars
        try {
          const vercelToken = decryptSensitive(vercel.tokenCifrado)
          const del = await eliminarVercelEnvVar(vercelToken, 'VERCEL_TOKEN')
          resultados.push(del.mensaje)
          if (!del.ok) totalOk = false
        } catch (e: any) {
          resultados.push(`No se pudo eliminar VERCEL_TOKEN de Vercel: ${e.message}`)
          totalOk = false
        }

        // Ahora limpiar el token de la BD
        await db.plataformaSync.update({
          where: { plataforma: 'VERCEL' },
          data: {
            tokenCifrado: null,
            sincronizado: false,
            tiempoReal: false,
            ultimoEstado: 'NO_CONFIGURADO',
            ultimoError: null,
            ultimoSync: new Date(),
          },
        })
        resultados.push('PlataformaSync.VERCEL.tokenCifrado limpiado')
      } else {
        resultados.push('PlataformaSync.VERCEL no tenía token configurado')
      }
    }
    // === Caso 3: GITHUB ===
    else if (plataforma === 'GITHUB') {
      const github = await db.plataformaSync.findUnique({ where: { plataforma: 'GITHUB' } })
      if (github?.tokenCifrado) {
        await db.plataformaSync.update({
          where: { plataforma: 'GITHUB' },
          data: {
            tokenCifrado: null,
            sincronizado: false,
            tiempoReal: false,
            ultimoEstado: 'NO_CONFIGURADO',
            ultimoError: null,
            ultimoSync: new Date(),
          },
        })
        resultados.push('PlataformaSync.GITHUB.tokenCifrado limpiado')
      } else {
        resultados.push('PlataformaSync.GITHUB no tenía token configurado')
      }
    }
    // === Caso 4: NEON ===
    else if (plataforma === 'NEON') {
      const neon = await db.plataformaSync.findUnique({ where: { plataforma: 'NEON' } })
      if (neon?.tokenCifrado) {
        await db.plataformaSync.update({
          where: { plataforma: 'NEON' },
          data: {
            tokenCifrado: null,
            sincronizado: false,
            tiempoReal: false,
            ultimoEstado: 'NO_CONFIGURADO',
            ultimoError: null,
            ultimoSync: new Date(),
          },
        })
        resultados.push('PlataformaSync.NEON.tokenCifrado limpiado')
      } else {
        resultados.push('PlataformaSync.NEON no tenía token configurado')
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `Plataforma '${plataforma}' no soportada. Use: BREVO_SMTP, VERCEL, GITHUB o NEON`,
        },
        { status: 400 }
      )
    }

    // === Registrar en audit log ===
    await registrarAuditLog({
      usuarioId: user.id === 'system' ? null : user.id,
      usuarioNombre: user.nombre,
      accion: 'CREDENCIAL_ELIMINADA',
      modulo: 'seguridad',
      entidadNombre: plataforma,
      detalles: JSON.stringify({
        plataforma,
        resultados,
      }),
      exito: totalOk,
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    })

    return NextResponse.json({
      success: true,
      mensaje: `Credenciales de ${plataforma} eliminadas correctamente`,
      plataforma,
      resultados,
    })
  } catch (error: any) {
    console.error('[credenciales eliminar] error:', error)
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
