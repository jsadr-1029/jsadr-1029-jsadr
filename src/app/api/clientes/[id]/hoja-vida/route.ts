import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'
import { formatearMoneda } from '@/lib/finanzas'

// =====================================================
// GET /api/clientes/[id]/hoja-vida
// =====================================================
// Devuelve la "Hoja de Vida" completa del cliente:
//   - Datos personales
//   - Fotos de registro (cédula frente/reverso + selfie)
//   - Lista de solicitudes (con estado, saldo, fechas)
//   - Historial de pagos (cronológico)
//   - Comportamiento de pagos (puntualidad, promedio, días de mora promedio)
//   - Estadísticas agregadas (total prestado, total pagado, # solicitudes, # atrasos)
//   - Bitácora de eventos del cliente
//   - Estado de mora actual (¿tiene solicitudes en EN_MORA o JURIDICO?)
//
// Esta API alimenta el modal "Hoja de Vida del Cliente" que se abre al
// seleccionar un cliente desde Solicitudes > Clientes.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult
    const { id } = await params

    // === Cargar cliente con relaciones principales ===
    const cliente = await db.cliente.findUnique({
      where: { id },
      include: {
        referidoPor: {
          select: {
            id: true, nombre: true, cedula: true, telefono: true, email: true,
          },
        },
        referidos: {
          select: {
            id: true, nombre: true, cedula: true, telefono: true, createdAt: true, activo: true,
          },
        },
        categoria: true,
        cuentaRecaudo: true,
        documentosGestor: {
          where: {
            tipo: { in: ['FOTO_DOCUMENTO', 'FOTO_CEDULA', 'FOTO_SELFI', 'FOTO_DOCUMENTO_REVERSO'] },
          },
          select: {
            id: true, tipo: true, titulo: true, descripcion: true,
            archivoBase64: true, archivoNombre: true, archivoTipo: true,
            subidoPor: true, fechaSubida: true,
          },
          orderBy: { fechaSubida: 'desc' },
        },
        // Solicitudes del cliente (todos los estados)
        prestamos: {
          select: {
            id: true,
            codigo: true,
            montoPrincipal: true,
            tasaInteresAnual: true,
            plazoMeses: true,
            frecuencia: true,
            numeroCuotas: true,
            montoCuota: true,
            cuotasPagadas: true,
            saldoTotal: true,
            montoPagado: true,
            montoMora: true,
            diasMora: true,
            estado: true,
            fechaSolicitud: true,
            fechaDesembolso: true,
            fechaVencimiento: true,
            updatedAt: true,
            tieneCodeudor: true,
            codeudorNombre: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { prestamos: true, referidos: true } },
      },
    })

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    // === Cargar todos los pagos de todos los solicitudes del cliente ===
    const prestamoIds = cliente.prestamos.map((p) => p.id)
    const pagosRaw = prestamoIds.length > 0
      ? await db.pago.findMany({
          where: {
            prestamoId: { in: prestamoIds },
            estado: { in: ['APLICADO', 'PAGO_PARCIAL', 'ANULADO', 'REVERSADO'] },
          },
          select: {
            id: true,
            prestamoId: true,
            numeroCuota: true,
            montoTotal: true,
            montoCapital: true,
            montoInteres: true,
            montoMora: true,
            fechaPago: true,
            fechaVencimiento: true,
            metodoPago: true,
            estado: true,
            referencia: true,
            notas: true,
            createdAt: true,
          },
          orderBy: { fechaPago: 'desc' },
        })
      : []

    // Adjuntar el código del solicitud a cada pago para mostrarlo en la UI
    const prestamoCodigoMap = new Map(cliente.prestamos.map((p) => [p.id, p.codigo]))
    const pagos = pagosRaw.map((p) => ({
      ...p,
      prestamoCodigo: prestamoCodigoMap.get(p.prestamoId) || '—',
    }))

    // === Calcular comportamiento de pagos ===
    // Solo se consideran pagos APLICADO (no reversados ni anulados) para las
    // métricas de puntualidad y promedio.
    const pagosValidos = pagos.filter((p) => p.estado === 'APLICADO' && p.fechaPago && p.fechaVencimiento)

    const totalPagosAplicados = pagos.filter((p) => p.estado === 'APLICADO').length
    const totalPagado = pagos
      .filter((p) => p.estado === 'APLICADO')
      .reduce((sum, p) => sum + (p.montoTotal || 0), 0)
    const totalPrestado = cliente.prestamos
      .filter((p) => ['ACTIVO', 'EN_MORA', 'JURIDICO', 'CANCELADO'].includes(p.estado))
      .reduce((sum, p) => sum + (p.montoPrincipal || 0), 0)

    // Puntualidad: % de pagos aplicados en o antes de la fecha de vencimiento
    let pagosPuntuales = 0
    let pagosAtrasados = 0
    let sumaDiasAtraso = 0
    let maxDiasAtraso = 0
    for (const p of pagosValidos) {
      const diffMs = new Date(p.fechaPago!).getTime() - new Date(p.fechaVencimiento).getTime()
      const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (dias <= 0) {
        pagosPuntuales++
      } else {
        pagosAtrasados++
        sumaDiasAtraso += dias
        if (dias > maxDiasAtraso) maxDiasAtraso = dias
      }
    }
    const puntualidad = totalPagosAplicados > 0
      ? Math.round((pagosPuntuales / totalPagosAplicados) * 100)
      : 0
    const promedioDiasAtraso = pagosAtrasados > 0
      ? Math.round(sumaDiasAtraso / pagosAtrasados)
      : 0

    // Promedio de monto por pago
    const promedioMontoPago = totalPagosAplicados > 0
      ? Math.round(totalPagado / totalPagosAplicados)
      : 0

    // === Estado de mora actual del cliente ===
    const prestamosEnMora = cliente.prestamos.filter((p) => p.estado === 'EN_MORA')
    const prestamosJuridico = cliente.prestamos.filter((p) => p.estado === 'JURIDICO')
    const prestamosActivos = cliente.prestamos.filter((p) => ['ACTIVO', 'EN_MORA', 'JURIDICO'].includes(p.estado))
    const tieneMoraActiva = prestamosEnMora.length > 0 || prestamosJuridico.length > 0
    const saldoTotalActivos = prestamosActivos.reduce((sum, p) => sum + (p.saldoTotal || 0), 0)

    // === Distribución de solicitudes por estado ===
    const distribucionEstados = cliente.prestamos.reduce((acc, p) => {
      acc[p.estado] = (acc[p.estado] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // === Bitácora (eventos del cliente) ===
    // Combinamos:
    //   - BitácoraPrestamo (notas, llamadas, visitas, etc. de sus solicitudes)
    //   - AccesosPortal (logs de ingreso al portal)
    const bitacoraPrestamos = prestamoIds.length > 0
      ? await db.bitacoraPrestamo.findMany({
          where: { prestamoId: { in: prestamoIds } },
          select: {
            id: true,
            prestamoId: true,
            prestamoCodigo: true,
            usuarioNombre: true,
            tipo: true,
            titulo: true,
            descripcion: true,
            resultado: true,
            fechaEvento: true,
          },
          orderBy: { fechaEvento: 'desc' },
          take: 50,
        })
      : []

    const accesosPortal = await db.accesoPortal.findMany({
      where: { clienteId: id },
      select: {
        id: true,
        createdAt: true,
        ipOrigen: true,
        userAgent: true,
        exito: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // === Composición de la respuesta ===
    const respuesta = {
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        cedula: cliente.cedula,
        telefono: cliente.telefono,
        email: cliente.email,
        departamento: cliente.departamento,
        municipio: cliente.municipio,
        ciudad: cliente.ciudad,
        barrio: cliente.barrio,
        direccion: cliente.direccion,
        salario: cliente.salario,
        fechaIngreso: cliente.fechaIngreso,
        notas: cliente.notas,
        bancoCliente: cliente.bancoCliente,
        tipoCuentaCliente: cliente.tipoCuentaCliente,
        numeroCuentaCliente: cliente.numeroCuentaCliente,
        activo: cliente.activo,
        tieneTasaPersonalizada: cliente.tieneTasaPersonalizada,
        tasaPersonalizada: cliente.tasaPersonalizada,
        preferenciaNotificacion: cliente.preferenciaNotificacion,
        createdAt: cliente.createdAt,
        updatedAt: cliente.updatedAt,
        ultimoAccesoPortal: cliente.ultimoAccesoPortal,
      },
      referidoPor: cliente.referidoPor,
      referidos: cliente.referidos,
      categoria: cliente.categoria,
      cuentaRecaudo: cliente.cuentaRecaudo,
      documentosGestor: cliente.documentosGestor,
      fotos: cliente.documentosGestor, // alias para compatibilidad
      prestamos: cliente.prestamos,
      pagos,
      estadisticas: {
        totalPrestamos: cliente.prestamos.length,
        totalPrestado,
        totalPagado,
        totalPagosAplicados,
        promedioMontoPago,
        puntualidad,
        pagosPuntuales,
        pagosAtrasados,
        promedioDiasAtraso,
        maxDiasAtraso,
        prestamosActivos: prestamosActivos.length,
        prestamosEnMora: prestamosEnMora.length,
        prestamosJuridico: prestamosJuridico.length,
        saldoTotalActivos,
        tieneMoraActiva,
        distribucionEstados,
      },
      comportamiento: {
        puntualidad,
        promedioDiasAtraso,
        promedioMontoPago: formatearMoneda(promedioMontoPago),
        nivelRiesgo: tieneMoraActiva
          ? 'ALTO'
          : puntualidad < 50
            ? 'MEDIO'
            : 'BAJO',
        descripcion: tieneMoraActiva
          ? 'Cliente con mora activa en al menos un solicitud.'
          : puntualidad >= 80
            ? 'Cliente con excelente comportamiento de pagos.'
            : puntualidad >= 50
              ? 'Cliente con comportamiento aceptable, algunos atrasos.'
              : 'Cliente con historial de pagos irregulares.',
      },
      bitacora: {
        prestamosEventos: bitacoraPrestamos,
        accesosPortal,
      },
    }

    return NextResponse.json({ success: true, data: respuesta })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error).message },
      { status: 500 }
    )
  }
}
