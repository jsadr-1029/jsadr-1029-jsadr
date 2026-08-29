import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handler'
import { requireRole } from '@/lib/auth-guard'

// =====================================================
// /api/pagos/export v4.0 — OLA 2
// Exporta pagos a CSV.
// =====================================================

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCSV(rows: any[], headers: { key: string; label: string }[]): string {
  const head = headers.map((h) => escapeCSV(h.label)).join(',')
  const body = rows.map((row) =>
    headers.map((h) => escapeCSV(row[h.key])).join(',')
  ).join('\n')
  return head + '\n' + body
}

export async function GET(req: NextRequest) {
  try {
    const authResult = requireRole(req, ['ADMIN', 'GESTOR', 'CONSULTOR'])
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo') || 'hoy'
    const fecha = searchParams.get('fecha')
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')

    let where: any = { estado: { not: 'ANULADO' } }
    let filename = 'pagos'

    if (tipo === 'hoy' || tipo === 'rango') {
      if (tipo === 'hoy') {
        const f = fecha ? new Date(fecha) : new Date()
        const inicio = new Date(f); inicio.setHours(0, 0, 0, 0)
        const fin = new Date(f); fin.setHours(23, 59, 59, 999)
        where.fechaPago = { gte: inicio, lte: fin }
        filename = `pagos_hoy_${inicio.toISOString().slice(0, 10)}`
      } else {
        const inicio = new Date(desde || new Date())
        inicio.setHours(0, 0, 0, 0)
        const fin = new Date(hasta || new Date())
        fin.setHours(23, 59, 59, 999)
        where.fechaPago = { gte: inicio, lte: fin }
        filename = `pagos_${inicio.toISOString().slice(0, 10)}_a_${fin.toISOString().slice(0, 10)}`
      }
    } else if (tipo === 'informe') {
      const periodo = searchParams.get('periodo') || 'mes'
      const hoy = new Date()
      let inicio: Date, fin: Date
      if (periodo === 'semana') {
        const diaSemana = hoy.getDay()
        const diff = diaSemana === 0 ? 6 : diaSemana - 1
        inicio = new Date(hoy); inicio.setDate(hoy.getDate() - diff); inicio.setHours(0, 0, 0, 0)
        fin = new Date(inicio); fin.setDate(inicio.getDate() + 6); fin.setHours(23, 59, 59, 999)
      } else if (periodo === 'quincena') {
        if (hoy.getDate() <= 15) {
          inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
          fin = new Date(hoy.getFullYear(), hoy.getMonth(), 15, 23, 59, 59, 999)
        } else {
          inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 16)
          fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999)
        }
      } else if (periodo === 'año') {
        inicio = new Date(hoy.getFullYear(), 0, 1)
        fin = new Date(hoy.getFullYear(), 11, 31, 23, 59, 59, 999)
      } else {
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999)
      }
      where.fechaPago = { gte: inicio, lte: fin }
      filename = `informe_pagos_${periodo}_${hoy.getFullYear()}`
    }

    const pagos = await db.pago.findMany({
      where,
      include: {
        prestamo: { include: { cliente: true } },
        cuentaRecaudo: true,
      },
      orderBy: { fechaPago: 'desc' },
    })

    const rows = pagos.map((p) => ({
      codigo: p.codigo || '—',
      fecha: p.fechaPago ? new Date(p.fechaPago).toLocaleString('es-CO') : '—',
      prestamo: p.prestamo.codigo,
      cliente: p.prestamo.cliente.nombre,
      cedula: p.prestamo.cliente.cedula,
      telefono: p.prestamo.cliente.telefono,
      cuota: p.numeroCuota,
      capital: p.montoCapital,
      interes: p.montoInteres,
      mora: p.montoMora,
      total: p.montoTotal,
      metodo: p.metodoPago,
      referencia: p.referencia || '',
      cuenta: p.cuentaRecaudo?.codigo || '',
      estado: p.estado,
      esSoloIntereses: p.esSoloIntereses ? 'SÍ' : 'NO',
      notas: p.notas || '',
    }))

    const headers = [
      { key: 'codigo', label: 'Código' },
      { key: 'fecha', label: 'Fecha pago' },
      { key: 'prestamo', label: 'Solicitud' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'cedula', label: 'Cédula' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'cuota', label: 'Cuota #' },
      { key: 'capital', label: 'Capital' },
      { key: 'interes', label: 'Interés' },
      { key: 'mora', label: 'Mora' },
      { key: 'total', label: 'Total' },
      { key: 'metodo', label: 'Método' },
      { key: 'referencia', label: 'Referencia' },
      { key: 'cuenta', label: 'Cuenta recaudo' },
      { key: 'estado', label: 'Estado' },
      { key: 'esSoloIntereses', label: 'Solo intereses' },
      { key: 'notas', label: 'Notas' },
    ]

    const csv = toCSV(rows, headers)
    const csvWithBom = '\uFEFF' + csv

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error).message }, { status: 500 })
  }
}
