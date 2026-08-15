'use client'

// Página raíz del Portal del Contador.
// El layout (ContadorShell) decide qué mostrar: si no hay sesión,
// muestra el formulario de login; si la hay, redirige al dashboard.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useContadorAuth } from './componentes/contador-auth-provider'

export default function PortalContadorPage() {
  const { user, loading } = useContadorAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user && !user.mustChangePassword) {
      router.replace('/portal-contador/dashboard')
    }
  }, [loading, user, router])

  // Si está cargando o autenticado (en proceso de redirección), mostrar spinner.
  // Si no hay usuario, el layout ya renderiza el formulario de login.
  if (loading || (user && !user.mustChangePassword)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
          <span className="text-sm">Abriendo el panel…</span>
        </div>
      </div>
    )
  }

  return null
}
