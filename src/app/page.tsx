'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Sidebar } from '@/components/Sidebar'
import { RelojColombia } from '@/components/RelojColombia'
import { ResponsiveViewToggle } from '@/components/ResponsiveViewToggle'
import { MobileNav } from '@/components/mobile-nav'
import { InactivityAutoLogout } from '@/components/InactivityAutoLogout'
import { useToast } from '@/hooks/use-toast'
import { isAuthenticated, getUserData, logout } from '@/lib/api-client'
import { puedeAcceder, vistasPermitidas, vistaPorDefecto, puedeAccederUsuario, vistasPermitidasUsuario } from '@/lib/permisos'
import { useAuthReactive } from '@/hooks/use-auth-reactive'
import { useResponsiveView } from '@/hooks/use-responsive-view'
import { cn } from '@/lib/utils'
import { ShieldAlert } from 'lucide-react'

// ====================================================================
// CODE-SPLITTING (RCA 2026-08-04):
// Antes las 34 vistas se importaban estáticamente al compilar `/`,
// lo que inflaba el heap de Node a >614MB y disparaba el auto-restart
// de Next.js 16 (RESTART_EXIT_CODE=77 cuando used_heap_size > 0.8 * heap_size_limit).
// Con next/dynamic, cada vista se carga en su propio chunk y solo se
// transpila cuando se accede a ella. El primer compile baja de ~600MB a ~150MB.
// ====================================================================
const DashboardView = dynamic(() => import('@/components/views/DashboardView').then(m => ({ default: m.DashboardView })), { ssr: false })
const ClientesView = dynamic(() => import('@/components/views/ClientesView').then(m => ({ default: m.ClientesView })), { ssr: false })
const PrestamosView = dynamic(() => import('@/components/views/PrestamosView').then(m => ({ default: m.PrestamosView })), { ssr: false })
const PagosView = dynamic(() => import('@/components/views/PagosView').then(m => ({ default: m.PagosView })), { ssr: false })
const JuridicoView = dynamic(() => import('@/components/views/JuridicoView').then(m => ({ default: m.JuridicoView })), { ssr: false })
const ExportarView = dynamic(() => import('@/components/views/ExportarView').then(m => ({ default: m.ExportarView })), { ssr: false })
const ManualView = dynamic(() => import('@/components/views/ManualView').then(m => ({ default: m.ManualView })), { ssr: false })
const NotificacionesView = dynamic(() => import('@/components/views/NotificacionesView').then(m => ({ default: m.NotificacionesView })), { ssr: false })
const PrestamoDetalleModal = dynamic(() => import('@/components/views/PrestamoDetalleModal').then(m => ({ default: m.PrestamoDetalleModal })), { ssr: false })
const CajasView = dynamic(() => import('@/components/views/CajasView').then(m => ({ default: m.CajasView })), { ssr: false })
const SimuladorView = dynamic(() => import('@/components/views/SimuladorView').then(m => ({ default: m.SimuladorView })), { ssr: false })
const CampanasView = dynamic(() => import('@/components/views/CampanasView').then(m => ({ default: m.CampanasView })), { ssr: false })
const PortalView = dynamic(() => import('@/components/views/PortalView').then(m => ({ default: m.PortalView })), { ssr: false })
const AdminView = dynamic(() => import('@/components/views/AdminView').then(m => ({ default: m.AdminView })), { ssr: false })
const PortalClienteModal = dynamic(() => import('@/components/views/PortalClienteModal').then(m => ({ default: m.PortalClienteModal })), { ssr: false })
const UsuariosView = dynamic(() => import('@/components/views/UsuariosView').then(m => ({ default: m.UsuariosView })), { ssr: false })
const ConexionesView = dynamic(() => import('@/components/views/ConexionesView').then(m => ({ default: m.ConexionesView })), { ssr: false })
const SeguridadView = dynamic(() => import('@/components/views/SeguridadView').then(m => ({ default: m.SeguridadView })), { ssr: false })
const CodigoFuenteView = dynamic(() => import('@/components/views/CodigoFuenteView').then(m => ({ default: m.CodigoFuenteView })), { ssr: false })
const AutomatizacionView = dynamic(() => import('@/components/views/AutomatizacionView').then(m => ({ default: m.AutomatizacionView })), { ssr: false })
const AuditoriaSeguridadView = dynamic(() => import('@/components/views/AuditoriaSeguridadView').then(m => ({ default: m.AuditoriaSeguridadView })), { ssr: false })
const CentroComunicacionesView = dynamic(() => import('@/components/views/CentroComunicacionesView').then(m => ({ default: m.CentroComunicacionesView })), { ssr: false })
const CentroConfiguracionView = dynamic(() => import('@/components/views/CentroConfiguracionView').then(m => ({ default: m.CentroConfiguracionView })), { ssr: false })
const BuzonSolicitudesView = dynamic(() => import('@/components/views/BuzonSolicitudesView').then(m => ({ default: m.BuzonSolicitudesView })), { ssr: false })
const PortalAdminView = dynamic(() => import('@/components/views/PortalAdminView').then(m => ({ default: m.PortalAdminView })), { ssr: false })

export type ViewKey =
  | 'dashboard'
  | 'clientes'
  | 'prestamos'
  | 'pagos'
  | 'juridico'
  | 'cajas'
  | 'simulador'
  | 'campanas'
  | 'portal'
  | 'comunicaciones'
  | 'usuarios'
  | 'conexiones'
  | 'seguridad'
  | 'auditoria'
  | 'notificaciones'
  | 'admin'
  | 'portal-admin'
  | 'configuracion'
  | 'exportar'
  | 'codigo-fuente'
  | 'manual'
  | 'automatizacion'
  | 'buzon-solicitudes'

export default function Home() {
  const [view, setView] = useState<ViewKey>('prestamos')
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<string | null>(null)
  const [portalCedula, setPortalCedula] = useState<string | null>(null)
  const [portalToken, setPortalToken] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  // === Solicitud web pendiente de convertir en préstamo ===
  // Cuando el usuario hace clic en "Préstamo" desde el Buzón de Solicitudes
  // (vista 'buzon-solicitudes' montada directamente en page.tsx), capturamos
  // la solicitud aquí y la inyectamos en PrestamosView al cambiar de vista.
  // PrestamosView la procesa en un useEffect, abre el modal de creación
  // precargado y nos avisa para limpiar el estado vía onSolicitudConsumida.
  const [solicitudPendiente, setSolicitudPendiente] = useState<any | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  // Hook reactivo: cuando el rol cambia (switch-user, refresh, login),
  // re-validamos que la vista actual esté permitida.
  const { rol: reactiveRol } = useAuthReactive()
  // Datos del usuario actual (para verificar bloqueo por portal dedicado, ej: P_jsadr)
  const user = getUserData()

  // Modo de vista responsiva preferido por el usuario (Auto/Móvil/Tablet/PC).
  // Solo aplica a usuarios internos (ADMIN/GESTOR/CONSULTOR); el portal
  // cliente y el portal jurídico NO se ven afectados por esta preferencia.
  const { mode: responsiveMode } = useResponsiveView()

  // === GUARDIA DE AUTENTICACIÓN ===
  // Si no está autenticado, redirigir a /login preservando el query string.
  // FIX-LINK-CLIENTE: antes se hacía router.replace('/login') a secas, lo que
  // perdía los parámetros ?tyc=token / ?pay=codigo / ?recibo=hash que vienen
  // en los links enviados al cliente por WhatsApp. Tras el login, el cliente
  // quedaba en el dashboard sin poder aceptar T&C ni pagar.
  // Ahora guardamos el query string en sessionStorage para que /login pueda
  // redirigir de vuelta a la URL original post-login.
  const [authChecked, setAuthChecked] = useState(false)
  const [esPortalCliente, setEsPortalCliente] = useState(false)

  // === Propagar responsiveMode al <html> ===
  // Necesario para que el CSS en globals.css (reglas responsivas admin) pueda
  // alcanzar elementos renderizados fuera del div data-responsive-mode,
  // incluyendo:
  //   - Modales (Radix UI Dialog/Sheet usan createPortal → al final del <body>)
  //   - Tooltips, popovers, dropdowns
  //   - Notificaciones (toast)
  // Sin esto, los modales en móvil heredarían el layout desktop y se verían
  // cortados o con tablas/grid no responsivos.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (esPortalCliente) {
      document.documentElement.removeAttribute('data-responsive-mode')
    } else {
      document.documentElement.setAttribute('data-responsive-mode', responsiveMode)
    }
  }, [responsiveMode, esPortalCliente])

  useEffect(() => {
    // === Timeout de seguridad ===
    // Si por cualquier motivo el flujo de auth queda bloqueado (token corrupto,
    // localStorage inaccesible, excepción silenciosa, etc.), forzamos el
    // redireccionamiento a /login después de 5 segundos. Evita el bug
    // "Verificando sesión..." colgado indefinidamente.
    const safetyTimeout = setTimeout(() => {
      setAuthChecked(true)
      if (!isAuthenticated()) {
        try {
          const qs = window.location.search || ''
          if (qs && (qs.includes('tyc=') || qs.includes('pay=') || qs.includes('recibo=') || qs.includes('firma='))) {
            sessionStorage.setItem('pending_redirect', `${window.location.pathname}${qs}`)
          }
        } catch {}
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    }, 5000)

    try {
      if (!isAuthenticated()) {
        try {
          const qs = window.location.search || ''
          if (qs && (qs.includes('tyc=') || qs.includes('pay=') || qs.includes('recibo=') || qs.includes('firma='))) {
            sessionStorage.setItem('pending_redirect', `${window.location.pathname}${qs}`)
          }
        } catch {}
        router.replace('/login')
        clearTimeout(safetyTimeout)
        return
      }
      // Si el usuario inició sesión como CLIENTE, abrir su portal directamente
      const u = getUserData()
      if (u?.rol === 'CLIENTE' || u?.esPortalCliente) {
        setEsPortalCliente(true)
        // Precargar cédula/token del localStorage (seteados por el login de cliente).
        // FIX-LOGIN-LOOP: antes se usaba `portal_cliente_id` como cédula, pero
        // ese valor contiene el ID interno del cliente (p.ej. "cmrskum2..."),
        // no la cédula. El endpoint /api/portal/[cedula] espera una cédula, así
        // que devolvía 404 y el portal quedaba cargando indefinidamente.
        // Usamos u.username (que en el login de cliente se setea a la cédula)
        // o u.cedula si está disponible.
        try {
          const tk = localStorage.getItem('portal_cliente_token')
          const cedula = u.cedula || u.username || localStorage.getItem('portal_cliente_cedula')
          if (cedula) setPortalCedula(cedula)
          if (tk) setPortalToken(tk)
        } catch {}
        setView('portal')
      } else {
        // Si es usuario interno (ADMIN/GESTOR/CONSULTOR), validar que la
        // vista inicial esté permitida para su rol/usuario. Si no, ir a la vista
        // por defecto.
        // Considera el bloqueo por usuario (P_jsadr → solo 'portal-admin').
        const permitidas = vistasPermitidasUsuario(u?.username, u?.rol || reactiveRol)
        if (permitidas.length > 0 && !permitidas.includes('prestamos' as ViewKey)) {
          // Si el usuario está bloqueado a un portal específico, ir a ese portal
          const vistaBloqueada = permitidas.length === 1 ? permitidas[0] : null
          if (vistaBloqueada) {
            setView(vistaBloqueada)
          } else {
            setView(vistaPorDefecto(u?.rol || reactiveRol))
          }
        }
      }
      setAuthChecked(true)
      clearTimeout(safetyTimeout)
    } catch (err) {
      // Si ocurre cualquier excepción durante el check, limpiar auth y
      // redirigir a login para evitar pantalla en blanco.
      clearTimeout(safetyTimeout)
      try {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user_data')
      } catch {}
      setAuthChecked(true)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
  }, [router, reactiveRol])

  // === GUARDIA DE PERMISOS POR VISTA ===
  // Si el rol actual no tiene permiso para la vista activa, mostrar
  // un mensaje de "Acceso denegado" en lugar de renderizar el módulo.
  // Esto bloquea el acceso directo por URL (?view=usuarios) a roles no
  // autorizados, incluso si el Sidebar no muestra el ítem.
  //
  // Además, considera el bloqueo por usuario: P_jsadr solo puede ver 'portal-admin'
  // aunque su rol GESTOR permita otros módulos. Esto implementa la restricción de
  // chat: P_jsadr y Jd_jsadr solo interactúan con el admin principal vía su portal.
  const vistaPermitida = esPortalCliente
    ? view === 'portal'
    : puedeAccederUsuario(user?.username, reactiveRol, view)

  // Detectar query params para portal cliente (?tyc=token o ?pay=codigo o ?portal=cliente)
  // y para redirección post-login (?view=portal-admin para P_jsadr)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tyc = params.get('tyc')
    const pay = params.get('pay')
    const portalCliente = params.get('portal')
    const viewParam = params.get('view')
    if (tyc || pay) {
      // Mostrar portal cliente con el token/pendiente
      setView('portal')
    } else if (portalCliente === 'cliente') {
      // Login desde el perfil Cliente: llevar directo a la vista Portal
      setView('portal')
    } else if (viewParam) {
      // === REDIRECCIÓN DE SUBMÓDULOS DE SEGURIDAD ===
      // Las vistas 'conexiones', 'usuarios', 'codigo-fuente', 'manual',
      // 'auditoria' y 'exportar' ahora son pestañas internas de SeguridadView.
      // Si alguien accede por URL directa (ej: ?view=exportar), lo redirigimos
      // a la vista 'seguridad' (donde verá la pestaña correspondiente).
      const SUBMODULOS_SEGURIDAD = ['conexiones', 'usuarios', 'codigo-fuente', 'manual', 'auditoria', 'exportar']
      if (SUBMODULOS_SEGURIDAD.includes(viewParam)) {
        const u = getUserData()
        // Solo redirigir si tiene permiso para 'seguridad'
        if (u && puedeAccederUsuario(u.username, u.rol, 'seguridad')) {
          setView('seguridad' as ViewKey)
          return
        }
      }

      // Redirección post-login (ej: ?view=portal-admin para P_jsadr)
      // Solo aplicar si la vista está permitida para el rol/usuario.
      const u = getUserData()
      if (u && puedeAccederUsuario(u.username, u.rol, viewParam)) {
        setView(viewParam as ViewKey)
      }
    }
  }, [])

  // Escuchar evento global 'abrir-prestamo' despachado por vistas anidadas
  // (por ejemplo, ReportesUnificadoView dentro de AdminView).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.id) {
        setPrestamoSeleccionado(detail.id)
      }
    }
    window.addEventListener('abrir-prestamo', handler as EventListener)
    return () => window.removeEventListener('abrir-prestamo', handler as EventListener)
  }, [])

  const abrirPrestamo = (id: string) => setPrestamoSeleccionado(id)
  const abrirPortal = (cedula: string, token?: string) => {
    setPortalCedula(cedula)
    setPortalToken(token || null)
  }
  const refresh = () => setRefreshKey((k) => k + 1)

  // Convertir una solicitud web en préstamo: captura la solicitud en el
  // estado `solicitudPendiente` y cambia a la vista 'prestamos'. Allí,
  // PrestamosView detecta el cambio vía useEffect, precarga el formulario
  // con los datos de la solicitud (cliente, monto, tasa, cuotas, frecuencia,
  // flexibilidad, renovación anticipada) y abre el modal de creación.
  // Una vez procesada, PrestamosView nos avisa vía onSolicitudConsumida
  // para limpiar el estado y evitar re-procesamientos.
  const convertirSolicitudWeb = (solicitud: any) => {
    if (!solicitud) {
      setView('prestamos')
      return
    }
    setSolicitudPendiente(solicitud)
    setView('prestamos')
    toast({
      title: 'Solicitud cargada',
      description: `Se precargó el formulario con los datos de la solicitud ${solicitud.codigo || ''}. Completa la información restante para crear el préstamo.`,
    })
  }

  // v4.16 — Estabilizamos onSolicitudConsumida con useCallback para evitar
  // re-disparos del useEffect[solicitudPendiente, onSolicitudConsumida] en
  // PrestamosView. Antes, la arrow inline se recreaba en cada render del
  // padre, lo que podía limpiar solicitudPendiente prematuramente y
  // provocar que el modal de creación de préstamo no se abriera.
  const handleSolicitudConsumida = useCallback(() => {
    setSolicitudPendiente(null)
  }, [])

  // Si aún no se verificó la auth, no renderizar nada (evita flash)
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-slate-400 text-sm">Verificando sesión...</div>
      </div>
    )
  }

  // Si no está autenticado después del check, no renderizar
  if (!isAuthenticated()) {
    return null
  }

  // === LAYOUT RESPONSIVO ===
  // El modo forzado por el usuario (responsiveMode) determina si mostramos
  // Sidebar (desktop), MobileNav (móvil/tablet), o dejamos que el CSS
  // responsivo normal haga su trabajo (auto).
  //
  // Reglas:
  //   - Portal cliente → NO se ve afectado (layout propio)
  //   - mode='desktop' → siempre Sidebar, nunca MobileNav
  //   - mode='mobile'  → nunca Sidebar, siempre MobileNav, contenido centrado max-w-[480px]
  //   - mode='tablet'  → nunca Sidebar, siempre MobileNav, contenido centrado max-w-[768px]
  //   - mode='auto'    → comportamiento responsivo normal (Sidebar lg+, MobileNav md-)
  const forzarDesktop = responsiveMode === 'desktop'
  const forzarMobile = responsiveMode === 'mobile'
  const forzarTablet = responsiveMode === 'tablet'
  const forzarMobileLayout = forzarMobile || forzarTablet

  // Ancho máximo del contenido cuando se simula móvil/tablet
  const contenidoMaxWidth = forzarMobile ? 480 : forzarTablet ? 768 : undefined

  return (
    <div
      className={cn(
        'min-h-screen flex',
        // En modo móvil/tablet forzado, centramos el contenido como si fuera
        // un celular/tablet real (banda oscura a los lados en desktop)
        forzarMobileLayout && 'bg-slate-950',
      )}
      data-responsive-mode={responsiveMode}
    >
      {/* Sidebar — solo se renderiza cuando corresponde según el modo */}
      {!esPortalCliente && !forzarMobileLayout && (
        <Sidebar
          view={view}
          onChange={setView}
          forceVisible={forzarDesktop}
          mobileOpen={mobileSidebarOpen}
          onMobileOpenChange={setMobileSidebarOpen}
        />
      )}

      {/* Contenedor principal — se centra y limita el ancho en modo móvil/tablet */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0',
          forzarMobileLayout && 'mx-auto w-full',
        )}
        style={forzarMobileLayout && contenidoMaxWidth ? { maxWidth: `${contenidoMaxWidth}px` } : undefined}
      >
        <main className="flex-1 overflow-x-hidden bg-background">
          {/* Auto-logout por inactividad (10 min) con aviso previo (9 min).
              FIX-LOGOUT-INESPERADO: el usuario reportó que la sesión se cerraba
              aleatoriamente. Este componente implementa la política esperada:
              10 min de inactividad → aviso → cierre de sesión. Solo se monta
              para usuarios internos (no para portal cliente, que tiene su
              propio manejo en PortalClienteModal). */}
          {!esPortalCliente && (
            <InactivityAutoLogout
              timeoutMs={10 * 60 * 1000}   // 10 minutos
              warningAtMs={9 * 60 * 1000}  // avisar a los 9 min
              enabled={true}
            />
          )}

          {/* Reloj digital Colombia — visible en todos los módulos (zona America/Bogota = Medellín/Bogotá)
              Ubicado al centro horizontal de la ventana, manteniendo la altura (top-3).
              pointer-events-none para no bloquear clics; el contenido tiene pt-16 para evitar superposición. */}
          {!esPortalCliente && (
            <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
              <RelojColombia />
            </div>
          )}

          {/* Botón de menú móvil (hamburguesa) — abre el Sidebar como drawer */}
          {!esPortalCliente && !forzarMobileLayout && !forzarDesktop && (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Abrir menú de módulos"
              className="lg:hidden fixed top-3 left-3 z-[60] flex items-center justify-center w-11 h-11 rounded-xl glass-card border border-white/15 shadow-lg hover:border-white/30 transition-all"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}

          {/* === BOTÓN "REGRESAR AL MENÚ" (visible solo en móvil) ===
              Se agrega (2026-08-05) porque en móvil el usuario necesitaba una forma
              clara de regresar al menú anterior / cambiar de módulo desde cualquier
              vista. El botón hamburguesa (arriba a la izquierda) abre el drawer;
              este botón adicional muestra una etiqueta "← Menú" para mayor claridad
              y va al dashboard si ya está en el dashboard (funciona como back). */}
          {!esPortalCliente && !forzarMobileLayout && !forzarDesktop && (
            <button
              type="button"
              onClick={() => {
                if (view === 'dashboard') {
                  // Si ya está en dashboard, abrir el drawer para cambiar de módulo
                  setMobileSidebarOpen(true)
                } else {
                  // Si está en otro módulo, regresar al dashboard (menu anterior)
                  setView('dashboard')
                }
              }}
              aria-label="Regresar al menú"
              className="lg:hidden fixed top-3 right-3 z-[60] flex items-center gap-1.5 px-3 h-11 rounded-xl glass-card border border-white/15 shadow-lg hover:border-white/30 transition-all text-white text-xs font-semibold"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              {view === 'dashboard' ? 'Menú' : 'Volver'}
            </button>
          )}

          {/* Botón de vista responsiva — solo para ADMIN/GESTOR/CONSULTOR */}
          {!esPortalCliente && <ResponsiveViewToggle />}

          <div
            className={cn(
              'main-container p-6 mx-auto fade-in pt-16 lg:pt-6',
              forzarMobileLayout ? 'w-full pb-24' : 'max-w-[1600px]',
            )}
            key={`${view}-${refreshKey}`}
          >
            {!vistaPermitida ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
                  <ShieldAlert className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Acceso denegado</h2>
                <p className="text-sm text-white/60 max-w-md">
                  Tu rol actual (<span className="font-semibold text-white">{reactiveRol || 'sin rol'}</span>) no tiene
                  permiso para acceder a este módulo. Si crees que es un error, contacta al administrador.
                </p>
                <button
                  onClick={() => {
                    // Si el usuario está bloqueado a un portal, ir a ese portal
                    const permitidas = vistasPermitidasUsuario(user?.username, reactiveRol)
                    if (permitidas.length === 1) {
                      setView(permitidas[0])
                    } else {
                      setView(vistaPorDefecto(reactiveRol))
                    }
                  }}
                  className="mt-6 px-4 py-2 rounded-lg text-sm font-semibold text-white gradient-primary hover:opacity-90 transition-opacity"
                >
                  Ir a mi módulo principal
                </button>
              </div>
            ) : (
              <>
                {view === 'dashboard' && <DashboardView onAbrirPrestamo={abrirPrestamo} />}
                {view === 'clientes' && <ClientesView onChanged={refresh} />}
                {view === 'prestamos' && (
                  <PrestamosView
                    onAbrirPrestamo={abrirPrestamo}
                    onChanged={refresh}
                    onCambiarVista={(v) => setView(v as ViewKey)}
                    solicitudPendiente={solicitudPendiente}
                    onSolicitudConsumida={handleSolicitudConsumida}
                  />
                )}
                {view === 'pagos' && <PagosView onChanged={refresh} />}
                {view === 'juridico' && <JuridicoView onChanged={refresh} />}
                {view === 'cajas' && <CajasView onChanged={refresh} />}
                {view === 'simulador' && <SimuladorView />}
                {view === 'campanas' && <CampanasView onChanged={refresh} />}
                {view === 'portal' && <PortalView onAbrirPortal={abrirPortal} />}
                {view === 'comunicaciones' && <CentroComunicacionesView />}
                {view === 'usuarios' && <UsuariosView />}
                {view === 'conexiones' && <ConexionesView />}
                {view === 'seguridad' && <SeguridadView />}
                {view === 'auditoria' && <AuditoriaSeguridadView />}
                {view === 'notificaciones' && <NotificacionesView />}
                {view === 'admin' && <AdminView onChanged={refresh} />}
                {view === 'portal-admin' && <PortalAdminView />}
                {view === 'configuracion' && <CentroConfiguracionView />}
                {view === 'exportar' && <ExportarView />}
                {view === 'codigo-fuente' && <CodigoFuenteView />}
                {view === 'manual' && <ManualView />}
                {view === 'automatizacion' && <AutomatizacionView />}
                {view === 'buzon-solicitudes' && (
                  <BuzonSolicitudesView onConvertir={convertirSolicitudWeb} />
                )}
              </>
            )}
          </div>
        </main>

        {/* MobileNav — se renderiza cuando se fuerza modo móvil/tablet, o cuando
            estamos en modo auto (MobileNav internamente usa lg:hidden para auto-ocultarse
            en pantallas lg+ donde el Sidebar ya está visible).
            En modo desktop forzado, NO se renderiza (el usuario quiere el Sidebar). */}
        {!esPortalCliente && !forzarDesktop && (
          <MobileNav current={view} onChange={setView} forceVisible={forzarMobileLayout} />
        )}
      </div>

      {prestamoSeleccionado && (
        <PrestamoDetalleModal
          prestamoId={prestamoSeleccionado}
          onClose={() => setPrestamoSeleccionado(null)}
          onChanged={refresh}
        />
      )}

      {portalCedula && (
        <PortalClienteModal
          cedula={portalCedula}
          token={portalToken || undefined}
          onClose={() => {
            // Si es sesión de portal cliente, al cerrar el modal volvemos al login
            if (esPortalCliente) {
              try {
                localStorage.removeItem('portal_cliente_token')
                localStorage.removeItem('portal_cliente_id')
                localStorage.removeItem('portal_cliente_nombre')
                localStorage.removeItem('portal_cliente_cedula')
              } catch {}
              logout()
            } else {
              setPortalCedula(null)
              setPortalToken(null)
            }
          }}
        />
      )}
    </div>
  )
}
