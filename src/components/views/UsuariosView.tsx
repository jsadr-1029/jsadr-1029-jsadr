'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatearFechaHora } from '@/lib/finanzas'
import { Users, Plus, Edit, Trash2, Shield, UserCog, Eye, KeyRound, Power } from 'lucide-react'

interface Usuario {
  id: string
  nombre: string
  email: string
  username: string
  rol: string
  activo: boolean
  ultimoAcceso: string | null
  permisos: string | null
  createdAt: string
}

interface RolesInfo {
  [key: string]: {
    label: string
    descripcion: string
    permisos: string[]
  }
}

const ROL_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ADMIN: { label: 'Administrador', color: 'bg-red-100 text-red-800 border-red-300', icon: Shield },
  GESTOR: { label: 'Gestor', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: UserCog },
  CONSULTOR: { label: 'Consultor', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: Eye },
}

export function UsuariosView() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<RolesInfo>({})
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const { toast } = useToast()

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    username: '',
    password: '',
    rol: 'GESTOR',
  })
  const [showPermisos, setShowPermisos] = useState<string | null>(null)

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/usuarios')
      const json = await res.json()
      if (json.success) {
        setUsuarios(json.data)
        setRoles(json.roles)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ nombre: '', email: '', username: '', password: '', rol: 'GESTOR' })
    setModalAbierto(true)
  }

  const abrirEditar = (u: Usuario) => {
    setEditando(u)
    setForm({
      nombre: u.nombre,
      email: u.email,
      username: u.username,
      password: '', // solo se cambia si se ingresa uno nuevo
      rol: u.rol,
    })
    setModalAbierto(true)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const method = editando ? 'PATCH' : 'POST'
      const body: any = { ...form }
      if (editando) {
        body.id = editando.id
        if (!body.password) delete body.password // no cambiar si está vacío
      }
      const res = await fetch('/api/usuarios', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        toast({
          title: editando ? 'Usuario actualizado' : 'Usuario creado',
          description: `${form.nombre} - ${ROL_CONFIG[form.rol]?.label}`,
        })
        setModalAbierto(false)
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const toggleActivo = async (u: Usuario) => {
    try {
      await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, activo: !u.activo }),
      })
      toast({
        title: u.activo ? 'Usuario desactivado' : 'Usuario activado',
        description: u.nombre,
      })
      cargar()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const eliminar = async (u: Usuario) => {
    if (!confirm(`¿Eliminar al usuario "${u.nombre}"?\nEsta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/usuarios?id=${u.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'Usuario eliminado' })
        cargar()
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios del Sistema"
        subtitle="Gestión de usuarios con roles y permisos"
        icon={<Users className="w-5 h-5" />}
        actions={
          <Button onClick={abrirNuevo}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Usuario
          </Button>
        }
      />

      {/* Tarjetas de roles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(roles).map(([key, rol]) => {
          const config = ROL_CONFIG[key]
          const Icon = config?.icon || Users
          const cantidad = usuarios.filter((u) => u.rol === key).length
          return (
            <Card key={key}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{rol.label}</p>
                    <p className="text-xs text-muted-foreground">{cantidad} usuario(s)</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{rol.descripcion}</p>
                <div className="flex flex-wrap gap-1">
                  {rol.permisos.slice(0, 6).map((p) => (
                    <span
                      key={p}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                    >
                      {p}
                    </span>
                  ))}
                  {rol.permisos.length > 6 && (
                    <button
                      onClick={() => setShowPermisos(key)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20"
                    >
                      +{rol.permisos.length - 6} más
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabla de usuarios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios Registrados ({usuarios.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : usuarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay usuarios registrados
                  </TableCell>
                </TableRow>
              ) : (
                usuarios.map((u) => {
                  const config = ROL_CONFIG[u.rol] || ROL_CONFIG.CONSULTOR
                  return (
                    <TableRow key={u.id} className={u.activo ? '' : 'opacity-50'}>
                      <TableCell className="font-medium">{u.nombre}</TableCell>
                      <TableCell className="font-mono text-xs">@{u.username}</TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${config.color}`}>
                          <config.icon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {u.activo ? (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                            ● Activo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-600">
                            ○ Inactivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.ultimoAcceso ? formatearFechaHora(u.ultimoAcceso) : 'Nunca'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatearFechaHora(u.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirEditar(u)}
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleActivo(u)}
                            title={u.activo ? 'Desactivar' : 'Activar'}
                            className={u.activo ? 'text-amber-700' : 'text-emerald-700'}
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                          {u.rol !== 'ADMIN' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => eliminar(u)}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal crear/editar */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              {editando ? 'Editar Usuario' : 'Nuevo Usuario'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo *</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                placeholder="Ej: Juan Pérez"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="username">Usuario *</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                  required
                  placeholder="jperez"
                  autoCapitalize="none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="jperez@empresa.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                {editando ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editando}
                placeholder={editando ? '••••••••' : 'Mínimo 6 caracteres'}
                minLength={editando ? 0 : 6}
              />
            </div>
            <div className="space-y-2">
              <Label>Rol *</Label>
              <Select value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">
                    <span className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-600" />
                      Administrador - Acceso total
                    </span>
                  </SelectItem>
                  <SelectItem value="GESTOR">
                    <span className="flex items-center gap-2">
                      <UserCog className="w-4 h-4 text-blue-600" />
                      Gestor - Operativo (préstamos, pagos, jurídico)
                    </span>
                  </SelectItem>
                  <SelectItem value="CONSULTOR">
                    <span className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-emerald-600" />
                      Consultor - Solo lectura
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {roles[form.rol] && (
                <p className="text-xs text-muted-foreground mt-1">
                  {roles[form.rol].permisos.length} permisos asignados a este rol
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editando ? 'Guardar cambios' : 'Crear usuario'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal ver permisos */}
      <Dialog open={!!showPermisos} onOpenChange={(open) => !open && setShowPermisos(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Permisos del rol {showPermisos && roles[showPermisos]?.label}</DialogTitle>
          </DialogHeader>
          {showPermisos && (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {roles[showPermisos].permisos.map((p) => (
                <div
                  key={p}
                  className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
                >
                  <span className="text-emerald-600">✓</span>
                  <span className="font-mono text-xs">{p}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
