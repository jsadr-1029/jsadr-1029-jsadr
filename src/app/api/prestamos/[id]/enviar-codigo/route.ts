import { NextRequest, NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { generarYEnviarCodigosConfirmacion } from '@/lib/prestamo-codigo'

// =====================================================
// POST - generar y enviar código(s) de confirmación por correo.
//
// Si el solicitud tiene codeudor (tieneCodeudor=true y codeudorEmail
// seteado), genera y envía DOS códigos:
//   1. Uno al DEUDOR  (prestamo.cliente.email)
//   2. Uno al CODEUDOR (prestamo.codeudorEmail)
// El solicitud se activa solo cuando AMBOS roles verifican su código
// (ver /api/prestamos/[id]/verificar-codigo).
//
// Si NO tiene codeudor, genera un solo código para el DEUDOR.
// =====================================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, ['ADMIN', 'GESTOR'])
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await params
    const result = await generarYEnviarCodigosConfirmacion({ prestamoId: id, req })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
