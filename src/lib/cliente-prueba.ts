// =====================================================
// src/lib/cliente-prueba.ts
// =====================================================
// Lógica centralizada para gestionar clientes de prueba.
//
// Un "cliente de prueba" es un cliente marcado con `esPrueba=true` en la BD.
// El cliente puede hacer TODO el proceso (simular, solicitar, firmar T&C,
// pagar, generar documentos, etc.) como si fuera real, pero sus cifras
// NO se contabilizan en los saldos reales del sistema.
//
// Esto permite que el cliente con cédula 1214731649 (JOHAN SEBASTIAN ALVAREZ
// DEL RIO) —usado para QA, demostraciones y pruebas end-to-end— no contamine
// los reportes financieros reales del sistema.
//
// USO:
//   import { excluirPruebaCliente, excluirPruebaPrestamo, esClientePruebaPorCedula } from '@/lib/cliente-prueba'
//
//   // En consultas de Cliente:
//   db.cliente.findMany({ where: { ...excluirPruebaCliente() } })
//
//   // En consultas de Préstamo:
//   db.prestamo.findMany({ where: { estado: 'ACTIVO', ...excluirPruebaPrestamo() } })
//
//   // En consultas de Pago:
//   db.pago.findMany({ where: { estado: 'APLICADO', prestamo: excluirPruebaPrestamo() } })
// =====================================================

import { db } from '@/lib/db'

/**
 * Cédula canónica del cliente de prueba principal del sistema.
 * JOHAN SEBASTIAN ALVAREZ DEL RIO.
 * Este cliente se usa para QA, demostraciones y pruebas end-to-end.
 */
export const CEDULA_CLIENTE_PRUEBA = '1214731649'

/**
 * Lista de cédulas que el sistema SIEMPRE trata como clientes de prueba,
 * incluso si el flag esPrueba no está marcado en la BD (defensa en profundidad).
 * Útil cuando la BD acaba de migrarse y el flag aún no se ha aplicado.
 */
export const CEDULAS_PRUEBA_HARDCODED: string[] = [
  CEDULA_CLIENTE_PRUEBA,
]

/**
 * Verifica si una cédula corresponde a un cliente de prueba,
 * usando la lista hardcodeada (no requiere acceso a BD).
 */
export function esClientePruebaPorCedula(cedula: string | null | undefined): boolean {
  if (!cedula) return false
  return CEDULAS_PRUEBA_HARDCODED.includes(String(cedula).trim())
}

/**
 * Verifica si un cliente es de prueba consultando la BD (más confiable).
 * Cachea el resultado por 60 segundos para evitar consultas repetidas.
 */
const cacheClientePrueba = new Map<string, { esPrueba: boolean; expira: number }>()
const CACHE_TTL_MS = 60_000

export async function esClientePruebaById(clienteId: string): Promise<boolean> {
  // Primero revisa el cache
  const cached = cacheClientePrueba.get(clienteId)
  if (cached && cached.expira > Date.now()) {
    return cached.esPrueba
  }

  try {
    const cliente = await db.cliente.findUnique({
      where: { id: clienteId },
      select: { cedula: true, esPrueba: true },
    })
    if (!cliente) return false

    const esPrueba = cliente.esPrueba || esClientePruebaPorCedula(cliente.cedula)
    cacheClientePrueba.set(clienteId, { esPrueba, expira: Date.now() + CACHE_TTL_MS })
    return esPrueba
  } catch {
    // Si la consulta falla (por ejemplo, campo esPrueba no existe aún en BD),
    // hace fallback a la verificación por cédula hardcodeada.
    try {
      const cliente = await db.cliente.findUnique({
        where: { id: clienteId },
        select: { cedula: true },
      })
      if (!cliente) return false
      return esClientePruebaPorCedula(cliente.cedula)
    } catch {
      return false
    }
  }
}

/**
 * Filtro Prisma para EXCLUIR clientes de prueba de una consulta sobre Cliente.
 *
 * Uso:
 *   db.cliente.findMany({ where: { activo: true, ...excluirPruebaCliente() } })
 *
 * También funciona en queries anidadas:
 *   db.prestamo.findMany({ where: { cliente: excluirPruebaCliente() } })
 */
export function excluirPruebaCliente() {
  return {
    AND: [
      { esPrueba: false },
      { cedula: { notIn: CEDULAS_PRUEBA_HARDCODED } },
    ],
  }
}

/**
 * Filtro Prisma para EXCLUIR préstamos de clientes de prueba de una consulta sobre Préstamo.
 *
 * Uso:
 *   db.prestamo.findMany({ where: { estado: 'ACTIVO', ...excluirPruebaPrestamo() } })
 *
 * Esto filtra por:
 *   - cliente.esPrueba = false
 *   - cliente.cedula NOT IN (lista hardcodeada)
 */
export function excluirPruebaPrestamo() {
  return {
    cliente: {
      AND: [
        { esPrueba: false },
        { cedula: { notIn: CEDULAS_PRUEBA_HARDCODED } },
      ],
    },
  }
}

/**
 * Filtro Prisma para EXCLUIR pagos de clientes de prueba de una consulta sobre Pago.
 *
 * Uso:
 *   db.pago.findMany({ where: { estado: 'APLICADO', ...excluirPruebaPago() } })
 */
export function excluirPruebaPago() {
  return {
    prestamo: {
      cliente: {
        AND: [
          { esPrueba: false },
          { cedula: { notIn: CEDULAS_PRUEBA_HARDCODED } },
        ],
      },
    },
  }
}

/**
 * Devuelve la lista de IDs de clientes de prueba activos (consultando la BD).
 * Útil para filtros dinámicos o para reportes que necesitan separar cifras reales
 * de las de prueba.
 */
export async function getIdsClientesPrueba(): Promise<string[]> {
  try {
    const clientes = await db.cliente.findMany({
      where: {
        OR: [
          { esPrueba: true },
          { cedula: { in: CEDULAS_PRUEBA_HARDCODED } },
        ],
      },
      select: { id: true },
    })
    return clientes.map((c) => c.id)
  } catch {
    // Fallback si el campo esPrueba aún no existe en BD
    const clientes = await db.cliente.findMany({
      where: { cedula: { in: CEDULAS_PRUEBA_HARDCODED } },
      select: { id: true },
    })
    return clientes.map((c) => c.id)
  }
}

/**
 * Marca un cliente como cliente de prueba.
 */
export async function marcarComoPrueba(
  clienteId: string,
  marcadoPorId?: string,
  motivo?: string
): Promise<void> {
  try {
    await db.cliente.update({
      where: { id: clienteId },
      data: {
        esPrueba: true,
        fechaMarcadoPrueba: new Date(),
        marcadoPruebaPorId: marcadoPorId || null,
        motivoPrueba: motivo || 'Marcado como cliente de prueba',
      },
    })
    // Invalidar cache
    cacheClientePrueba.delete(clienteId)
  } catch (error) {
    // Si el campo esPrueba no existe, intenta sin los campos nuevos (solo cedula)
    console.warn('[cliente-prueba] No se pudo marcar como prueba en BD, el cliente será reconocido por cédula hardcodeada:', error)
    throw error
  }
}

/**
 * Desmarca un cliente como cliente de prueba.
 * Solo funciona si la cédula NO está en la lista hardcodeada.
 */
export async function desmarcarComoPrueba(clienteId: string): Promise<void> {
  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { cedula: true },
  })
  if (!cliente) throw new Error('Cliente no encontrado')

  if (esClientePruebaPorCedula(cliente.cedula)) {
    throw new Error(
      `No se puede desmarcar como prueba: la cédula ${cliente.cedula} está en la lista hardcodeada de clientes de prueba del sistema.`
    )
  }

  await db.cliente.update({
    where: { id: clienteId },
    data: {
      esPrueba: false,
      fechaMarcadoPrueba: null,
      marcadoPruebaPorId: null,
      motivoPrueba: null,
    },
  })
  cacheClientePrueba.delete(clienteId)
}

/**
 * Invalida el cache de un cliente específico (útil tras actualizaciones manuales).
 */
export function invalidarCacheCliente(clienteId: string) {
  cacheClientePrueba.delete(clienteId)
}

/**
 * Invalida todo el cache de clientes de prueba.
 */
export function invalidarCacheCompleto() {
  cacheClientePrueba.clear()
}
