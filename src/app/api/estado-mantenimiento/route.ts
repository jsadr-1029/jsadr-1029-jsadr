import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// =====================================================
// GET /api/estado-mantenimiento
// -----------------------------------------------------
// Endpoint PÚBLICO (sin autenticación) que devuelve el estado
// actual del modo mantenimiento. Lo usa la página de login
// para mostrar el mensaje de mantenimiento a los clientes
// cuando intentan iniciar sesión.
//
// Respuesta:
//   {
//     "activo": boolean,
//     "mensaje": string,
//     "inicio": string | null,  // ISO date
//     "fin": string | null,     // ISO date
//     "permitirAdmin": boolean
//   }
// =====================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    let mant = await db.configMantenimiento.findFirst()
    if (!mant) {
      // Crear registro por defecto si no existe
      mant = await db.configMantenimiento.create({ data: {} })
    }

    return NextResponse.json({
      activo: mant.activo,
      mensaje: mant.mensaje,
      inicio: mant.inicio ? mant.inicio.toISOString() : null,
      fin: mant.fin ? mant.fin.toISOString() : null,
      permitirAdmin: mant.permitirAdmin,
      // Metadata útil para el frontend
      actualizado: mant.updatedAt.toISOString(),
    })
  } catch (error: any) {
    // En caso de error, asumir que el sistema está operativo
    // (mejor permitir login que bloquear a todos por un error de BD)
    return NextResponse.json({
      activo: false,
      mensaje: '',
      inicio: null,
      fin: null,
      permitirAdmin: true,
      error: 'No se pudo verificar el estado de mantenimiento',
    })
  }
}
