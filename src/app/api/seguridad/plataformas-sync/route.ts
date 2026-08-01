import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encryptSensitive, decryptSensitive } from '@/lib/security'
import { requireRole } from '@/lib/auth-guard'

// =====================================================
// Plataformas de Sincronización (GitHub / Vercel / Neon)
// Permite activar/desactivar sincronización en tiempo real
// desde el Módulo de Seguridad.
// =====================================================

const PLATAFORMAS_DEFAULT = [
  {
    plataforma: 'GITHUB',
    nombreMostrar: 'GitHub',
    descripcion: 'Repositorio de código fuente + CI/CD. Sincroniza commits, PRs, despliegues y workflows.',
    endpoint: 'https://api.github.com',
    ramaPrincipal: 'main',
  },
  {
    plataforma: 'VERCEL',
    nombreMostrar: 'Vercel',
    descripcion: 'Plataforma de hosting y despliegue del frontend Next.js. Sincroniza deployments, builds y dominios.',
    endpoint: 'https://api.vercel.com',
    ramaPrincipal: 'main',
  },
  {
    plataforma: 'NEON',
    nombreMostrar: 'Neon Database',
    descripcion: 'Base de datos PostgreSQL serverless. Sincroniza esquema, migraciones y estado de la BD.',
    endpoint: 'https://console.neon.tech/api/v2',
    ramaPrincipal: 'main',
  },
]

// GET: listar todas las plataformas (crea las defaults si no existen)
export async function GET(req: NextRequest) {
  try {
    // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede gestionar plataformas de sincronización
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    // Asegurar que existan las 3 plataformas por defecto
    for (const p of PLATAFORMAS_DEFAULT) {
      const exists = await db.plataformaSync.findUnique({ where: { plataforma: p.plataforma } })
      if (!exists) {
        await db.plataformaSync.create({
          data: {
            plataforma: p.plataforma,
            nombreMostrar: p.nombreMostrar,
            descripcion: p.descripcion,
            endpoint: p.endpoint,
            ramaPrincipal: p.ramaPrincipal,
            sincronizado: false,
            tiempoReal: false,
            ultimoEstado: 'NO_CONFIGURADO',
          },
        })
      }
    }

    const plataformas = await db.plataformaSync.findMany({
      orderBy: { plataforma: 'asc' },
    })

    // No exponer el tokenCifrado ni webhookSecret en crudo; devolver flags de presencia
    const safe = plataformas.map((p) => ({
      ...p,
      tokenConfigurado: !!p.tokenCifrado,
      webhookSecretConfigurado: !!p.webhookSecret,
      tokenCifrado: undefined,
      webhookSecret: p.webhookSecret ? '***' : null,
    }))

    return NextResponse.json({ plataformas: safe })
  } catch (e) {
    console.error('[plataformas-sync GET]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// POST: actualizar configuración / activar-desactivar sincronización
export async function POST(req: NextRequest) {
  try {
    // FIX-SEGURIDAD-CRITICA #1: RBAC — solo ADMIN puede modificar plataformas de sincronización
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult
    const body = await req.json()
    const {
      plataforma,
      accion, // 'toggle_sync' | 'toggle_realtime' | 'update_config' | 'test_connection' | 'register_event'
    } = body

    if (!plataforma || !accion) {
      return NextResponse.json({ error: 'plataforma y accion son requeridos' }, { status: 400 })
    }

    const existing = await db.plataformaSync.findUnique({ where: { plataforma } })
    if (!existing) {
      return NextResponse.json({ error: `Plataforma ${plataforma} no encontrada` }, { status: 404 })
    }

    switch (accion) {
      case 'toggle_sync': {
        // Activar/desactivar sincronización principal
        const nuevoValor = !existing.sincronizado
        const updated = await db.plataformaSync.update({
          where: { plataforma },
          data: {
            sincronizado: nuevoValor,
            ultimoSync: nuevoValor ? new Date() : existing.ultimoSync,
            ultimoEstado: nuevoValor ? 'OK' : 'NO_CONFIGURADO',
            ultimoError: nuevoValor ? null : existing.ultimoError,
            // Si se desactiva la sincronización principal, también se desactiva tiempo real
            tiempoReal: nuevoValor ? existing.tiempoReal : false,
          },
        })
        return NextResponse.json({
          ok: true,
          plataforma: updated.plataforma,
          sincronizado: updated.sincronizado,
          tiempoReal: updated.tiempoReal,
          mensaje: nuevoValor
            ? `Sincronización con ${updated.nombreMostrar} ACTIVADA`
            : `Sincronización con ${updated.nombreMostrar} DESACTIVADA`,
        })
      }

      case 'toggle_realtime': {
        if (!existing.sincronizado) {
          return NextResponse.json({
            error: `Primero activa la sincronización principal de ${existing.nombreMostrar}`,
          }, { status: 400 })
        }
        if (!existing.tokenCifrado) {
          return NextResponse.json({
            error: `Configura el token de ${existing.nombreMostrar} antes de activar tiempo real`,
          }, { status: 400 })
        }
        const nuevoRT = !existing.tiempoReal
        const updated = await db.plataformaSync.update({
          where: { plataforma },
          data: { tiempoReal: nuevoRT },
        })
        return NextResponse.json({
          ok: true,
          plataforma: updated.plataforma,
          tiempoReal: updated.tiempoReal,
          mensaje: nuevoRT
            ? `Sincronización en tiempo real con ${updated.nombreMostrar} ACTIVADA`
            : `Sincronización en tiempo real con ${updated.nombreMostrar} DESACTIVADA`,
        })
      }

      case 'update_config': {
        const {
          endpoint,
          proyectoRef,
          region,
          ramaPrincipal,
          token,           // token plano — se cifra antes de guardar
          webhookSecret,
          webhookUrl,
          descripcion,
        } = body

        const data: any = {}
        if (endpoint !== undefined) data.endpoint = endpoint
        if (proyectoRef !== undefined) data.proyectoRef = proyectoRef
        if (region !== undefined) data.region = region
        if (ramaPrincipal !== undefined) data.ramaPrincipal = ramaPrincipal
        if (webhookUrl !== undefined) data.webhookUrl = webhookUrl
        if (descripcion !== undefined) data.descripcion = descripcion
        if (token !== undefined && token !== '') {
          data.tokenCifrado = encryptSensitive(token)
        }
        if (webhookSecret !== undefined && webhookSecret !== '') {
          data.webhookSecret = encryptSensitive(webhookSecret)
        }

        const updated = await db.plataformaSync.update({
          where: { plataforma },
          data,
        })
        return NextResponse.json({
          ok: true,
          plataforma: updated.plataforma,
          mensaje: `Configuración de ${updated.nombreMostrar} actualizada`,
        })
      }

      case 'test_connection': {
        if (!existing.tokenCifrado) {
          return NextResponse.json({
            ok: false,
            error: `No hay token configurado para ${existing.nombreMostrar}`,
          }, { status: 400 })
        }
        // Decifrar y validar contra el endpoint de la plataforma
        const token = decryptSensitive(existing.tokenCifrado)
        const testResult = await testPlataformaConnection(plataforma, existing.endpoint || '', token, existing.proyectoRef)
        const updated = await db.plataformaSync.update({
          where: { plataforma },
          data: {
            ultimoSync: new Date(),
            ultimoEstado: testResult.ok ? 'OK' : 'ERROR',
            ultimoError: testResult.ok ? null : testResult.error,
          },
        })
        return NextResponse.json({
          ok: testResult.ok,
          plataforma,
          estado: updated.ultimoEstado,
          error: testResult.error,
          detalle: testResult.detalle,
        })
      }

      case 'register_event': {
        // Llamado por el webhook receiver cuando llega un evento
        const updated = await db.plataformaSync.update({
          where: { plataforma },
          data: {
            eventosRecibidos: { increment: 1 },
            ultimoSync: new Date(),
            ultimoEstado: 'OK',
            ultimoError: null,
          },
        })
        return NextResponse.json({ ok: true, eventosRecibidos: updated.eventosRecibidos })
      }

      default:
        return NextResponse.json({ error: `Acción desconocida: ${accion}` }, { status: 400 })
    }
  } catch (e) {
    console.error('[plataformas-sync POST]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// =====================================================
// Probar conexión real con cada plataforma
// =====================================================
async function testPlataformaConnection(
  plataforma: string,
  endpoint: string,
  token: string,
  proyectoRef: string | null,
): Promise<{ ok: boolean; error?: string; detalle?: string }> {
  try {
    if (plataforma === 'GITHUB') {
      const res = await fetch(`${endpoint}/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` }
      const data = await res.json()
      return { ok: true, detalle: `Conectado como @${data.login} (${data.name || 'sin nombre'})` }
    }

    if (plataforma === 'VERCEL') {
      const res = await fetch(`${endpoint}/v2/user`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` }
      const data = await res.json()
      return { ok: true, detalle: `Conectado como ${data.user?.email || data.user?.username || 'usuario'}` }
    }

    if (plataforma === 'NEON') {
      const res = await fetch(`${endpoint}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` }
      const data = await res.json()
      return { ok: true, detalle: `Conectado como ${data.email || data.login || 'usuario'} (${data.name || ''})` }
    }

    return { ok: false, error: `Plataforma no soportada: ${plataforma}` }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
