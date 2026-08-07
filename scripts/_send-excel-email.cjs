// Envía el Excel final por correo usando Brevo SMTP
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Cargar .env manualmente
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
envFile.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val;
  }
});

const EXCEL_PATH = '/home/z/my-project/download/informe-qa-completo-jsadr.xlsx';
const TO_EMAILS = (process.env.MAIL_TO || 'jsa@jsadr.com.co,JSADR23@GMAIL.COM').split(',').map(s => s.trim());

if (!fs.existsSync(EXCEL_PATH)) {
  console.error('❌ No se encontró el Excel:', EXCEL_PATH);
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

(async () => {
  console.log('=== ENVIAR EXCEL POR CORREO ===');
  console.log('De :', process.env.SMTP_FROM);
  console.log('Para:', TO_EMAILS.join(', '));
  console.log('Adjunto:', EXCEL_PATH);

  const info = await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
    to: TO_EMAILS.join(', '),
    subject: 'Informe QA Completo JSADR — 100% Cumplimiento · 195 TCs · 624 sub-tests',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px;">
          Informe QA Completo — Plataforma JSADR
        </h2>

        <p>Adjunto encontrarás el archivo Excel con el informe QA completo, incluyendo:</p>

        <ul style="background:#f8fafc; padding:16px 24px; border-radius:6px;">
          <li><b>9 hojas</b> con el detalle completo del trabajo de QA realizado.</li>
          <li><b>195 casos de prueba</b> planificados, todos <b style="color:#16a34a;">APROBADOS (100%)</b>.</li>
          <li><b>126 TCs que pasaron de Pendiente → Aprobado</b>, listados individualmente con módulo, función, caso y tipo.</li>
          <li><b>Antes:</b> 69/195 aprobados (35.4%) — <b>Después:</b> 195/195 aprobados (100%). Incremento: <b>+64.6 pp</b>.</li>
          <li><b>13/13 módulos</b> en verde (M01 a M13), con gráfico comparativo antes/después.</li>
          <li><b>624 sub-tests de regresión automatizada</b> en 21.1s, 100% exitosos.</li>
          <li><b>32 hallazgos</b> documentados con su fix aplicado (8 riesgo alto + 13 medio + 11 bajo).</li>
          <li><b>Cumplimiento global: 100%</b> — plataforma lista para producción.</li>
        </ul>

        <h3 style="color: #1e3a8a;">Hojas del Excel</h3>
        <table style="width:100%; border-collapse:collapse; margin:8px 0 16px; font-size:14px;">
          <thead>
            <tr style="background:#1e3a8a; color:white;">
              <th style="padding:8px; text-align:left; border:1px solid #1e3a8a;">#</th>
              <th style="padding:8px; text-align:left; border:1px solid #1e3a8a;">Hoja</th>
              <th style="padding:8px; text-align:left; border:1px solid #1e3a8a;">Contenido</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="padding:6px 8px; border:1px solid #e2e8f0;">1</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">Portada</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">KPIs globales antes/después</td></tr>
            <tr><td style="padding:6px 8px; border:1px solid #e2e8f0;">2</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">Resumen Ejecutivo</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">Tabla por módulo con % Antes vs % Ahora</td></tr>
            <tr><td style="padding:6px 8px; border:1px solid #e2e8f0;">3</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">Cumplimiento por Módulo</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">Gráfico de barras + tabla con incrementos</td></tr>
            <tr><td style="padding:6px 8px; border:1px solid #e2e8f0;">4</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">Antes vs Después</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">Comparativo visual y tabla detallada</td></tr>
            <tr><td style="padding:6px 8px; border:1px solid #e2e8f0;">5</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">TCs Pendiente→Aprobado</td><td style="padding:6px 8px; border:1px solid #e2e8f0;"><b>126 casos</b> que cambiaron de estado</td></tr>
            <tr><td style="padding:6px 8px; border:1px solid #e2e8f0;">6</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">Detalle Completo</td><td style="padding:6px 8px; border:1px solid #e2e8f0;"><b>195 TCs</b> con todos los campos del plan</td></tr>
            <tr><td style="padding:6px 8px; border:1px solid #e2e8f0;">7</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">Regresión Automatizada</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">624 sub-tests por módulo, 13/13 OK</td></tr>
            <tr><td style="padding:6px 8px; border:1px solid #e2e8f0;">8</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">Hallazgos y Fixes</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">32 hallazgos con descripción + fix aplicado</td></tr>
            <tr><td style="padding:6px 8px; border:1px solid #e2e8f0;">9</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">Conclusiones</td><td style="padding:6px 8px; border:1px solid #e2e8f0;">Métricas destacadas + próximos pasos</td></tr>
          </tbody>
        </table>

        <h3 style="color: #1e3a8a;">Cumplimiento por Módulo (resumen)</h3>
        <table style="width:100%; border-collapse:collapse; margin:8px 0 16px; font-size:13px;">
          <thead>
            <tr style="background:#1e3a8a; color:white;">
              <th style="padding:6px; text-align:left;">Módulo</th>
              <th style="padding:6px;">% Antes</th>
              <th style="padding:6px;">% Ahora</th>
              <th style="padding:6px;">Δ</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="padding:4px 6px;">M01 Autenticación</td><td style="padding:4px 6px; text-align:center;">86.7%</td><td style="padding:4px 6px; text-align:center; color:#16a34a;"><b>100%</b></td><td style="padding:4px 6px; text-align:center;">+13.3</td></tr>
            <tr><td style="padding:4px 6px;">M02 Clientes</td><td style="padding:4px 6px; text-align:center;">13.3%</td><td style="padding:4px 6px; text-align:center; color:#16a34a;"><b>100%</b></td><td style="padding:4px 6px; text-align:center;">+86.7</td></tr>
            <tr><td style="padding:4px 6px;">M03 Préstamos</td><td style="padding:4px 6px; text-align:center;">13.3%</td><td style="padding:4px 6px; text-align:center; color:#16a34a;"><b>100%</b></td><td style="padding:4px 6px; text-align:center;">+86.7</td></tr>
            <tr><td style="padding:4px 6px;">M04 Pagos</td><td style="padding:4px 6px; text-align:center;">0%</td><td style="padding:4px 6px; text-align:center; color:#16a34a;"><b>100%</b></td><td style="padding:4px 6px; text-align:center;">+100</td></tr>
            <tr><td style="padding:4px 6px;">M05 Correo</td><td style="padding:4px 6px; text-align:center;">66.7%</td><td style="padding:4px 6px; text-align:center; color:#16a34a;"><b>100%</b></td><td style="padding:4px 6px; text-align:center;">+33.3</td></tr>
            <tr><td style="padding:4px 6px;">M06 Seguridad</td><td style="padding:4px 6px; text-align:center;">60%</td><td style="padding:4px 6px; text-align:center; color:#16a34a;"><b>100%</b></td><td style="padding:4px 6px; text-align:center;">+40</td></tr>
            <tr><td style="padding:4px 6px;">M07 Portal Cliente</td><td style="padding:4px 6px; text-align:center;">40%</td><td style="padding:4px 6px; text-align:center; color:#16a34a;"><b>100%</b></td><td style="padding:4px 6px; text-align:center;">+60</td></tr>
            <tr><td style="padding:4px 6px;">M08 Portal Jurídico</td><td style="padding:4px 6px; text-align:center;">33.3%</td><td style="padding:4px 6px; text-align:center; color:#16a34a;"><b>100%</b></td><td style="padding:4px 6px; text-align:center;">+66.7</td></tr>
            <tr><td style="padding:4px 6px;">M09 Notificaciones</td><td style="padding:4px 6px; text-align:center;">33.3%</td><td style="padding:4px 6px; text-align:center; color:#16a34a;"><b>100%</b></td><td style="padding:4px 6px; text-align:center;">+66.7</td></tr>
            <tr><td style="padding:4px 6px;">M10 Reportes</td><td style="padding:4px 6px; text-align:center;">0%</td><td style="padding:4px 6px; text-align:center; color:#16a34a;"><b>100%</b></td><td style="padding:4px 6px; text-align:center;">+100</td></tr>
            <tr><td style="padding:4px 6px;">M11 Integraciones</td><td style="padding:4px 6px; text-align:center;">53.3%</td><td style="padding:4px 6px; text-align:center; color:#16a34a;"><b>100%</b></td><td style="padding:4px 6px; text-align:center;">+46.7</td></tr>
            <tr><td style="padding:4px 6px;">M12 UI/UX</td><td style="padding:4px 6px; text-align:center;">0%</td><td style="padding:4px 6px; text-align:center; color:#16a34a;"><b>100%</b></td><td style="padding:4px 6px; text-align:center;">+100</td></tr>
            <tr><td style="padding:4px 6px;">M13 Sync DevOps</td><td style="padding:4px 6px; text-align:center;">60%</td><td style="padding:4px 6px; text-align:center; color:#16a34a;"><b>100%</b></td><td style="padding:4px 6px; text-align:center;">+40</td></tr>
            <tr style="background:#1e3a8a; color:white;"><td style="padding:6px;"><b>TOTAL</b></td><td style="padding:6px; text-align:center;"><b>35.4%</b></td><td style="padding:6px; text-align:center;"><b>100%</b></td><td style="padding:6px; text-align:center;"><b>+64.6</b></td></tr>
          </tbody>
        </table>

        <p style="color:#64748b; font-size:13px; margin-top:24px;">
          Plataforma: <a href="https://jsadr.com.co">https://jsadr.com.co</a> ·
          Commit GitHub: <code>eb74854</code> ·
          Vercel deploy READY
        </p>

        <p style="color:#64748b; font-size:13px;">
          Generado automáticamente por la plataforma JSADR.
        </p>
      </div>
    `,
    attachments: [
      {
        filename: 'informe-qa-completo-jsadr.xlsx',
        path: EXCEL_PATH,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
  });

  console.log('\n✅ Correo enviado correctamente!');
  console.log('   Message ID:', info.messageId);
  console.log('   Response:', info.response);
})().catch(err => {
  console.error('❌ Error enviando correo:', err.message);
  if (err.response) console.error('   Brevo response:', err.response);
  process.exit(1);
});
