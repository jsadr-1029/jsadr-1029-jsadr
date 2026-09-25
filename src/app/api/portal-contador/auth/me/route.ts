import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireContador } from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/auth/me
// Retorna la info del usuario autenticado + lista de empresas disponibles.
export async function GET(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth
    const user = auth as any

    const usuario = await db.usuario.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        nombre: true,
        email: true,
        rol: true,
        mustChangePassword: true,
        activo: true,
        ultimoAcceso: true,
      },
    })

    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado.' },
        { status: 404 }
      )
    }

    // Listar empresas activas a las que el contador tiene acceso.
    // Por simplicidad, todas las empresas activas están disponibles para
    // el contador (multi-empresa: filtra por empresaId en cada operación).
    const empresas = await db.contEmpresa.findMany({
      where: { activa: true },
      select: {
        id: true,
        razonSocial: true,
        nit: true,
        municipio: true,
        departamento: true,
      },
      orderBy: { razonSocial: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        usuario,
        empresas,
      },
    })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
