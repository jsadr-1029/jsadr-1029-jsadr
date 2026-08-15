import type { Metadata } from 'next'
import { ContadorAuthProvider } from './componentes/contador-auth-provider'
import { ContadorShell } from './componentes/ContadorShell'

export const metadata: Metadata = {
  title: 'Portal del Contador · JSADR',
  description: 'Gestión contable y tributaria multi-empresa para el contador JSADR',
}

export default function PortalContadorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ContadorAuthProvider>
      <ContadorShell>{children}</ContadorShell>
    </ContadorAuthProvider>
  )
}
