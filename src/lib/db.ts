// =====================================================
// PRISMA CLIENT v3.0 — Jsadr
// SCHEMA_TAG fuerza regeneración del cliente cuando cambia el esquema
// =====================================================

import { PrismaClient } from '@prisma/client'

// ⚠️ Cambiar este valor cuando se actualice el schema y se quiera forzar
// la regeneración del cliente en caliente (dev server).
export const SCHEMA_TAG = 'juridico-portal-abogado-cedula-clave-v1'

// FIX-SEGURIDAD-CRITICA #10 (ALTO): AuditLog es inmutable.
// Prisma 6+ depreca $use en favor de $extends. Usamos client extensions
// para bloquear delete/update/deleteMany/updateMany sobre auditLog a nivel
// de cliente (cualquier caller que intente mutar un AuditLog recibirá un error).
//
// Nota: esto rompe limpiarLogsAntiguos() en security.ts (que hace deleteMany
// sobre auditLog para retención de 90 días). La inmutabilidad de audit logs
// tiene prioridad sobre la política de retención — si se necesita retención,
// implementar con TTL/soft-delete en una tabla separada.
const AUDITLOG_IMMUTABLE_MSG = 'AuditLog es inmutable: no se permite delete/update'

function createPrismaClient(): PrismaClient {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
  })
  // FIX-SEGURIDAD-CRITICA #10: bloquear mutaciones a AuditLog a nivel de cliente
  return base.$extends({
    query: {
      auditLog: {
        async delete() {
          throw new Error(AUDITLOG_IMMUTABLE_MSG)
        },
        async deleteMany() {
          throw new Error(AUDITLOG_IMMUTABLE_MSG)
        },
        async update() {
          throw new Error(AUDITLOG_IMMUTABLE_MSG)
        },
        async updateMany() {
          throw new Error(AUDITLOG_IMMUTABLE_MSG)
        },
      },
    },
  }) as unknown as PrismaClient
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __schemaTag?: string
}

// Si el tag cambió o no existe instancia, crear nuevo cliente
if (globalForPrisma.__schemaTag !== SCHEMA_TAG || !globalForPrisma.prisma) {
  globalForPrisma.prisma = createPrismaClient()
  globalForPrisma.__schemaTag = SCHEMA_TAG
}

export const db = globalForPrisma.prisma
