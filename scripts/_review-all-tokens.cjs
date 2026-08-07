// _review-all-tokens.cjs
// Revisa los tokens guardados en PlataformaSync para GITHUB, VERCEL y NEON.
// Como las 3 plataformas no expiran los tokens automaticamente, los tokens
// guardados pueden seguir siendo validos aunque la API_ENCRYPTION_KEY haya
// cambiado. Intenta descifrar con multiples llaves candidatas y luego
// prueba cada token descifrado contra la API real.

const fs = require('fs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

// --- 1. Cargar .env manualmente (mas robusto que dotenv) ---
const envPath = '/home/z/my-project/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
console.log('DATABASE_URL presente:', !!DATABASE_URL);

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL + '&connect_timeout=60&pool_timeout=60' } },
  log: ['error'],
});

// --- 2. Llaves candidatas para descifrar ---
const BACKUP_KEY_SEED =
  'JSADR-AURORA-BANCARIA-BACKUP-KEY-v1-' +
  'a7f3c9e1b2d4856f9a0c3e7d8b1f4a2c5e8d7b0a3f6c9e1d2b5a8f0c3e6d9b2a5' +
  'f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4c7b0a3e6d9b2a5f8e1d4';

const candidates = [
  ['API_ENCRYPTION_KEY(hex) actual', (() => {
    const raw = process.env.API_ENCRYPTION_KEY;
    if (!raw) return null;
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    return null;
  })()],
  ['API_ENCRYPTION_KEY(sha256) actual', (() => {
    const raw = process.env.API_ENCRYPTION_KEY;
    if (!raw) return null;
    return crypto.createHash('sha256').update(raw).digest();
  })()],
  ['BACKUP_KEY_SEED(sha256)', crypto.createHash('sha256').update(BACKUP_KEY_SEED).digest()],
  ['dev-temp-encryption-key(sha256)', crypto.createHash('sha256').update('dev-temp-encryption-key').digest()],
  ['jsadr-secret-key(sha256)', crypto.createHash('sha256').update('jsadr-secret-key').digest()],
  ['jsadr(sha256)', crypto.createHash('sha256').update('jsadr').digest()],
].filter(c => c[1] !== null);

console.log('\nLlaves candidatas a probar:', candidates.length);

// --- 3. Funcion de descifrado AES-256-CBC ---
function tryDecrypt(encryptedText, keyBuf) {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
    let dec = decipher.update(parts[1], 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (e) {
    return null;
  }
}

// --- 4. Probar token contra cada API real ---
async function testGitHubToken(token) {
  try {
    const r = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (r.ok) {
      const data = await r.json();
      return { ok: true, detail: `user: ${data.login} | scope OK` };
    }
    const txt = await r.text();
    return { ok: false, detail: `HTTP ${r.status}: ${txt.substring(0, 150)}` };
  } catch (e) {
    return { ok: false, detail: `ERR: ${e.message}` };
  }
}

async function testVercelToken(token) {
  try {
    const r = await fetch('https://api.vercel.com/v2/user', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      const data = await r.json();
      return { ok: true, detail: `user: ${data.user?.email || data.user?.username || 'OK'}` };
    }
    const txt = await r.text();
    return { ok: false, detail: `HTTP ${r.status}: ${txt.substring(0, 150)}` };
  } catch (e) {
    return { ok: false, detail: `ERR: ${e.message}` };
  }
}

async function testNeonToken(token) {
  try {
    const r = await fetch('https://console.neon.tech/api/v2/projects', {
      headers: { 'X-Neon-Api-Key': token, Accept: 'application/json' },
    });
    if (r.ok) {
      const data = await r.json();
      const n = data.projects?.length ?? '?';
      return { ok: true, detail: `${n} proyectos accesibles` };
    }
    const txt = await r.text();
    return { ok: false, detail: `HTTP ${r.status}: ${txt.substring(0, 150)}` };
  } catch (e) {
    return { ok: false, detail: `ERR: ${e.message}` };
  }
}

// --- 5. Main ---
(async () => {
  const resultado = { GITHUB: null, VERCEL: null, NEON: null };

  try {
    const all = await prisma.plataformaSync.findMany({
      orderBy: { plataforma: 'asc' },
    });

    console.log(`\n=== ${all.length} registros en PlataformaSync ===\n`);

    for (const p of all) {
      console.log('----------------------------------------');
      console.log(`Plataforma: ${p.plataforma}`);
      console.log(`  activo: ${p.activo}`);
      console.log(`  ultimoEstado: ${p.ultimoEstado ?? '(null)'}`);
      console.log(`  ultimoError: ${(p.ultimoError || '').substring(0, 120)}`);
      console.log(`  webhookUrl: ${p.webhookUrl || '(null)'}`);
      console.log(`  tokenCifrado: ${p.tokenCifrado ? `[${p.tokenCifrado.length} chars]` : '(null)'}`);
      console.log(`  actualizadoEn: ${p.actualizadoEn?.toISOString?.() || p.actualizadoEn}`);

      if (!p.tokenCifrado) {
        console.log('  ❌ Sin token guardado');
        resultado[p.plataforma] = { estado: 'SIN_TOKEN' };
        continue;
      }

      // Probar descifrado con cada llave candidata
      let tokenDescifrado = null;
      let llaveUsada = null;
      for (const [name, key] of candidates) {
        const dec = tryDecrypt(p.tokenCifrado, key);
        if (dec && dec.length > 5) {
          tokenDescifrado = dec;
          llaveUsada = name;
          break;
        }
      }

      if (!tokenDescifrado) {
        console.log('  ❌ No se pudo descifrar con ninguna llave candidata');
        resultado[p.plataforma] = { estado: 'NO_DESCIFRABLE', tokenLength: p.tokenCifrado.length };
        continue;
      }

      console.log(`  ✅ Descifrado OK con: ${llaveUsada}`);
      console.log(`     Longitud: ${tokenDescifrado.length} chars`);
      console.log(`     Inicio: ${tokenDescifrado.substring(0, 12)}...`);
      console.log(`     Fin: ...${tokenDescifrado.slice(-8)}`);

      // Mostrar mascara segun prefijo conocido
      let mascara = '';
      if (tokenDescifrado.startsWith('ghp_')) mascara = 'GitHub PAT (classic)';
      else if (tokenDescifrado.startsWith('github_pat_')) mascara = 'GitHub PAT (fine-grained)';
      else if (tokenDescifrado.startsWith('vcp_')) mascara = 'Vercel personal token';
      else if (/^[a-f0-9]{64}$/i.test(tokenDescifrado)) mascara = 'Hex 64 (Neon API key?)';
      console.log(`     Tipo probable: ${mascara || 'desconocido'}`);

      // Probar contra la API real
      let testRes = null;
      if (p.plataforma === 'GITHUB') {
        testRes = await testGitHubToken(tokenDescifrado);
      } else if (p.plataforma === 'VERCEL') {
        testRes = await testVercelToken(tokenDescifrado);
      } else if (p.plataforma === 'NEON') {
        testRes = await testNeonToken(tokenDescifrado);
      }

      if (testRes) {
        console.log(`     Prueba API: ${testRes.ok ? '✅ VALIDO' : '❌ INVALIDO'} — ${testRes.detail}`);
      }

      resultado[p.plataforma] = {
        estado: testRes?.ok ? 'VALIDO' : (testRes ? 'INVALIDO_API' : 'NO_PROBADO'),
        llaveUsada,
        tokenLength: tokenDescifrado.length,
        tokenPrefijo: tokenDescifrado.substring(0, 12),
        tokenFinal: tokenDescifrado.slice(-8),
        tipoProbable: mascara,
        tokenCompleto: tokenDescifrado,
        apiDetail: testRes?.detail,
      };
    }

    // Resumen final
    console.log('\n\n========================================');
    console.log('=== RESUMEN FINAL ===');
    console.log('========================================');
    for (const [plat, res] of Object.entries(resultado)) {
      console.log(`${plat}: ${res?.estado}`);
      if (res?.llaveUsada) console.log(`  Llave: ${res.llaveUsada}`);
      if (res?.apiDetail) console.log(`  API: ${res.apiDetail}`);
    }

    // Guardar resultado en JSON para uso posterior
    fs.writeFileSync(
      '/home/z/my-project/scripts/_tokens-review-result.json',
      JSON.stringify(
        Object.fromEntries(
          Object.entries(resultado).map(([k, v]) => [
            k,
            v?.tokenCompleto ? { ...v, tokenCompleto: v.tokenCompleto.substring(0, 12) + '...' + v.tokenCompleto.slice(-8) } : v,
          ]),
        ),
        null,
        2,
      ),
    );

    // Guardar tokens completos en archivo separado (no se imprime en consola)
    const validos = Object.fromEntries(
      Object.entries(resultado).filter(([, v]) => v?.estado === 'VALIDO' && v?.tokenCompleto),
    );
    if (Object.keys(validos).length > 0) {
      const tokensFile = {};
      for (const [k, v] of Object.entries(validos)) tokensFile[k] = v.tokenCompleto;
      fs.writeFileSync('/home/z/my-project/scripts/_tokens-recovered.json', JSON.stringify(tokensFile, null, 2));
      console.log(`\n✅ ${Object.keys(validos).length} token(s) validos guardados en _tokens-recovered.json`);
    } else {
      console.log('\n⚠️  Ningun token valido recuperado.');
    }
  } catch (e) {
    console.error('ERR:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
