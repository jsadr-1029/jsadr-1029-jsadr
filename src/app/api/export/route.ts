import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { errorResponse, logError } from '@/lib/error-handler'

// GET - exportar TODA la base de datos (solo ADMIN)
export async function GET(req: NextRequest) {
  try {
    // v3.0: solo ADMIN puede exportar la BD completa
    const authResult = requireRole(req, ['ADMIN'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const formato = searchParams.get('formato') || 'json'

    const [
      clientes,
      prestamos,
      pagos,
      casosJuridicos,
      cronologia,
      documentos,
      alertas,
      notificaciones,
    ] = await Promise.all([
      // Reforzado: select explícito excluye pinHash, pinCreatedAt, pinIntentos,
      // pinBloqueadoHasta, ultimoAccesoPortal, tieneTasaPersonalizada,
      // tasaPersonalizada, tokenSesion, tokenExpira (campos sensibles)
      db.cliente.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5000, // Reforzado: límite anti-DoS
        select: {
          id: true,
          nombre: true,
          cedula: true,
          telefono: true,
          email: true,
          departamento: true,
          municipio: true,
          salario: true,
          fechaIngreso: true,
          direccion: true,
          ciudad: true,
          barrio: true,
          notas: true,
          bancoCliente: true,
          tipoCuentaCliente: true,
          numeroCuentaCliente: true,
          activo: true,
          referidoPorId: true,
          categoriaId: true,
          createdAt: true,
          updatedAt: true,
          referidoPor: {
            select: { id: true, nombre: true, cedula: true },
          },
        },
      }),
      // Reforzado: select explícito del cliente (sin pinHash ni tokenSesion)
      db.prestamo.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5000,
        include: {
          cliente: {
            select: { id: true, nombre: true, cedula: true, telefono: true, email: true },
          },
        },
      }),
      db.pago.findMany({
        orderBy: { fechaPago: 'desc' },
        take: 10000,
        include: {
          prestamo: {
            select: { id: true, codigo: true },
            include: {
              cliente: {
                select: { id: true, nombre: true, cedula: true },
              },
            },
          },
        },
      }),
      db.casoJuridico.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5000,
        include: {
          prestamo: {
            select: { id: true, codigo: true },
            include: {
              cliente: {
                select: { id: true, nombre: true, cedula: true },
              },
            },
          },
        },
      }),
      db.cronologiaCaso.findMany({
        orderBy: { fecha: 'desc' },
        take: 10000,
        include: {
          caso: {
            select: { id: true, estado: true },
            include: { prestamo: { select: { id: true, codigo: true } } },
          },
        },
      }),
      db.documentoLegal.findMany({
        orderBy: { fechaSubida: 'desc' },
        take: 5000,
        include: {
          caso: {
            select: { id: true, estado: true },
            include: { prestamo: { select: { id: true, codigo: true } } },
          },
        },
      }),
      db.alertaLegal.findMany({
        orderBy: { fechaAlerta: 'asc' },
        take: 5000,
        include: {
          caso: {
            select: { id: true, estado: true },
            include: { prestamo: { select: { id: true, codigo: true } } },
          },
        },
      }),
      db.notificacionLog.findMany({
        orderBy: { fechaEnvio: 'desc' },
        take: 10000,
        include: {
          prestamo: {
            select: { id: true, codigo: true },
            include: {
              cliente: {
                select: { id: true, nombre: true, cedula: true },
              },
            },
          },
        },
      }),
    ])

    const fechaExport = new Date().toISOString().split('T')[0]

    if (formato === 'csv') {
      // Generar CSV por cada entidad
      const csvSections: string[] = []

      // Clientes CSV
      csvSections.push('=== CLIENTES ===')
      csvSections.push('id,nombre,cedula,telefono,email,departamento,municipio,salario,direccion,activo,referidoPor,bancoCliente,tipoCuentaCliente,numeroCuentaCliente,createdAt')
      clientes.forEach((c) => {
        csvSections.push(
          `"${c.id}","${c.nombre}","${c.cedula}","${c.telefono}","${c.email || ''}","${c.departamento || ''}","${c.municipio || ''}",${c.salario || 0},"${c.direccion || ''}",${c.activo ? 'SI' : 'NO'},"${c.referidoPor?.nombre || ''}","${c.bancoCliente || ''}","${c.tipoCuentaCliente || ''}","${c.numeroCuentaCliente || ''}","${c.createdAt.toISOString()}"`
        )
      })

      // Préstamos CSV
      csvSections.push('\n=== PRESTAMOS ===')
      csvSections.push('codigo,cliente,cedula,montoPrincipal,tasaInteresAnual,tasaMoraAnual,plazoMeses,frecuencia,numeroCuotas,montoCuota,totalInteres,totalPagar,saldoTotal,cuotasPagadas,montoPagado,estado,fechaSolicitud,fechaDesembolso,fechaVencimiento')
      prestamos.forEach((p) => {
        csvSections.push(
          `"${p.codigo}","${p.cliente.nombre}","${p.cliente.cedula}",${p.montoPrincipal},${p.tasaInteresAnual},${p.tasaMoraDiaria},${p.plazoMeses},"${p.frecuencia}",${p.numeroCuotas},${p.montoCuota},${p.totalInteres},${p.totalPagar},${p.saldoTotal},${p.cuotasPagadas},${p.montoPagado},"${p.estado}","${p.fechaSolicitud.toISOString()}","${p.fechaDesembolso?.toISOString() || ''}","${p.fechaVencimiento?.toISOString() || ''}"`
        )
      })

      // Pagos CSV
      csvSections.push('\n=== PAGOS ===')
      csvSections.push('id,prestamoCodigo,cliente,numeroCuota,montoCapital,montoInteres,montoMora,montoTotal,fechaPago,fechaVencimiento,metodoPago,referencia,estado')
      pagos.forEach((p) => {
        csvSections.push(
          `"${p.id}","${p.prestamo.codigo}","${p.prestamo.cliente.nombre}",${p.numeroCuota},${p.montoCapital},${p.montoInteres},${p.montoMora},${p.montoTotal},"${p.fechaPago?.toISOString() || ''}","${p.fechaVencimiento.toISOString()}","${p.metodoPago}","${p.referencia || ''}","${p.estado}"`
        )
      })

      // Casos jurídicos
      csvSections.push('\n=== CASOS JURIDICOS ===')
      csvSections.push('id,prestamoCodigo,cliente,estado,abogadoNombre,abogadoTelefono,honorarios,juzgado,radicado,fechaApertura,fechaCierre')
      casosJuridicos.forEach((c) => {
        csvSections.push(
          `"${c.id}","${c.prestamo.codigo}","${c.prestamo.cliente.nombre}","${c.estado}","${c.abogadoNombre || ''}","${c.abogadoTelefono || ''}",${c.honorarios},"${c.juzgado || ''}","${c.radicado || ''}","${c.fechaApertura.toISOString()}","${c.fechaCierre?.toISOString() || ''}"`
        )
      })

      // Notificaciones
      csvSections.push('\n=== NOTIFICACIONES ===')
      csvSections.push('id,clienteTelefono,tipo,estado,fechaEnvio,mensaje')
      notificaciones.forEach((n) => {
        csvSections.push(
          `"${n.id}","${n.clienteTelefono}","${n.tipo}","${n.estado}","${n.fechaEnvio.toISOString()}","${(n.mensaje || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
        )
      })

      const csvContent = csvSections.join('\n')
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="exportacion_prestamos_${fechaExport}.csv"`,
        },
      })
    }

    // JSON completo
    const data = {
      metadata: {
        fechaExportacion: new Date().toISOString(),
        totalClientes: clientes.length,
        totalPrestamos: prestamos.length,
        totalPagos: pagos.length,
        totalCasosJuridicos: casosJuridicos.length,
        totalNotificaciones: notificaciones.length,
      },
      clientes,
      prestamos,
      pagos,
      casosJuridicos,
      cronologia,
      documentos,
      alertas,
      notificaciones,
    }

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="exportacion_prestamos_${fechaExport}.json"`,
      },
    })
  } catch (error: any) {
    logError('/api/export GET', error)
    return errorResponse('/api/export GET', error)
  }
}
