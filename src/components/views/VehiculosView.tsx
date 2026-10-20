'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Car, LayoutDashboard, Users, FileText, CreditCard, Wrench, Package, Receipt, ShieldAlert, BookUser, QrCode } from 'lucide-react'
import { VehiculosDashboard } from './vehiculos/VehiculosDashboard'
import { VehiculosPanel } from './vehiculos/VehiculosPanel'
import { ConductoresPanel } from './vehiculos/ConductoresPanel'
import { ContratosPanel } from './vehiculos/ContratosPanel'
import { PagosPanel } from './vehiculos/PagosPanel'
import { MantenimientosPanel } from './vehiculos/MantenimientosPanel'
import { RepuestosPanel } from './vehiculos/RepuestosPanel'
import { GastosPanel } from './vehiculos/GastosPanel'
import { AuditoriaPanel } from './vehiculos/AuditoriaPanel'
import { ProveedoresPanel } from './vehiculos/ProveedoresPanel'
import { CuentasPagoPanel } from './vehiculos/CuentasPagoPanel'
import { CodigosQRPanel } from './vehiculos/CodigosQRPanel'

export function VehiculosView() {
  const [tab, setTab] = useState('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Gestión de Vehículos"
        subtitle="Sistema integral de arrendamiento de vehículos"
        icon={<Car className="w-5 h-5" />}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex overflow-x-auto whitespace-nowrap md:grid md:grid-cols-12 w-full no-scrollbar h-auto">
          <TabsTrigger value="dashboard" className="flex flex-col items-center gap-1 py-2">
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-xs">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="vehiculos" className="flex flex-col items-center gap-1 py-2">
            <Car className="w-4 h-4" />
            <span className="text-xs">Vehículos</span>
          </TabsTrigger>
          <TabsTrigger value="conductores" className="flex flex-col items-center gap-1 py-2">
            <Users className="w-4 h-4" />
            <span className="text-xs">Conductores</span>
          </TabsTrigger>
          <TabsTrigger value="contratos" className="flex flex-col items-center gap-1 py-2">
            <FileText className="w-4 h-4" />
            <span className="text-xs">Contratos</span>
          </TabsTrigger>
          <TabsTrigger value="pagos" className="flex flex-col items-center gap-1 py-2">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs">Pagos</span>
          </TabsTrigger>
          <TabsTrigger value="cuentas-pago" className="flex flex-col items-center gap-1 py-2">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs">Cuentas Pago</span>
          </TabsTrigger>
          <TabsTrigger value="codigos-qr" className="flex flex-col items-center gap-1 py-2">
            <QrCode className="w-4 h-4" />
            <span className="text-xs">Códigos QR</span>
          </TabsTrigger>
          <TabsTrigger value="mantenimientos" className="flex flex-col items-center gap-1 py-2">
            <Wrench className="w-4 h-4" />
            <span className="text-xs">Mantenim.</span>
          </TabsTrigger>
          <TabsTrigger value="repuestos" className="flex flex-col items-center gap-1 py-2">
            <Package className="w-4 h-4" />
            <span className="text-xs">Repuestos</span>
          </TabsTrigger>
          <TabsTrigger value="gastos" className="flex flex-col items-center gap-1 py-2">
            <Receipt className="w-4 h-4" />
            <span className="text-xs">Gastos</span>
          </TabsTrigger>
          <TabsTrigger value="proveedores" className="flex flex-col items-center gap-1 py-2">
            <BookUser className="w-4 h-4" />
            <span className="text-xs">Proveedores</span>
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="flex flex-col items-center gap-1 py-2">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-xs">Auditoría</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><VehiculosDashboard key={refreshKey} /></TabsContent>
        <TabsContent value="vehiculos"><VehiculosPanel key={refreshKey} onChanged={refresh} /></TabsContent>
        <TabsContent value="conductores"><ConductoresPanel key={refreshKey} onChanged={refresh} /></TabsContent>
        <TabsContent value="contratos"><ContratosPanel key={refreshKey} onChanged={refresh} /></TabsContent>
        <TabsContent value="pagos"><PagosPanel key={refreshKey} onChanged={refresh} /></TabsContent>
        <TabsContent value="cuentas-pago"><CuentasPagoPanel key={refreshKey} onChanged={refresh} /></TabsContent>
        <TabsContent value="codigos-qr"><CodigosQRPanel key={refreshKey} onChanged={refresh} /></TabsContent>
        <TabsContent value="mantenimientos"><MantenimientosPanel key={refreshKey} onChanged={refresh} /></TabsContent>
        <TabsContent value="repuestos"><RepuestosPanel key={refreshKey} onChanged={refresh} /></TabsContent>
        <TabsContent value="gastos"><GastosPanel key={refreshKey} onChanged={refresh} /></TabsContent>
        <TabsContent value="proveedores"><ProveedoresPanel key={refreshKey} onChanged={refresh} /></TabsContent>
        <TabsContent value="auditoria"><AuditoriaPanel key={refreshKey} /></TabsContent>
      </Tabs>
    </div>
  )
}
