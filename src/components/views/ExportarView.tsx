'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui-basics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { descargarArchivo } from '@/lib/auth-docs'
import {
  Database,
  FileJson,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Eye,
  Fingerprint,
} from 'lucide-react'

export function ExportarView() {
  const [exportando, setExportando] = useState(false)
  const { toast } = useToast()

  const descargar = async (formato: 'json' | 'csv') => {
    // IMPORTANTE: usar descargarArchivo (fetch + Blob) en lugar de
    // window.open, porque window.open NO puede añadir el header
    // Authorization: Bearer y en producción el endpoint devuelve
    // 401 "No autorizado. Token requerido."
    setExportando(true)
    const ok = await descargarArchivo(`/api/export?formato=${formato}`)
    setExportando(false)
    if (!ok) {
      toast({
        title: 'No se pudo exportar',
        description: 'Verifica tu sesión e intenta nuevamente.',
        variant: 'destructive',
      })
    }
  }

  const tarjetas = [
    {
      titulo: 'Exportación JSON Completa',
      descripcion:
        'Descarga toda la base de datos en formato JSON estructurado. Incluye: clientes, solicitudes, pagos, casos jurídicos, cronología, documentos, alertas, notificaciones, OTP de Firma Electrónica, hashes de PIN del portal y accesos del portal con sus relaciones.',
      icon: FileJson,
      color: 'bg-violet-500/15 text-violet-300',
      accion: () => descargar('json'),
      boton: 'Descargar JSON',
      incluye: [
        'Datos de clientes (nombre, cédula, contacto, salario)',
        'Solicitudes con todas las variables bancarias',
        'Tabla de amortización completa por solicitud',
        'Historial de pagos detallado',
        'Casos jurídicos con cronología y alertas',
        'Log de notificaciones WhatsApp enviadas',
        'Firmas Electrónicas con OTP (FirmaElectronica)',
        'Hashes de PIN de acceso al portal',
        'Accesos del portal (AccesoPortal)',
        'Tokens de sesión y firma',
        'Metadata con fechas y conteos',
      ],
    },
    {
      titulo: 'Exportación CSV (Excel)',
      descripcion:
        'Descarga los datos en formato CSV compatible con Excel y Google Sheets. Cada entidad se separa en su propia sección para fácil análisis tabular. Incluye las tablas de datos sensibles (PIN, OTP, accesos).',
      icon: FileSpreadsheet,
      color: 'bg-emerald-500/15 text-emerald-300',
      accion: () => descargar('csv'),
      boton: 'Descargar CSV',
      incluye: [
        'Clientes con todos sus campos',
        'Solicitudes con saldos y estado',
        'Pagos con método y referencia',
        'Casos jurídicos con abogado y estado',
        'Notificaciones enviadas',
        'OTP de Firma Electrónica (estado y canal)',
        'Hashes de PIN del portal',
        'Accesos del portal (login, intentos, etc.)',
        'Compatible con Excel / Google Sheets',
        'Codificación UTF-8',
      ],
    },
  ]

  // Datos sensibles incluidos en la exportación
  const datosSensibles = [
    {
      titulo: 'PIN de Acceso',
      descripcion:
        'Hash bcrypt del PIN de 4-6 dígitos que los clientes usan para acceder al portal de consulta. Almacenado en la tabla Configuracion con clave PORTAL_PIN_{cedula}.',
      icon: KeyRound,
      color: 'bg-red-500/15 text-red-300 border-red-400/30',
      detalle: 'bcrypt rounds=10 · 4-6 dígitos numéricos',
    },
    {
      titulo: 'OTP de T&C',
      descripcion:
        'Códigos OTP de 6 dígitos enviados por WhatsApp/Email para validar la aceptación de Términos y Condiciones y la firma electrónica de pagarés. Incluye canal, fecha de envío y validación.',
      icon: Lock,
      color: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
      detalle: 'OTP 6 dígitos · max 5 intentos',
    },
    {
      titulo: 'Accesos al Portal',
      descripcion:
        'Log completo de accesos del cliente al portal: login exitoso, intentos fallidos, logout, cambio de PIN, verificación de cédula. Incluye IP origen y User-Agent.',
      icon: Eye,
      color: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
      detalle: 'IP + User-Agent + metadata JSON',
    },
    {
      titulo: 'Tokens de Sesión',
      descripcion:
        'Tokens de sesión del portal (8h de expiración) y tokens públicos de firma (acceso sin login desde enlace seguro). Permite trazabilidad de acciones realizadas.',
      icon: Fingerprint,
      color: 'bg-violet-500/15 text-violet-300 border-violet-400/30',
      detalle: 'Session 8h · Token firma 7d',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exportar Base de Datos"
        subtitle="Descarga completa de toda la información del sistema (incluye datos sensibles)"
        icon={<Database className="w-5 h-5" />}
      />

      {/* Advertencia de datos sensibles */}
      <Card className="border-red-500/30 bg-red-500/5">
        <CardContent className="p-5 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-red-200 mb-1">
              ⚠️ Advertencia: La exportación contiene datos sensibles
            </p>
            <p className="text-muted-foreground">
              La exportación incluye información confidencial como <strong>OTP de Firma Electrónica</strong>,
              <strong> hashes de PIN de acceso al portal</strong>, <strong>accesos del portal</strong> (con IP y User-Agent)
              y <strong>tokens de sesión/firma</strong>. Este archivo debe almacenarse de forma segura, cifrado en reposo,
              y solo personal autorizado (rol ADMIN) debe tener acceso. NO compartir por canales inseguros.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">Backup completo de información</p>
            <p className="text-muted-foreground">
              La exportación incluye todas las variables registradas en el sistema:
              datos de clientes, solicitudes con su cálculo financiero completo, historial de pagos,
              casos jurídicos con su seguimiento cronológico, alertas, documentos, notificaciones
              WhatsApp enviadas, firmas electrónicas con OTP, accesos al portal y tokens de sesión.
              El archivo se descarga con la fecha de exportación en el nombre.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Datos Sensibles Incluidos */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <h2 className="text-lg font-semibold">Datos Sensibles Incluidos</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {datosSensibles.map((d, i) => {
            const Icon = d.icon
            return (
              <Card key={i} className={`border ${d.color}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-sm">{d.titulo}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{d.descripcion}</p>
                      <div className="inline-block px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-foreground/70">
                        {d.detalle}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tarjetas.map((t, i) => {
          const Icon = t.icon
          return (
            <Card key={i} className="overflow-hidden glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base">{t.titulo}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{t.descripcion}</p>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Incluye
                  </p>
                  <ul className="space-y-1.5">
                    {t.incluye.map((item, j) => (
                      <li key={j} className="text-sm flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button onClick={t.accion} disabled={exportando} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  {exportando ? 'Exportando…' : t.boton}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Información sobre el Modelo de Datos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-muted/30 rounded-md border border-white/10">
              <p className="font-semibold">Clientes</p>
              <p className="text-xs text-muted-foreground mt-1">
                Empleados con datos completos: nombre, cédula, teléfono WhatsApp, email, cargo,
                departamento, salario, fecha de ingreso, dirección, notas.
              </p>
            </div>
            <div className="p-3 bg-muted/30 rounded-md border border-white/10">
              <p className="font-semibold">Solicitudes</p>
              <p className="text-xs text-muted-foreground mt-1">
                Variables bancarias: monto principal, tasa anual fija, tasa moratoria, plazo,
                frecuencia, número de cuotas, cuota fija calculada, total interés, total a pagar,
                saldos, estado, fechas de solicitud/aprobación/desembolso/vencimiento.
              </p>
            </div>
            <div className="p-3 bg-muted/30 rounded-md border border-white/10">
              <p className="font-semibold">Pagos</p>
              <p className="text-xs text-muted-foreground mt-1">
                Registro por cuota: número, capital, interés, mora, total, fecha de pago,
                fecha de vencimiento, método de pago, referencia, estado.
              </p>
            </div>
            <div className="p-3 bg-muted/30 rounded-md border border-white/10">
              <p className="font-semibold">Jurídico</p>
              <p className="text-xs text-muted-foreground mt-1">
                Casos con estado, abogado (nombre/teléfono/email), honorarios, juzgado, radicado,
                descripción, cronología de eventos, alertas y documentos asociados.
              </p>
            </div>
            <div className="p-3 bg-muted/30 rounded-md border border-white/10">
              <p className="font-semibold">Notificaciones</p>
              <p className="text-xs text-muted-foreground mt-1">
                Log completo de WhatsApp enviados: tipo (solicitud/pago/cancelación/recordatorio/mora/legal),
                mensaje, estado, error, fecha.
              </p>
            </div>
            <div className="p-3 bg-muted/30 rounded-md border border-white/10">
              <p className="font-semibold">Documentos legales</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pagarés y cartas de instrucciones generados automáticamente con tabla de amortización
                y datos completos del crédito.
              </p>
            </div>
            <div className="p-3 bg-red-500/5 rounded-md border border-red-400/20">
              <p className="font-semibold text-red-300">Firma Electrónica (OTP)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Registros de firmas electrónicas con OTP enviado, validado, canal (WhatsApp/Email),
                intentos, fotos del documento y selfie con hash SHA-256, IP y geolocalización.
              </p>
            </div>
            <div className="p-3 bg-red-500/5 rounded-md border border-red-400/20">
              <p className="font-semibold text-red-300">Acceso al Portal</p>
              <p className="text-xs text-muted-foreground mt-1">
                Log de accesos al portal del cliente: login, intentos fallidos, logout, cambio de PIN,
                con IP origen, User-Agent, metadata y timestamps.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
