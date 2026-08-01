'use client'

import { useEffect, useState, createContext, useContext, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { isAuthenticated, getUserData, logout } from '@/lib/api-client'

interface AuthContextType {
  user: any | null
  loading: boolean
  signOut: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

// Rutas públicas (no requieren autenticación)
const PUBLIC_ROUTES = ['/login', '/juridico', '/firma']

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar autenticación al montar
    const checkAuth = () => {
      const isAuth = isAuthenticated()
      const userData = getUserData()
      setUser(isAuth ? userData : null)

      const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route))

      if (!isAuth && !isPublicRoute && pathname !== '/') {
        // Si no está autenticado y está en ruta protegida, ir a login
        router.replace('/login')
      } else if (!isAuth && pathname === '/') {
        // Si está en la raíz sin auth, ir a login
        router.replace('/login')
      } else if (isAuth && pathname === '/login') {
        // Si está autenticado y en login, ir al dashboard
        router.replace('/')
      }

      setLoading(false)
    }

    checkAuth()
  }, [pathname, router])

  const signOut = () => {
    logout()
    setUser(null)
    router.replace('/login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
