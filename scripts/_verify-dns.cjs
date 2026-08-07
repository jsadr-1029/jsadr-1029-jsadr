// Verificar propagación DNS del dominio jsadr.com.co
const dns = require('dns').promises;

(async () => {
  console.log('=== Verificación DNS de jsadr.com.co ===\n');
  
  const targets = [
    { name: 'jsadr.com.co', type: 'A' },
    { name: 'www.jsadr.com.co', type: 'CNAME' },
    { name: 'www.jsadr.com.co', type: 'A' },
    { name: 'jsadr.com.co', type: 'NS' },
    { name: 'jsadr.com.co', type: 'MX' },
    { name: 'jsadr.com.co', type: 'TXT' },
  ];

  for (const t of targets) {
    try {
      const result = await dns.resolve(t.name, t.type);
      console.log(`✅ ${t.type} ${t.name}:`, JSON.stringify(result));
    } catch (e) {
      console.log(`❌ ${t.type} ${t.name}: ${e.code || e.message}`);
    }
  }

  // Verificar si la IP de Vercel ya responde
  console.log('\n=== Resolución esperada ===');
  console.log('A jsadr.com.co → 76.76.21.21 (Vercel)');
  console.log('CNAME www.jsadr.com.co → cname.vercel-dns.com');
})().catch(e => console.error('ERR:', e));
