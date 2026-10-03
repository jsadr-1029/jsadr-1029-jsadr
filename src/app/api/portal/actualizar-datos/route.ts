import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

// =====================================================
// POST /api/portal/actualizar-datos
// Body: {
//   token: string,
//   telefono: string,
//   email: string,
//   ciudad: string,
//   municipio: string,
//   direccion: string,
//   fotoCedulaFrente: string (data:image/...base64),
//   fotoCedulaReverso: string,
//   fotoSelfie: string,
// }
//
// Guarda los datos actualizados del cliente y marca
// datosActualizadosOct2026 = true para que no se vuelva a pedir.
// También guarda las 3 fotos como DocumentoGestor.
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      token,
      telefono,
      email,
      ciudad,
      municipio,
      direccion,
      fotoCedulaFrente,
      fotoCedulaReverso,
      fotoSelfie,
    } = body

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 401 }
      )
    }

    const cliente = await db.cliente.findFirst({ where: { tokenSesion: token } })
    if (!cliente || !cliente.tokenExpira || new Date(cliente.tokenExpira) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada' },
        { status: 401 }
      )
    }

    // Validar que al menos las fotos vengan
    if (!fotoCedulaFrente || !fotoCedulaReverso || !fotoSelfie) {
      return NextResponse.json(
        { success: false, error: 'Las 3 fotos son obligatorias (cédula frente, cédula reverso, selfie)' },
        { status: 400 }
      )
    }

    // Validar formato de fotos
    for (const [k, v] of Object.entries({ fotoCedulaFrente, fotoCedulaReverso, fotoSelfie })) {
      if (typeof v !== 'string' || !v.startsWith('data:image/')) {
        return NextResponse.json(
          { success: false, error: `La foto ${k.replace('foto', '').toLowerCase()} no tiene formato válido` },
          { status: 400 }
        )
      }
      if (v.length > 7 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: `La foto ${k.replace('foto', '').toLowerCase()} es demasiado grande (máx 5MB)` },
          { status: 400 }
        )
      }
    }

    // Actualizar datos del cliente
    await db.cliente.update({
      where: { id: cliente.id },
      data: {
        telefono: telefono || cliente.telefono,
        email: email || cliente.email,
        ciudad: ciudad || cliente.ciudad,
        municipio: municipio || cliente.municipio,
        direccion: direccion || cliente.direccion,
        datosActualizadosOct2026: true,
        fechaActualizacionDatos: new Date(),
      },
    })

    // Eliminar fotos anteriores de actualización (si las hay)
    await db.documentoGestor.deleteMany({
      where: {
        clienteId: cliente.id,
        tipo: { in: ['ACTUALIZACION_CEDULA_FRENTE', 'ACTUALIZACION_CEDULA_REVERSO', 'ACTUALIZACION_SELFIE'] },
      },
    })

    // Guardar las 3 fotos como DocumentoGestor
    const fotos = [
      { tipo: 'ACTUALIZACION_CEDULA_FRENTE', titulo: 'Cédula frente (actualización oct 2026)', b64: fotoCedulaFrente, nombre: `actualizacion-frente-${Date.now()}.jpg` },
      { tipo: 'ACTUALIZACION_CEDULA_REVERSO', titulo: 'Cédula reverso (actualización oct 2026)', b64: fotoCedulaReverso, nombre: `actualizacion-reverso-${Date.now()}.jpg` },
      { tipo: 'ACTUALIZACION_SELFIE', titulo: 'Selfie con cédula (actualización oct 2026)', b64: fotoSelfie, nombre: `actualizacion-selfie-${Date.now()}.jpg` },
    ]

    for (const f of fotos) {
      const tipoImagen = f.b64.startsWith('data:image/png') ? 'image/png'
        : f.b64.startsWith('data:image/webp') ? 'image/webp'
        : 'image/jpeg'

      await db.documentoGestor.create({
        data: {
          clienteId: cliente.id,
          tipo: f.tipo,
          titulo: f.titulo,
          descripcion: 'Actualización obligatoria de datos - octubre 2026',
          archivoBase64: f.b64,
          archivoNombre: f.nombre,
          archivoTipo: tipoImagen,
          archivoTamano: Math.round(f.b64.length * 0.75),
          subidoPor: 'cliente-actualizacion',
        },
      })
    }

    await db.accesoPortal.create({
      data: {
        clienteId: cliente.id,
        clienteCedula: cliente.cedula,
        clienteNombre: cliente.nombre,
        accion: 'ACTUALIZACION_DATOS',
        exito: true,
        detalle: 'Cliente actualizó datos de contacto y fotos de cédula (octubre 2026)',
      },
    })

    return NextResponse.json({
      success: true,
      mensaje: 'Datos actualizados correctamente. Ya puedes usar el portal.',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
