// =====================================================
// /api/seguridad/rollback — Rollback deploy de Vercel
// -----------------------------------------------------
// POST: rollback al deployment anterior usando Vercel API.
// Solo ADMIN puede ejecutar esta acción crítica.
//
// Body: { deploymentId?: string }
//   - Si no se especifica deploymentId, se obtiene el deployment
//     anterior al actual (penúltimo deploy READY).
//   - Si se especifica, se promueve ese deployment a producción.
//
// Vercel API: POST /v13/deployments/{id}/promote?teamId=...
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { registrarAuditLog, getClientInfo, decryptSensitive } from '@/lib/security'
import { sanitizeError } from '@/lib/error-handler'

const VERCEL_API = 'https://api.vercel.com'

async function getProjectId(): Promise<string | null> {
  try {
    const ps = await db.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } })
    if (ps?.proyectoRef) return ps.proyectoRef
  } catch {}
  return process.env.VERCEL_PROJECT_ID || null
}

async function getVercelToken(): Promise<string | null> {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN
  try {
    const ps = await db.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } })
    if (ps?.tokenCifrado) {
      const decrypted = decryptSensitive(ps.tokenCifrado)
      if (decrypted && decrypted !== ps.tokenCifrado) return decrypted
    }
  } catch {}
  return null
}

async function getTeamId(): Promise<string | null> {
  if (process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID) {
    return process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID || null
  }
  try {
    const ps = await db.plataformaSync.findUnique({ where: { plataforma: 'VERCEL' } })
    if (ps?.configJson) {
      const extra = JSON.parse(ps.configJson)
      if (extra.teamId) return extra.teamId
    }
  } catch {}
  return null
}

async function listRecentDeploys(
  projectId: string,
  token: string,
  teamId: string | null,
  limit = 5
): Promise<Array<{ uid: string; url: string; state: string; createdAt: number; commitSha?: string; commitMsg?: string }>> {
  const url = `${VERCEL_API}/v6/deployments?projectId=${projectId}&limit=${limit}&target=production${teamId ? `&teamId=${teamId}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    throw new Error(`Vercel API list deployments HTTP ${res.status}`)
  }
  const data: any = await res.json()
  return (data.deployments || []).map((d: any) => ({
    uid: d.uid,
    url: d.url,
    state: d.readyState,
    createdAt: d.createdAt,
    commitSha: d.meta?.githubCommitSha,
    commitMsg: d.meta?.githubCommitMessage,
  }))
}

async function promoteDeployment(
  deploymentId: string,
  token: string,
  teamId: string | null,
  projectId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const url = `${VERCEL_API}/v13/deployments/${deploymentId}/promote?projectId=${projectId}${teamId ? `&teamId=${teamId}` : ''}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    return { success: false, error: `Vercel API promote HTTP ${res.status}: ${errText.slice(0, 200)}` }
  }
  const data: any = await res.json().catch(() => ({}))
  return { success: true, url: data.url || deploymentId }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const body = await req.json().catch(() => ({}))
    const clientInfo = getClientInfo(req)

    const token = await getVercelToken()
    const projectId = await getProjectId()
    const teamId = await getTeamId()

    if (!token || !projectId) {
      return NextResponse.json(
        {
          success: false,
          error: 'VERCEL_TOKEN o VERCEL_PROJECT_ID no configurados. Configúralos en .env o en PlataformaSync.VERCEL.',
        },
        { status: 500 }
      )
    }

    let targetDeploymentId = (body?.deploymentId || '').trim()
    let targetInfo: { uid: string; url?: string; commitSha?: string; commitMsg?: string } | null = null

    if (!targetDeploymentId) {
      const deploys = await listRecentDeploys(projectId, token, teamId, 5)
      const readyDeploys = deploys.filter((d) => d.state === 'READY')
      if (readyDeploys.length < 2) {
        return NextResponse.json(
          {
            success: false,
            error: 'No hay deployment anterior al que hacer rollback. Necesitas al menos 2 deploys READY.',
            deploys: deploys.map((d) => ({ uid: d.uid, state: d.state, commit: d.commitMsg?.slice(0, 50) })),
          },
          { status: 400 }
        )
      }
      targetInfo = readyDeploys[1]
      targetDeploymentId = targetInfo.uid
    } else {
      const deploys = await listRecentDeploys(projectId, token, teamId, 20)
      const found = deploys.find((d) => d.uid === targetDeploymentId || d.uid.startsWith(targetDeploymentId))
      if (!found) {
        return NextResponse.json(
          { success: false, error: `Deployment ${targetDeploymentId} no encontrado en los últimos 20 deploys.` },
          { status: 404 }
        )
      }
      targetInfo = found
    }

    const result = await promoteDeployment(targetDeploymentId, token, teamId, projectId)

    await registrarAuditLog({
      usuarioId: auth.id,
      usuarioNombre: auth.nombre,
      accion: 'VERCEL_ROLLBACK',
      modulo: 'seguridad/rollback',
      entidadId: targetDeploymentId,
      entidadNombre: targetInfo?.url || undefined,
      detalles: JSON.stringify({
        deploymentId: targetDeploymentId,
        url: targetInfo?.url,
        commitSha: targetInfo?.commitSha,
        commitMsg: targetInfo?.commitMsg?.slice(0, 100),
        success: result.success,
        error: result.error,
      }),
      ipOrigen: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      exito: result.success,
      errorMessage: result.error || null,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, deploymentId: targetDeploymentId },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Rollback exitoso al deployment ${targetDeploymentId}`,
      deploymentId: targetDeploymentId,
      url: result.url || targetInfo?.url,
      commitSha: targetInfo?.commitSha,
      commitMsg: targetInfo?.commitMsg,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}

// GET: listar los últimos deploys disponibles para rollback
export async function GET(req: NextRequest) {
  try {
    const auth = requireRole(req, ['ADMIN'])
    if (auth instanceof NextResponse) return auth

    const token = await getVercelToken()
    const projectId = await getProjectId()
    const teamId = await getTeamId()

    if (!token || !projectId) {
      return NextResponse.json(
        { success: false, error: 'VERCEL_TOKEN o VERCEL_PROJECT_ID no configurados.' },
        { status: 500 }
      )
    }

    const deploys = await listRecentDeploys(projectId, token, teamId, 10)

    return NextResponse.json({
      success: true,
      deploys: deploys.map((d) => ({
        uid: d.uid,
        url: d.url,
        state: d.state,
        createdAt: new Date(d.createdAt).toISOString(),
        commitSha: d.commitSha,
        commitMsg: d.commitMsg,
      })),
      canRollback: deploys.filter((d) => d.state === 'READY').length >= 2,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
