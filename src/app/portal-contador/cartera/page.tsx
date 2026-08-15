'use client'

import { ModuloEnDesarrollo } from '../componentes/ui-contador'

export default function ModuloPlaceholderPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ModuloEnDesarrollo titulo="Cartera" descripcion="Cuentas por cobrar, antigüedad de saldos y gestión de cartera." />
    </div>
  )
}
