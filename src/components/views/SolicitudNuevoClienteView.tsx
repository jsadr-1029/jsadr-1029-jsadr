'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  UserPlus, CheckCircle, FileText, Shield, DollarSign, Users,
  Phone, Mail, MapPin, Briefcase, Calendar, Send, Loader2,
} from 'lucide-react'

export function SolicitudNuevoClienteView() {
  const { toast } = useToast()
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [mostrarPolitica, setMostrarPolitica] = useState(false)
  const [mostrarEtapas, setMostrarEtapas] = useState(false)
  const [mostrarDatos, setMostrarDatos] = useState(false)

  const [form, setForm] = useState({
    nombre: '', apellido: '', tipoDocumento: 'CC', cedula: '',
    fechaNacimiento: '', telefono: '', email: '',
    ciudad: '', municipio: '', direccion: '',
    ocupacion: '', ingresoMensual: '', valorSolicitado: '',
    plazoDeseado: '12', destinoCredito: '',
    referidoPorNombre: '', referidoPorApellido: '',
    referidoPorTelefono: '', referidoPorParentesco: '',
    aceptaTyC: false, aceptaTratamientoDatos: false,
  })

  const actualizar = (campo: string, valor: string | boolean) => {
    setForm({ ...form, [campo]: valor })
  }

  const enviar = async () => {
    if (!form.nombre || !form.apellido || !form.cedula || !form.telefono || !form.valorSolicitado) {
      toast({ title: 'Faltan campos obligatorios', variant: 'destructive' })
      return
    }
    if (!form.aceptaTyC || !form.aceptaTratamientoDatos) {
      toast({ title: 'Debes aceptar los Términos y la Política de Datos', variant: 'destructive' })
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/solicitudes-nuevos-clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: '¡Solicitud enviada!', description: json.mensaje })
        setEnviado(true)
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="space-y-6">
        <Card className="glass-card max-w-lg mx-auto">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-emerald-700 mb-2">¡Solicitud Enviada!</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Hemos recibido tu solicitud. Nos pondremos en contacto contigo pronto para continuar con el proceso.
            </p>
            <Button onClick={() => { setEnviado(false); setForm({ nombre: '', apellido: '', tipoDocumento: 'CC', cedula: '', fechaNacimiento: '', telefono: '', email: '', ciudad: '', municipio: '', direccion: '', ocupacion: '', ingresoMensual: '', valorSolicitado: '', plazoDeseado: '12', destinoCredito: '', referidoPorNombre: '', referidoPorApellido: '', referidoPorTelefono: '', referidoPorParentesco: '', aceptaTyC: false, aceptaTratamientoDatos: false }) }}>
              Enviar otra solicitud
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicita tu Crédito"
        subtitle="¿Primera vez con nosotros? Inicia tu solicitud aquí"
        icon={<UserPlus className="w-5 h-5" />}
      />

      {/* Banner de bienvenida */}
      <Card className="glass-card border-primary/30 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <UserPlus className="w-6 h-6 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-primary mb-1">¡Bienvenido a Jsadr!</p>
              <p className="text-muted-foreground">
                Completa el formulario con tus datos. Un asesor revisará tu solicitud y se pondrá en contacto
                contigo para continuar con el proceso de aprobación.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Política de Préstamos */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Política de Préstamos
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setMostrarPolitica(!mostrarPolitica)}>
              {mostrarPolitica ? 'Ocultar' : 'Ver política'}
            </Button>
          </CardTitle>
        </CardHeader>
        {mostrarPolitica && (
          <CardContent className="space-y-4 text-sm">
            <div className="p-3 bg-muted/50 rounded-md space-y-2">
              <p className="font-semibold text-primary">📋 ¿Cómo funciona nuestro proceso de crédito?</p>
              <p>Nuestro proceso de préstamo es transparente y rápido. Te explicamos cada etapa:</p>
              <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => setMostrarEtapas(!mostrarEtapas)}>
                {mostrarEtapas ? 'Ocultar etapas' : 'Ver etapas del proceso →'}
              </Button>
            </div>

            {mostrarEtapas && (
              <div className="space-y-3">
                <div className="flex gap-3 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shrink-0">1</div>
                  <div>
                    <p className="font-semibold text-sm">Solicitud inicial</p>
                    <p className="text-xs text-muted-foreground">Completas este formulario con tus datos personales, financieros y de referencia. La información es confidencial.</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shrink-0">2</div>
                  <div>
                    <p className="font-semibold text-sm">Revisión y verificación</p>
                    <p className="text-xs text-muted-foreground">Un asesor revisa tu solicitud, verifica tu información y te contacta para confirmar datos y solicitar documentación adicional si es necesaria.</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shrink-0">3</div>
                  <div>
                    <p className="font-semibold text-sm">Aprobación y oferta</p>
                    <p className="text-xs text-muted-foreground">Si cumples los requisitos, recibes una oferta con monto, tasa, plazo y cuota. Puedes aceptar o rechazar sin compromiso.</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shrink-0">4</div>
                  <div>
                    <p className="font-semibold text-sm">Firma electrónica</p>
                    <p className="text-xs text-muted-foreground">Aceptas los Términos y Condiciones mediante firma electrónica con verificación OTP (WhatsApp/correo) y foto selfie con cédula. Todo queda registrado legalmente.</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shrink-0">5</div>
                  <div>
                    <p className="font-semibold text-sm">Desembolso</p>
                    <p className="text-xs text-muted-foreground">Una vez firmado, el dinero se desembolsa y puedes empezar a usar tu crédito. Recibirás el pagaré y la carta de instrucciones firmados.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800 text-xs">
              <p className="font-semibold text-amber-700 dark:text-amber-300 mb-1">💰 Condiciones generales</p>
              <ul className="space-y-1 ml-4 list-disc text-amber-700 dark:text-amber-300">
                <li>Montos desde $300,000 hasta $10,000,000 COP</li>
                <li>Plazos de 1 a 36 meses según el monto</li>
                <li>Tasa de interés fija sobre capital inicial (cuota constante)</li>
                <li>Frecuencia: mensual, quincenal o semanal</li>
                <li>Se requiere codeudor para montos superiores a $5,000,000</li>
                <li>Interés moratorio a tasa máxima legal en caso de impago</li>
              </ul>
            </div>

            <div className="p-3 bg-muted/50 rounded-md text-xs">
              <p className="font-semibold mb-1">🔐 Política de Tratamiento de Datos Personales</p>
              <p className="text-muted-foreground">
                De conformidad con la Ley 1581 de 2012 y el Decreto 1377 de 2013, Jsadr
                actúa como responsable del tratamiento de tus datos personales. Los datos recopilados
                en este formulario serán utilizados exclusivamente para evaluar tu solicitud de crédito,
                verificar tu identidad y contactarte. Tus datos serán tratados de forma confidencial y
                no serán compartidos con terceros sin tu autorización expresa. Tienes derecho a
                conocer, actualizar, rectificar y suprimir tus datos personales en cualquier momento.
                La aceptación de esta política es voluntaria pero necesaria para procesar tu solicitud.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Formulario */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Datos Personales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombres *</Label>
              <Input value={form.nombre} onChange={(e) => actualizar('nombre', e.target.value)} placeholder="Ej: Juan" />
            </div>
            <div className="space-y-2">
              <Label>Apellidos *</Label>
              <Input value={form.apellido} onChange={(e) => actualizar('apellido', e.target.value)} placeholder="Ej: Pérez" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de documento *</Label>
              <Select value={form.tipoDocumento} onValueChange={(v) => actualizar('tipoDocumento', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                  <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                  <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número de documento *</Label>
              <Input value={form.cedula} onChange={(e) => actualizar('cedula', e.target.value.replace(/\D/g, ''))} placeholder="1234567890" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de nacimiento</Label>
              <Input type="date" value={form.fechaNacimiento} onChange={(e) => actualizar('fechaNacimiento', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono *</Label>
              <Input value={form.telefono} onChange={(e) => actualizar('telefono', e.target.value.replace(/\D/g, ''))} placeholder="3001234567" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Correo electrónico</Label>
            <Input type="email" value={form.email} onChange={(e) => actualizar('email', e.target.value)} placeholder="juan@email.com" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input value={form.ciudad} onChange={(e) => actualizar('ciudad', e.target.value)} placeholder="Medellín" />
            </div>
            <div className="space-y-2">
              <Label>Municipio/Barrio</Label>
              <Input value={form.municipio} onChange={(e) => actualizar('municipio', e.target.value)} placeholder="Bello" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Dirección</Label>
            <Input value={form.direccion} onChange={(e) => actualizar('direccion', e.target.value)} placeholder="Calle 123 #45-67" />
          </div>
        </CardContent>
      </Card>

      {/* Datos financieros */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Información Financiera</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ocupación</Label>
              <Input value={form.ocupacion} onChange={(e) => actualizar('ocupacion', e.target.value)} placeholder="Empleado independiente" />
            </div>
            <div className="space-y-2">
              <Label>Ingreso mensual (COP)</Label>
              <Input type="number" value={form.ingresoMensual} onChange={(e) => actualizar('ingresoMensual', e.target.value)} placeholder="2000000" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor solicitado (COP) *</Label>
              <Input type="number" value={form.valorSolicitado} onChange={(e) => actualizar('valorSolicitado', e.target.value)} placeholder="1000000" />
            </div>
            <div className="space-y-2">
              <Label>Plazo deseado (meses)</Label>
              <Input type="number" value={form.plazoDeseado} onChange={(e) => actualizar('plazoDeseado', e.target.value)} placeholder="12" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>¿Para qué necesitas el crédito?</Label>
            <Textarea value={form.destinoCredito} onChange={(e) => actualizar('destinoCredito', e.target.value)} placeholder="Ej: Capital para mi negocio, gastos médicos, etc." rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Referido */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Persona que te refiere (opcional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombres</Label>
              <Input value={form.referidoPorNombre} onChange={(e) => actualizar('referidoPorNombre', e.target.value)} placeholder="Ej: Johan" />
            </div>
            <div className="space-y-2">
              <Label>Apellidos</Label>
              <Input value={form.referidoPorApellido} onChange={(e) => actualizar('referidoPorApellido', e.target.value)} placeholder="Ej: Alvarez" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={form.referidoPorTelefono} onChange={(e) => actualizar('referidoPorTelefono', e.target.value.replace(/\D/g, ''))} placeholder="3001234567" />
            </div>
            <div className="space-y-2">
              <Label>Parentesco / Relación</Label>
              <Input value={form.referidoPorParentesco} onChange={(e) => actualizar('referidoPorParentesco', e.target.value)} placeholder="Ej: Amigo, familiar, cliente" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aceptaciones */}
      <Card className="glass-card border-primary/30">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <input type="checkbox" id="tyc" checked={form.aceptaTyC} onChange={(e) => actualizar('aceptaTyC', e.target.checked)} className="mt-1" />
            <Label htmlFor="tyc" className="text-sm cursor-pointer">
              Acepto los <strong>Términos y Condiciones</strong> de Jsadr y confirmo que la información
              proporcionada es verídica. Entiendo que esta solicitud está sujeta a evaluación y aprobación.
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <input type="checkbox" id="datos" checked={form.aceptaTratamientoDatos} onChange={(e) => actualizar('aceptaTratamientoDatos', e.target.checked)} className="mt-1" />
            <Label htmlFor="datos" className="text-sm cursor-pointer">
              Acepto la <strong>Política de Tratamiento de Datos Personales</strong> (Ley 1581 de 2012)
              y autorizo el uso de mi información para evaluar y procesar mi solicitud de crédito.
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Enviar */}
      <Button className="w-full" size="lg" onClick={enviar} disabled={enviando}>
        {enviando ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Enviando solicitud...</>
        ) : (
          <><Send className="w-5 h-5 mr-2" /> Enviar solicitud</>
        )}
      </Button>
    </div>
  )
}
