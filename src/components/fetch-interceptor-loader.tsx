'use client'

import { useEffect } from 'react'
import { installFetchInterceptor } from '@/lib/fetch-interceptor'

/**
 * Componente invisible que instala el interceptor de fetch
 * al montar la aplicación. Se coloca en el layout raíz.
 */
export function FetchInterceptorLoader() {
  useEffect(() => {
    installFetchInterceptor()
  }, [])

  return null
}
