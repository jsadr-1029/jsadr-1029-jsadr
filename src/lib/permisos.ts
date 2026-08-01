// =====================================================
// PERMISOS POR ROL — JSADR Aurora Bancaria
// -----------------------------------------------------
// Matriz centralizada de permisos para vistas del frontend.
// Cada rol ve y puede navegar únicamente a las vistas aquí listadas.
// Cualquier vista NO listada para el rol se bloquea en page.tsx
// con un mensaje de "Acceso denegado".
//
// Matriz:
//   ADMIN     → acceso total (operación + sistema + configuración)
//   GESTOR    → operación diaria (préstamos, pagos, clientes, jurídico, cajas,
//               campañas, comunicaciones, buzones, portal, exportar, notif)
//   CONSULTOR → solo lectura (dashboard, préstamos, pagos, jurídico, portal,
//               comunicaciones, clientes en modo lectura)
//   ABOGADO   → NO usa este menú; ingresa por /juridico (portal aparte)
//   CLIENTE   → NO usa este menú; ingresa por /portal (modal aparte)
// =====================================================

import type { ViewKey } from '@/app/page'

export type Rol = 'ADMIN' | 'GESTOR' | 'CONSULTOR' | 'ABOGADO' | 'CLIENTE'

/**
 * Matriz de vistas permitidas por rol.
 * Modificar este mapa para cambiar los permisos de un rol.
 */
export const VISTAS_POR_ROL: Record<Rol, ViewKey[]> = {
  ADMIN: [
    'dashboard',
    'clientes',
    'prestamos',
    'pagos',
    'juridico',
    'cajas',
    'simulador',
    'campanas',
    'portal',
    'comunicaciones',
    'buzon-solicitudes',
    'usuarios',
    'conexiones',
    'seguridad',
    'auditoria',
    'notificaciones',
    'admin',
    'portal-admin',
    'configuracion',
    'exportar',
    'codigo-fuente',
    'manual',
    'automatizacion',
  ],

  GESTOR: [
    'dashboard',
    'clientes',
    'prestamos',
    'pagos',
    'juridico',
    'cajas',
    'simulador',
    'campanas',
    'portal',
    'comunicaciones',
    'buzon-solicitudes',
    'notificaciones',
    // 'exportar'  → Reportes: oculto para GESTOR (información sensible)
    // 'manual'    → Manual: oculto para GESTOR (información sensible)
  ],

  CONSULTOR: [
    'dashboard',
    'clientes',
    'prestamos',
    'pagos',
    'juridico',
    'portal',
    'comunicaciones',
    'exportar',
    'manual',
  ],

  // ABOGADO y CLIENTE no usan el Sidebar (usan portales propios)
  ABOGADO: [],
  CLIENTE: [],
}

/**
 * Verifica si un rol puede acceder a una vista.
 */
export function puedeAcceder(rol: string | undefined | null, view: ViewKey | string): boolean {
  if (!rol) return false
  const r = rol.toUpperCase() as Rol
  if (!(r in VISTAS_POR_ROL)) return false
  return (VISTAS_POR_ROL[r] as string[]).includes(view)
}

/**
 * Devuelve la lista de vistas permitidas para un rol.
 */
export function vistasPermitidas(rol: string | undefined | null): ViewKey[] {
  if (!rol) return []
  const r = rol.toUpperCase() as Rol
  return VISTAS_POR_ROL[r] || []
}

/**
 * Vista por defecto al iniciar sesión según rol.
 * (Cuándo el usuario entra a / sin ?view=...)
 */
export function vistaPorDefecto(rol: string | undefined | null): ViewKey {
  const permitidas = vistasPermitidas(rol)
  if (permitidas.length === 0) return 'prestamos'
  // Siempre preferir 'dashboard' si está permitido, sino la primera
  if (permitidas.includes('dashboard')) return 'dashboard'
  return permitidas[0]
}

/**
 * Etiquetas legibles para cada rol.
 */
export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  CONSULTOR: 'Consultor',
  ABOGADO: 'Abogado',
  CLIENTE: 'Cliente',
}

/**
 * Colores de gradiente Tailwind para el avatar de cada rol.
 */
export const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'from-fuchsia-500 to-purple-600',
  GESTOR: 'from-indigo-500 to-blue-600',
  CONSULTOR: 'from-cyan-500 to-teal-600',
  ABOGADO: 'from-amber-500 to-orange-600',
  CLIENTE: 'from-emerald-500 to-green-600',
}
