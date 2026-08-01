'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { useToast } from '@/hooks/use-toast'
import { isAuthenticated, getUserData, logout } from '@/lib/api-client'
import { puedeAcceder, vistaPorDefecto } from '@/lib/permisos'
import { DashboardView } from '@/components/views/DashboardView'
import { ClientesView } from '@/components/views/ClientesView'
import { PrestamosView } from '@/components/views/PrestamosView'
import { PagosView } from '@/components/views/PagosView'
import { JuridicoView } from '@/components/views/JuridicoView'
import { ExportarView } from '@/components/views/ExportarView'
import { ManualView } from '@/components/views/ManualView'
import { NotificacionesView } from '@/components/views/NotificacionesView'
import { PrestamoDetalleModal } from '@/components/views/PrestamoDetalleModal'
import { CajasView } from '@/components/views/CajasView'
import { SimuladorView } from '@/components/views/SimuladorView'
import { CampanasView } from '@/components/views/CampanasView'
import { PortalView } from '@/components/views/PortalView'
import { AdminView } from '@/components/views/AdminView'
import { PortalClienteModal } from '@/components/views/PortalClienteModal'
import { UsuariosView } from '@/components/views/UsuariosView'
import { ConexionesView } from '@/components/views/ConexionesView'
import { SeguridadView } from '@/components/views/SeguridadView'
import { CodigoFuenteView } from '@/components/views/CodigoFuenteView'
import { AutomatizacionView } from '@/components/views/AutomatizacionView'
import { AuditoriaSeguridadView } from '@/components/views/AuditoriaSeguridadView'
import { CentroComunicacionesView } from '@/components/views/CentroComunicacionesView'
import { CentroConfiguracionView } from '@/components/views/CentroConfiguracionView'
import { BuzonSolicitudesView } from '@/components/views/BuzonSolicitudesView'
import { PortalAdminView } from '@/components/views/PortalAdminView'
import { Button } from '@/components/ui/button'
import { ShieldOff } from 'lucide-react'

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
  const { toast } = useToast()
  const router = useRouter()

  // === GUARDIA DE AUTENTICACIÓN ===
  // Si no está autenticado, redirigir a /login
  const [authChecked, setAuthChecked] = useState(false)
  const [esPortalCliente, setEsPortalCliente] = useState(false)
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }
    // Si el usuario inició sesión como CLIENTE, abrir su portal directamente
    const u = getUserData()
    if (u?.rol === 'CLIENTE' || u?.esPortalCliente) {
      setEsPortalCliente(true)
      // Precargar cédula/token del localStorage (seteados por el login de cliente)
      try {
        const cid = localStorage.getItem('portal_cliente_id')
        const tk = localStorage.getItem('portal_cliente_token')
        if (cid) setPortalCedula(cid)
        if (tk) setPortalToken(tk)
      } catch {}
      setView('portal')
    } else if (u?.rol) {
      // Guard de permisos: si la vista actual no está permitida para el rol,
      // redirigir a la vista por defecto del rol.
      const params = new URLSearchParams(window.location.search)
      const queryView = params.get('view') as ViewKey | null
      const vistaAValidar = queryView || view
      if (!puedeAcceder(u.rol, vistaAValidar)) {
        // Si la vista no es accesible, ir a la por defecto del rol
        const porDefecto = vistaPorDefecto(u.rol)
        setView(porDefecto)
        if (queryView) {
          // Limpiar el ?view=... de la URL
          router.replace('/')
        }
      }
    }
    setAuthChecked(true)
  }, [router])

  // Detectar query params para portal cliente (?tyc=token o ?pay=codigo o ?portal=cliente)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tyc = params.get('tyc')
    const pay = params.get('pay')
    const portalCliente = params.get('portal')
    if (tyc || pay) {
      // Mostrar portal cliente con el token/pendiente
      setView('portal')
    } else if (portalCliente === 'cliente') {
      // Login desde el perfil Cliente: llevar directo a la vista Portal
      setView('portal')
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

  // Convertir una solicitud web en préstamo (placeholder: navegar a préstamos)
  const convertirSolicitudWeb = (_solicitud: any) => {
    setView('prestamos')
    toast({
      title: 'Solicitud cargada',
      description: 'Completa los datos para crear el préstamo a partir de la solicitud web.',
    })
  }

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

  // Guard de permisos activo en cada render
  const currentUser = getUserData()
  const rolActual = currentUser?.rol || ''
  const vistaPermitida = esPortalCliente || puedeAcceder(rolActual, view)

  return (
    <div className="min-h-screen flex">
      {!esPortalCliente && <Sidebar view={view} onChange={setView} />}
      <main className="flex-1 overflow-x-hidden">
        <div className="main-container p-6 max-w-[1600px] mx-auto fade-in pt-16 lg:pt-6" key={`${view}-${refreshKey}`}>
          {!vistaPermitida ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-4">
                <ShieldOff className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Acceso denegado</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Tu rol <span className="font-semibold text-foreground">{rolActual}</span> no tiene permisos para acceder al módulo <span className="font-semibold text-foreground">{view}</span>.
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Si crees que esto es un error, contacta al administrador del sistema.
              </p>
              <Button
                className="mt-6"
                onClick={() => setView(vistaPorDefecto(rolActual))}
              >
                Ir a mi panel
              </Button>
            </div>
          ) : (
            <>
              {view === 'dashboard' && <DashboardView onAbrirPrestamo={abrirPrestamo} />}
              {view === 'clientes' && <ClientesView onChanged={refresh} />}
              {view === 'prestamos' && (
                <PrestamosView onAbrirPrestamo={abrirPrestamo} onChanged={refresh} onCambiarVista={(v) => setView(v as ViewKey)} />
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
