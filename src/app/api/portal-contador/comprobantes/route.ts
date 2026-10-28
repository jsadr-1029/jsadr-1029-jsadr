import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireContador,
  requireEmpresaId,
  sanitizeString,
  toNumber,
} from '@/lib/contador-auth'
import { sanitizeError } from '@/lib/error-handler'

// GET /api/portal-contador/comprobantes?empresaId=...&periodoId=...&estado=...&q=...
export async function GET(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth

    const empresaId = requireEmpresaId(req)
    if (empresaId instanceof NextResponse) return empresaId

    const { searchParams } = new URL(req.url)
    const periodoId = searchParams.get('periodoId') || undefined
    const estado = searchParams.get('estado') || undefined
    const tipo = searchParams.get('tipo') || undefined
    const q = searchParams.get('q') || undefined

    const where: any = { empresaId: empresaId as string }
    if (periodoId) where.periodoId = periodoId
    if (estado) where.estado = estado
    if (tipo) where.tipo = tipo
    if (q) {
      where.OR = [
        { numero: { contains: q, mode: 'insensitive' } },
        { concepto: { contains: q, mode: 'insensitive' } },
      ]
    }

    const comprobantes = await db.contComprobante.findMany({
      where,
      orderBy: { fechaContable: 'desc' },
      include: {
        periodo: { select: { anio: true, mes: true, estado: true } },
        _count: { select: { asientos: true } },
      },
      take: 200,
    })

    return NextResponse.json({ success: true, data: comprobantes })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}

// POST /api/portal-contador/comprobantes
// Crea un comprobante con sus asientos. REGLA CRÍTICA: débitos = créditos.
export async function POST(req: NextRequest) {
  try {
    const auth = requireContador(req)
    if (auth instanceof NextResponse) return auth
    const user = auth as any

    const body = await req.json().catch(() => ({}))
    const empresaId = requireEmpresaId(req, body)
    if (empresaId instanceof NextResponse) return empresaId
    const empId = empresaId as string

    const tipo = sanitizeString(body.tipo, 30)
    const concepto = sanitizeString(body.concepto, 300)
    const periodoId = sanitizeString(body.periodoId, 50)
    const asientosInput = Array.isArray(body.asientos) ? body.asientos : []

    if (!tipo || !concepto || !periodoId) {
      return NextResponse.json(
        { success: false, error: 'tipo, concepto y periodoId son obligatorios.' },
        { status: 400 }
      )
    }
    if (asientosInput.length === 0) {
      return NextResponse.json(
        { success: false, error: 'El comprobante debe tener al menos un asiento.' },
        { status: 400 }
      )
    }

    // Verificar que el período pertenece a la empresa y está ABIERTO/EN_CIERRE
    const periodo = await db.contPeriodo.findFirst({
      where: { id: periodoId, empresaId: empId },
    })
    if (!periodo) {
      return NextResponse.json(
        { success: false, error: 'El período no existe en esta empresa.' },
        { status: 404 }
      )
    }
    if (periodo.estado === 'CERRADO') {
      return NextResponse.json(
        { success: false, error: 'No se pueden crear comprobantes en un período CERRADO.' },
        { status: 400 }
      )
    }

    // Validar y normalizar asientos
    const asientos: Array<{
      cuentaId: string
      terceroId: string | null
      centroCosto: string | null
      debito: number
      credito: number
      descripcion: string | null
    }> = []
    let totalDebitos = 0
    let totalCreditos = 0

    for (let i = 0; i < asientosInput.length; i++) {
      const a = asientosInput[i] || {}
      const cuentaId = sanitizeString(a.cuentaId, 50)
      if (!cuentaId) {
        return NextResponse.json(
          { success: false, error: `Asiento ${i + 1}: cuentaId es obligatorio.` },
          { status: 400 }
        )
      }
      // Verificar que la cuenta existe en la empresa y está ACTIVA
      const cuenta = await db.contCuentaPUC.findFirst({
        where: { id: cuentaId, empresaId: empId },
      })
      if (!cuenta) {
        return NextResponse.json(
          { success: false, error: `Asiento ${i + 1}: la cuenta no existe en esta empresa.` },
          { status: 400 }
        )
      }
      if (cuenta.estado === 'INACTIVA') {
        return NextResponse.json(
          { success: false, error: `Asiento ${i + 1}: la cuenta ${cuenta.codigo} está INACTIVA.` },
          { status: 400 }
        )
      }
      const debito = toNumber(a.debito, 0)
      const credito = toNumber(a.credito, 0)
      if (debito < 0 || credito < 0) {
        return NextResponse.json(
          { success: false, error: `Asiento ${i + 1}: débito y crédito no pueden ser negativos.` },
          { status: 400 }
        )
      }
      if (debito === 0 && credito === 0) {
        return NextResponse.json(
          { success: false, error: `Asiento ${i + 1}: débito o crédito debe ser mayor que cero.` },
          { status: 400 }
        )
      }
      if (debito > 0 && credito > 0) {
        return NextResponse.json(
          { success: false, error: `Asiento ${i + 1}: no puede tener débito y crédito simultáneamente.` },
          { status: 400 }
        )
      }
      totalDebitos += debito
      totalCreditos += credito
      asientos.push({
        cuentaId,
        terceroId: sanitizeString(a.terceroId, 50) || null,
        centroCosto: sanitizeString(a.centroCosto, 50) || null,
        debito,
        credito,
        descripcion: sanitizeString(a.descripcion, 300) || null,
      })
    }

    // === REGLA CRÍTICA: débitos === créditos (con tolerancia de 1 centavo) ===
    const diff = Math.abs(totalDebitos - totalCreditos)
    if (diff > 0.01) {
      return NextResponse.json(
        {
          success: false,
          error: `El comprobante está descuadrado. Débitos=${totalDebitos.toFixed(2)} Créditos=${totalCreditos.toFixed(2)}. La diferencia debe ser cero.`,
          code: 'COMPROBANTE_DESCUADRADO',
          totalDebitos,
          totalCreditos,
          diferencia: diff,
        },
        { status: 400 }
      )
    }

    // Generar número de comprobante: CBTE-{year}-{seq}
    const anio = new Date().getFullYear()
    const prefix = `CBTE-${anio}-`
    const ultimo = await db.contComprobante.findFirst({
      where: { empresaId: empId, numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
    })
    let seq = 1
    if (ultimo && ultimo.numero) {
      const parts = ultimo.numero.split('-')
      const n = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(n)) seq = n + 1
    }
    const numero = `${prefix}${String(seq).padStart(5, '0')}`

    // Fechas
    const fechaContable = body.fechaContable ? new Date(body.fechaContable) : new Date()
    const fechaDocumento = body.fechaDocumento ? new Date(body.fechaDocumento) : fechaContable
    if (isNaN(fechaContable.getTime())) {
      return NextResponse.json(
        { success: false, error: 'fechaContable inválida.' },
        { status: 400 }
      )
    }

    // Crear comprobante + asientos en transacción
    const comprobante = await db.$transaction(async (tx) => {
      const cbte = await tx.contComprobante.create({
        data: {
          empresaId: empId,
          periodoId,
          numero,
          tipo,
          fechaDocumento,
          fechaContable,
          concepto,
          descripcion: sanitizeString(body.descripcion, 500) || null,
          totalDebitos,
          totalCreditos,
          estado: 'BORRADOR',
          creadoPorId: user.id,
          creadoPorNombre: user.nombre,
        },
      })
      await tx.contAsiento.createMany({
        data: asientos.map((a) => ({
          comprobanteId: cbte.id,
          cuentaId: a.cuentaId,
          terceroId: a.terceroId,
          centroCosto: a.centroCosto,
          debito: a.debito,
          credito: a.credito,
          descripcion: a.descripcion,
        })),
      })
      // Actualizar saldos de cuentas
      for (const a of asientos) {
        const cuenta = await tx.contCuentaPUC.findUnique({ where: { id: a.cuentaId } })
        if (cuenta) {
          const nuevoSaldo =
            cuenta.naturaleza === 'DEBITO'
              ? cuenta.saldo + a.debito - a.credito
              : cuenta.saldo + a.credito - a.debito
          await tx.contCuentaPUC.update({
            where: { id: a.cuentaId },
            data: { saldo: nuevoSaldo },
          })
        }
      }
      return cbte
    })

    const comprobanteFull = await db.contComprobante.findUnique({
      where: { id: comprobante.id },
      include: { asientos: { include: { cuenta: true } }, periodo: true },
    })

    return NextResponse.json({ success: true, data: comprobanteFull }, { status: 201 })
  } catch (error) {
    const safe = sanitizeError(error)
    return NextResponse.json(
      { success: false, error: safe.message, code: safe.code },
      { status: safe.httpStatus }
    )
  }
}
