'use client'

import { ModuloEnDesarrollo } from '../componentes/ui-contador'

export default function ModuloPlaceholderPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ModuloEnDesarrollo titulo="Proveedores" descripcion="Cuentas por pagar, órdenes de compra y pagos a proveedores." />
    </div>
  )
}
