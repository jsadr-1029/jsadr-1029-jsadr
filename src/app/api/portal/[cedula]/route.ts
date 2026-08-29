import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'

// GET - portal de consulta por cédula
// v4.10 (QA M07 TC-PORT-015): validación token vs cédula
//   - El cliente debe enviar su token de sesión (header x-portal-token o query ?token=).
//   - Se busca el cliente por tokenSesion y se verifica que su cédula coincida
//     con la cédula del URL. Si no coinciden → HTTP 403 (cross-cliente bloqueado).
//   - También se valida tokenExpira > now.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cedula: string }> }
) {
  try {
    const { cedula } = await params

    // === v4.10: Validar token de sesión del portal ===
    const token =
      req.headers.get('x-portal-token') ||
      new URL(req.url).searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token de sesión requerido. Inicie sesión en el portal.',
          codigo: 'TOKEN_REQUERIDO',
        },
        { status: 401 }
      )
    }

    // Buscar al cliente autenticado por tokenSesion (no por la cédula del URL)
    const clienteAutenticado = await db.cliente.findFirst({
      where: { tokenSesion: token as string },
      select: { id: true, cedula: true, nombre: true, tokenExpira: true },
    })

    if (
      !clienteAutenticado ||
      !clienteAutenticado.tokenExpira ||
      new Date(clienteAutenticado.tokenExpira) < new Date()
    ) {
      return NextResponse.json(
        { success: false, error: 'Sesión expirada', codigo: 'SESSION_EXPIRED' },
        { status: 401 }
      )
    }

    // === Validación cross-cliente: el token debe pertenecer a la cédula del URL ===
    if (clienteAutenticado.cedula !== cedula) {
      // Auditoría del intento de acceso cross-cliente
      await db.accesoPortal.create({
        data: {
          clienteId: clienteAutenticado.id,
          clienteCedula: clienteAutenticado.cedula,
          clienteNombre: clienteAutenticado.nombre,
          ipOrigen: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
          userAgent: req.headers.get('user-agent') || null,
          accion: 'ACCESO_CROSS_CLIENTE_BLOQUEADO',
          exito: false,
          detalle: `Cliente ${clienteAutenticado.cedula} intentó consultar datos de cédula ${cedula} (bloqueado).`,
        },
      })
      return NextResponse.json(
        {
          success: false,
          error: 'No autorizado para ver datos de otro cliente.',
          codigo: 'CROSS_CLIENTE_BLOQUEADO',
        },
        { status: 403 }
      )
    }

    const cliente = await db.cliente.findUnique({
      where: { cedula },
      include: {
        categoria: {
          include: { cuentaRecaudo: true },
        },
        prestamos: {
          include: {
            categoria: { include: { cuentaRecaudo: true } },
            pagos: {
              orderBy: { numeroCuota: 'asc' },
              include: { cuentaRecaudo: true },
            },
            casoJuridico: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'No se encontró ningún cliente con esa cédula' },
        { status: 404 }
      )
    }

    // Para cada solicitud activo, preparar la información de cuenta de recaudo
    // donde el cliente debe pagar
    const prestamosConCuenta = cliente.prestamos.map((p) => {
      const cuentaRecaudo = p.categoria?.cuentaRecaudo || cliente.categoria?.cuentaRecaudo || null
      return {
        ...p,
        cuentaRecaudoPago: cuentaRecaudo
          ? {
              banco: cuentaRecaudo.banco,
              tipoCuenta: cuentaRecaudo.tipoCuenta,
              numeroCuenta: cuentaRecaudo.numeroCuenta,
              titular: cuentaRecaudo.titular,
              nombreCuenta: cuentaRecaudo.nombre,
            }
          : null,
      }
    })

    // Resumen
    const prestamosActivos = prestamosConCuenta.filter(
      (p) => p.estado === 'ACTIVO' || p.estado === 'EN_MORA' || p.estado === 'PENDIENTE_ACEPTACION'
    )
    const prestamosCancelados = prestamosConCuenta.filter((p) => p.estado === 'CANCELADO')
    const prestamosJuridico = prestamosConCuenta.filter((p) => p.estado === 'JURIDICO')

    const saldoTotalActivos = prestamosActivos.reduce((s, p) => s + p.saldoTotal, 0)
    const totalPagado = prestamosConCuenta.reduce((s, p) => s + p.montoPagado, 0)

    // Cuenta de recaudo principal (la de la categoría del cliente)
    const cuentaPrincipal = cliente.categoria?.cuentaRecaudo || null

    // === Campañas activas ===
    // Mostrar:
    //   1. Campañas con destinatarios='TODOS' (todos los clientes las ven).
    //   2. Campañas con destinatarios='SELECCIONADOS' que estén asignadas a este cliente
    //      (tabla CampañaCliente).
    // Orden: por fecha de creación descendente (más recientes primero).
    const campanas = await db.campaña.findMany({
      where: {
        activa: true,
        OR: [
          { destinatarios: 'TODOS' },
          {
            destinatarios: 'SELECCIONADOS',
            clientesSeleccionados: { some: { clienteId: clienteAutenticado.id } }
          }
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // === Contar campañas NO VISTAS por el cliente (para mostrar badge de notificación) ===
    // Una campaña "no vista" es aquella con destinatarios='SELECCIONADOS' asignada a
    // este cliente donde vistaEnPortal=false. Para las de destinatarios='TODOS',
    // usamos la tabla CampañaVista (registro existente).
    const campanasAsignadasNoVistas = await db.campañaCliente.count({
      where: {
        clienteId: clienteAutenticado.id,
        vistaEnPortal: false,
        campaña: { activa: true, destinatarios: 'SELECCIONADOS' }
      }
    })
    const campanasTodasNoVistas = await db.campaña.count({
      where: {
        activa: true,
        destinatarios: 'TODOS',
        vistas: { none: { clienteId: clienteAutenticado.id } }
      }
    })
    const campanasNoVistas = campanasAsignadasNoVistas + campanasTodasNoVistas

    // === KEEP-ALIVE: extender la sesión 8h desde ahora ===
    // Cada vez que el cliente abre/refresca su portal, renovamos tokenExpira
    // para evitar que la sesión se cierre mientras la usa activamente.
    // Solo se cierra si el cliente pasa 8h SIN hacer ninguna llamada al API.
    try {
      await db.cliente.update({
        where: { id: clienteAutenticado.id },
        data: {
          tokenExpira: new Date(Date.now() + 8 * 60 * 60 * 1000), // +8h
          ultimoAccesoPortal: new Date(),
        },
      })
    } catch (e) {
      // No fallar la respuesta si no se puede extender la sesión
      console.error('[portal/[cedula]] keep-alive error:', e)
    }

    return NextResponse.json({
      success: true,
      data: {
        cliente,
        resumen: {
          totalPrestamos: prestamosConCuenta.length,
          prestamosActivos: prestamosActivos.length,
          prestamosCancelados: prestamosCancelados.length,
          prestamosJuridico: prestamosJuridico.length,
          saldoTotalActivos,
          totalPagado,
        },
        prestamos: prestamosConCuenta,
        campanas,
        campanasNoVistas,
        cuentaRecaudoPrincipal: cuentaPrincipal
          ? {
              banco: cuentaPrincipal.banco,
              tipoCuenta: cuentaPrincipal.tipoCuenta,
              numeroCuenta: cuentaPrincipal.numeroCuenta,
              titular: cuentaPrincipal.titular,
              nombreCuenta: cuentaPrincipal.nombre,
            }
          : null,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
