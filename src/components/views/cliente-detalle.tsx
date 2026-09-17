'use client'

import { useFetch } from '@/hooks/use-fetch'
import { Card, PageHeader, Badge, EmptyState, LoadingState } from '@/components/shared/ui'
import { formatCOP, formatDate, getInitials, formatRelativeTime } from '@/lib/format'
import { Users, Phone, Mail, MapPin, Building, Calendar, Wallet, FileText, ArrowLeft, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

type View = { name: string; id?: string }

export function ClienteDetalle({ id, navigate }: { id: string; navigate: (v: any) => void }) {
  const { data: cliente, loading } = useFetch<any>(`/api/clientes/${id}`)

  if (loading) return <LoadingState />
  if (!cliente) return <EmptyState icon={Users} title="Cliente no encontrado" />

  const totalPrestamos = cliente.prestamos?.length || 0
  const prestamosActivos = cliente.prestamos?.filter((p: any) => p.estado === 'ACTIVO').length || 0
  const saldoTotal = cliente.prestamos?.reduce((s: number, p: any) => s + Number(p.saldoTotal || 0), 0) || 0

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'clientes' })} className="mb-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Volver a clientes
      </Button>

      <PageHeader
        title={cliente.nombre}
        subtitle={`CC ${cliente.cedula}`}
        icon={Users}
        actions={
          <Badge variant={cliente.activo ? 'success' : 'neutral'}>
            {cliente.activo ? 'Activo' : 'Inactivo'}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Info personal */}
        <Card title="Información Personal" className="lg:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center text-xl font-bold">
              {getInitials(cliente.nombre)}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{cliente.nombre}</p>
              <p className="text-xs text-slate-500">Cliente desde {formatDate(cliente.createdAt)}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <InfoRow icon={Building} label="Cédula" value={cliente.cedula} />
            <InfoRow icon={Phone} label="Teléfono" value={cliente.telefono} />
            <InfoRow icon={Mail} label="Email" value={cliente.email || '—'} />
            <InfoRow icon={MapPin} label="Dirección" value={cliente.direccion || '—'} />
            <InfoRow icon={MapPin} label="Departamento" value={cliente.departamento || '—'} />
            <InfoRow icon={MapPin} label="Municipio" value={cliente.municipio || '—'} />
            <InfoRow icon={Wallet} label="Salario" value={cliente.salario ? formatCOP(cliente.salario) : '—'} />
            <InfoRow icon={Building} label="Banco" value={cliente.bancoCliente || '—'} />
            <InfoRow icon={Building} label="Cuenta" value={`${cliente.tipoCuentaCliente || '—'} - ${cliente.numeroCuentaCliente || '—'}`} />
            <InfoRow icon={Calendar} label="Ingreso" value={formatDate(cliente.fechaIngreso)} />
            {cliente.categoria && (
              <InfoRow icon={FileText} label="Categoría" value={cliente.categoria.nombre} />
            )}
          </div>
        </Card>

        {/* Préstamos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center">
              <p className="text-2xl font-bold text-slate-900">{totalPrestamos}</p>
              <p className="text-xs text-slate-500">Préstamos totales</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{prestamosActivos}</p>
              <p className="text-xs text-slate-500">Activos</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-purple-700">{formatCOP(saldoTotal)}</p>
              <p className="text-xs text-slate-500">Saldo total</p>
            </Card>
          </div>

          <Card title="Préstamos del Cliente" subtitle={`${totalPrestamos} registros`}>
            {!cliente.prestamos?.length ? (
              <EmptyState icon={FileText} title="Sin préstamos" description="Este cliente no tiene préstamos registrados." />
            ) : (
              <div className="space-y-2">
                {cliente.prestamos.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => navigate({ name: 'prestamo-detalle', id: p.id })}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900 text-sm">{p.codigo}</span>
                        <Badge variant={p.estado === 'ACTIVO' ? 'success' : p.estado === 'PAGADO' ? 'neutral' : p.estado === 'EN_MORA' ? 'danger' : 'info'}>
                          {p.estado}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Monto: <strong className="text-slate-700">{formatCOP(p.montoPrincipal)}</strong></span>
                        <span>Cuotas: <strong className="text-slate-700">{p.cuotasPagadas}/{p.numeroCuotas}</strong></span>
                        {p.fechaVencimiento && (
                          <span>Vence: <strong className="text-slate-700">{formatDate(p.fechaVencimiento)}</strong></span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <p className="font-semibold text-slate-900 text-sm">{formatCOP(p.saldoTotal)}</p>
                      <p className="text-xs text-slate-500">Saldo</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Últimos accesos al portal */}
          <Card title="Accesos al Portal" subtitle="Últimos 20 accesos">
            {!cliente.accesosPortal?.length ? (
              <EmptyState icon={Users} title="Sin accesos" />
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {cliente.accesosPortal.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${a.exito ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="font-medium text-slate-700">{a.accion}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">{a.detalle}</span>
                    </div>
                    <span className="text-slate-400">{formatRelativeTime(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <span className="text-slate-500 text-xs w-28">{label}</span>
      <span className="text-slate-900 font-medium flex-1 truncate">{value}</span>
    </div>
  )
}
