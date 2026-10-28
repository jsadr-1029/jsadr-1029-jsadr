// Reenvía el enlace de firma electrónica al cliente Paula Andrea Cano
// Préstamo PAC-CC-1036671139-20261020-01
//
// NO activa ni completa la firma. La cliente debe completar el flujo:
// subir fotos → dibujar firma → enviar OTP → validar OTP → guardar firma.

const PRESTAMO_ID = 'cmvhlm3a20001l208xv48w5x8';
const CLIENTE_ID = 'cmvhf3tno0001l507bon6l3ey';

async function main() {
  const body = {
    accion: 'iniciar_firma',
    prestamoId: PRESTAMO_ID,
    clienteId: CLIENTE_ID,
    tipo: 'TYC',
    canal: 'AMBOS', // Enviar por WhatsApp y Email
  };

  console.log('=== REENVÍO DE ENLACE DE FIRMA ELECTRÓNICA ===');
  console.log('Préstamo: PAC-CC-1036671139-20261020-01');
  console.log('Cliente: Paula Andrea Cano');
  console.log('Email: paulaandreacanorivero@gmail.com');
  console.log('Teléfono: 3192151883');
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
    console.log('\nEnvíos:');
    console.log('  WhatsApp deudor:', json.data?.envios?.whatsappDeudor);
    console.log('  Email deudor:', json.data?.envios?.emailDeudor);
    console.log('\nLa firma NO está activada. La cliente debe completar el flujo.');
  } else {
    console.log('\n✗ ERROR:', json.error);
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
