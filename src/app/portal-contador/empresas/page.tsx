'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, Building2, CheckCircle2 } from 'lucide-react'
import { apiContador, useContadorAuth } from '../componentes/contador-auth-provider'
import { PageHeader, formatDate, EmptyState } from '../componentes/ui-contador'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'

interface Empresa {
  id: string
  razonSocial: string
  nit: string
  dv?: string | null
  tipoEmpresa: string
  regimen?: string | null
  ciiu?: string | null
  municipio?: string | null
  departamento?: string | null
  representanteLegal?: string | null
  contadorNombre?: string | null
  revisorFiscal?: string | null
  marcoContable?: string | null
  activa: boolean
  createdAt: string
  _count?: {
    terceros: number
    cuentas: number
    comprobantes: number
    periodos: number
    declaraciones: number
  }
}

const TIPO_EMPRESA = ['SOCIEDAD_LIMITADA', 'SA', 'SAS', 'PERSONA_NATURAL', 'UNIPERSONAL', 'OTRO']
const REGIMEN = ['COMUN', 'SIMPLIFICADO', 'GRAN_CONTRIBUYENTE', 'NO_RESPONSABLE']
const MARCO = ['NIIF_PYMES', 'NIIF_COMPLETO', 'CONTABILIDAD_PUBLICA', 'OTRO']

const emptyForm = {
  razonSocial: '',
  nit: '',
  dv: '',
  tipoEmpresa: 'SAS',
  regimen: 'COMUN',
  ciiu: '',
  municipio: '',
  departamento: '',
  representanteLegal: '',
  contadorNombre: '',
  revisorFiscal: '',
  marcoContable: 'NIIF_PYMES',
  actividades: '',
  responsabilidades: '',
}

export default function EmpresasPage() {
  const { user, loading: authLoading, setEmpresaId, refreshUser, empresaId } = useContadorAuth()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Empresa | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [aEliminar, setAEliminar] = useState<Empresa | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const r = await apiContador(`/api/portal-contador/empresas?q=${encodeURIComponent(q)}`)
    setLoading(false)
    if (r.ok) setEmpresas(r.data.data || [])
    else toast.error(r.error || 'No se pudo cargar empresas.')
  }, [q])

  useEffect(() => {
    if (authLoading || !user) return
    cargar()
  }, [authLoading, user, cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const abrirEditar = (e: Empresa) => {
    setEditando(e)
    setForm({
      razonSocial: e.razonSocial,
      nit: e.nit,
      dv: e.dv || '',
      tipoEmpresa: e.tipoEmpresa || 'SAS',
      regimen: e.regimen || 'COMUN',
      ciiu: e.ciiu || '',
      municipio: e.municipio || '',
      departamento: e.departamento || '',
      representanteLegal: e.representanteLegal || '',
      contadorNombre: e.contadorNombre || '',
      revisorFiscal: e.revisorFiscal || '',
      marcoContable: e.marcoContable || 'NIIF_PYMES',
      actividades: '',
      responsabilidades: '',
    })
    setDialogOpen(true)
  }

  const guardar = async () => {
    if (!form.razonSocial || !form.nit) {
      toast.error('Razón social y NIT son obligatorios.')
      return
    }
    setSaving(true)
    const body = { ...form }
    const r = editando
      ? await apiContador(`/api/portal-contador/empresas/${editando.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await apiContador('/api/portal-contador/empresas', {
          method: 'POST',
          body: JSON.stringify(body),
        })
    setSaving(false)
    if (!r.ok) {
      toast.error(r.error || 'No se pudo guardar la empresa.')
      return
    }
    toast.success(editando ? 'Empresa actualizada.' : 'Empresa creada.')
    setDialogOpen(false)
    cargar()
    refreshUser()
  }

  const confirmarEliminar = async () => {
    if (!aEliminar) return
    const r = await apiContador(`/api/portal-contador/empresas/${aEliminar.id}`, {
      method: 'DELETE',
    })
    if (!r.ok) {
      toast.error(r.error || 'No se pudo desactivar la empresa.')
      return
    }
    toast.success('Empresa desactivada.')
    setAEliminar(null)
    cargar()
    refreshUser()
  }

  const seleccionarComoActiva = async (e: Empresa) => {
    setEmpresaId(e.id)
    toast.success(`"${e.razonSocial}" seleccionada como empresa activa.`)
  }

  if (authLoading) return null

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Empresas"
        descripcion="Gestione las empresas (clientes contables) del portal."
        acciones={
          <Button onClick={abrirNuevo} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva empresa
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por razón social o NIT…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}

      {!loading && empresas.length === 0 && (
        <EmptyState
          titulo="No hay empresas registradas"
          descripcion="Cree la primera empresa para comenzar a registrar la contabilidad."
          accion={
            <Button onClick={abrirNuevo} className="gap-2">
              <Plus className="h-4 w-4" /> Crear empresa
            </Button>
          }
        />
      )}

      {!loading && empresas.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razón social</TableHead>
                    <TableHead>NIT</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead className="text-center">Registros</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresas.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">{e.razonSocial}</div>
                        {e.representanteLegal && (
                          <div className="text-xs text-slate-500">Rep. legal: {e.representanteLegal}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.nit}
                        {e.dv ? `-${e.dv}` : ''}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{e.tipoEmpresa}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {e.municipio || '—'}
                        {e.departamento ? ` / ${e.departamento}` : ''}
                      </TableCell>
                      <TableCell className="text-center text-xs text-slate-600">
                        <div>Terceros: {e._count?.terceros ?? 0}</div>
                        <div>Cuentas: {e._count?.cuentas ?? 0}</div>
                        <div>Comprob.: {e._count?.comprobantes ?? 0}</div>
                      </TableCell>
                      <TableCell>
                        {e.activa ? (
                          <Badge className="bg-emerald-100 text-emerald-700">Activa</Badge>
                        ) : (
                          <Badge variant="secondary">Inactiva</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {empresaId !== e.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => seleccionarComoActiva(e)}
                              title="Seleccionar como empresa activa"
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => abrirEditar(e)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setAEliminar(e)}>
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar empresa' : 'Nueva empresa'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label>Razón social *</Label>
              <Input
                value={form.razonSocial}
                onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>NIT *</Label>
              <Input
                value={form.nit}
                onChange={(e) => setForm({ ...form, nit: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Dígito de verificación</Label>
              <Input
                value={form.dv}
                maxLength={1}
                onChange={(e) => setForm({ ...form, dv: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de empresa</Label>
              <Select value={form.tipoEmpresa} onValueChange={(v) => setForm({ ...form, tipoEmpresa: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_EMPRESA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Régimen</Label>
              <Select value={form.regimen} onValueChange={(v) => setForm({ ...form, regimen: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIMEN.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CIIU</Label>
              <Input value={form.ciiu} onChange={(e) => setForm({ ...form, ciiu: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Marco contable</Label>
              <Select value={form.marcoContable} onValueChange={(v) => setForm({ ...form, marcoContable: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARCO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Municipio</Label>
              <Input value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Input value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Representante legal</Label>
              <Input value={form.representanteLegal} onChange={(e) => setForm({ ...form, representanteLegal: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contador</Label>
              <Input value={form.contadorNombre} onChange={(e) => setForm({ ...form, contadorNombre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Revisor fiscal</Label>
              <Input value={form.revisorFiscal} onChange={(e) => setForm({ ...form, revisorFiscal: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Actividades económicas (separadas por coma)</Label>
              <Textarea
                rows={2}
                value={form.actividades}
                onChange={(e) => setForm({ ...form, actividades: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Responsabilidades tributarias (separadas por coma)</Label>
              <Textarea
                rows={2}
                value={form.responsabilidades}
                onChange={(e) => setForm({ ...form, responsabilidades: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <AlertDialog open={!!aEliminar} onOpenChange={(o) => !o && setAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactivará <strong>{aEliminar?.razonSocial}</strong> (NIT {aEliminar?.nit}). No se
              eliminará información; podrá reactivarse editando la empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEliminar}>Desactivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
