// Verificar DNS consultando directamente los nameservers de MiCom.co
const dns = require('dns');

function queryDNS(server, domain, type) {
  return new Promise((resolve) => {
    const resolver = new dns.Resolver();
    resolver.setServers([server]);
    resolver.resolve(domain, type, (err, addresses) => {
      if (err) {
        resolve({ server, type, domain, error: err.code });
      } else {
        resolve({ server, type, domain, addresses });
      }
    });
  });
}

(async () => {
  console.log('=== Consulta directa a MiCom nameservers ===\n');
  
  const targets = [
    { server: '52.45.124.85', label: 'nameserver01' },
    { server: '44.253.50.94', label: 'nameserver02' },
    { server: '56.126.23.240', label: 'nameserver03' },
    { server: '63.180.140.204', label: 'nameserver04' },
  ];

  for (const t of targets) {
    console.log(`\n--- ${t.label} (${t.server}) ---`);
    const aResult = await queryDNS(t.server, 'jsadr.com.co', 'A');
    console.log(`  A jsadr.com.co: ${aResult.addresses ? JSON.stringify(aResult.addresses) : '❌ ' + aResult.error}`);
    
    const cnameResult = await queryDNS(t.server, 'www.jsadr.com.co', 'CNAME');
    console.log(`  CNAME www.jsadr.com.co: ${cnameResult.addresses ? JSON.stringify(cnameResult.addresses) : '❌ ' + cnameResult.error}`);
  }
})();
