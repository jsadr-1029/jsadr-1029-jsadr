// Reenvía el enlace de firma electrónica al cliente Isabel Cristina Benítez Ospina
// Préstamo ICB-CC-1077430375-20261022-01
//
// Estrategia: invocar el endpoint /api/firma con accion 'iniciar_firma'
// Esto crea una nueva FirmaElectronica + TokenFirma y envía el correo
// automáticamente al cliente con el enlace de firma.
//
// NO activa ni completa la firma. El cliente debe completar el flujo:
// subir fotos → dibujar firma → enviar OTP → validar OTP → guardar firma.

const PRESTAMO_ID = 'cmvjue0ig0001jq08mxaikzg9';
const CLIENTE_ID = '8a3fbec6-b62f-44ce-90b6-d7c51e28862b';

async function main() {
  const body = {
    accion: 'iniciar_firma',
    prestamoId: PRESTAMO_ID,
    clienteId: CLIENTE_ID,
    tipo: 'TYC',
    canal: 'AMBOS', // Enviar por WhatsApp y Email
  };

  console.log('=== REENVÍO DE ENLACE DE FIRMA ELECTRÓNICA ===');
  console.log('Préstamo: ICB-CC-1077430375-20261022-01');
  console.log('Cliente: Isabel Cristina Benítez Ospina');
  console.log('Email: icbocata@gmail.com');
  console.log('Teléfono: 3233208062');
  console.log('\nInvocando /api/firma con accion=iniciar_firma...\n');

  const res = await fetch('https://jsadr.com.co/api/firma', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://jsadr.com.co',
      'Referer': 'https://jsadr.com.co/',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(json, null, 2));

  if (json.success) {
    console.log('\n✓ ÉXITO:');
    console.log('  Firma ID:', json.data?.firmaId);
    console.log('  Token:', json.data?.token?.substring(0, 20) + '...');
    console.log('  Enlace:', json.data?.linkFirma);
    console.log('  Enlace codeudor:', json.data?.linkFirmaCodeudor || 'N/A');
    console.log('\nEl correo ha sido enviado a icbocata@gmail.com');
    console.log('La firma NO está activada. El cliente debe completar el flujo.');
  } else {
    console.log('\n✗ ERROR:', json.error);
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
