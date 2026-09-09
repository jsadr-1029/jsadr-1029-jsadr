import fs from 'fs';
const pdfPath = '/home/z/my-project/download/caso_ejemplo_regularizacion_inteligente.pdf';
const pdfBuffer = fs.readFileSync(pdfPath);
const pdfBase64 = pdfBuffer.toString('base64');
console.log('PDF size:', pdfBuffer.length, 'bytes');
console.log('Base64 size:', pdfBase64.length, 'chars');
