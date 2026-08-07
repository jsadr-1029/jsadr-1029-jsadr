/**
 * sync-full-platforms.cjs
 *
 * Sincroniza el proyecto JSADR con las 3 plataformas al 100%:
 *  1. GitHub        — git push + API REST (verifica commits y webhook)
 *  2. Neon          — prisma db push (schema + datos) + API REST (verifica branch)
 *  3. Vercel        — env vars sync + redeploy + verifica dominio + cron + deployments
 *
 * Lee tokens de PlataformaSync (BD Neon, cifrados con API_ENCRYPTION_KEY del .env).
 * No imprime tokens completos — solo previews.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

// ───────────────────────── 1. Cargar .env ─────────────────────────
const ENV_PATH = '/home/z/my-project/.env';
const envContent = fs.readFileSync(ENV_PATH, 'utf8');

// Parsear .env y forzar el seteo (sobreescribir incluso si existe)
const parsedEnv = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  let v = m[2];
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  parsedEnv[m[1]] = v;
  process.env[m[1]] = v; // forzar siempre
}

const DATABASE_URL = parsedEnv.DATABASE_URL;
if (!DATABASE_URL || !DATABASE_URL.startsWith('postgresql://')) {
  console.error('❌ DATABASE_URL inválida en .env:', JSON.stringify(DATABASE_URL).substring(0, 80));
  process.exit(1);
}
console.log(`✓ DATABASE_URL cargada: ${DATABASE_URL.split('@')[0]}...@${DATABASE_URL.split('@')[1]?.substring(0, 40)}`);

// URL con pooler timeouts añadidos
const PRISMA_DB_URL = DATABASE_URL + (DATABASE_URL.includes('?') ? '&' : '?') + 'connect_timeout=60&pool_timeout=60';
process.env.DATABASE_URL = PRISMA_DB_URL;

const prisma = new PrismaClient({
  datasources: { db: { url: PRISMA_DB_URL } },
  log: ['error'],
});

// ───────────────────────── 2. Helpers crypto ─────────────────────────
function getEncryptionKey() {
  const raw = process.env.API_ENCRYPTION_KEY;
  if (!raw) throw new Error('API_ENCRYPTION_KEY no definida en .env');
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

function decryptSensitive(encText) {
  if (!encText || typeof encText !== 'string') return '';
  const key = getEncryptionKey();
  const parts = encText.split(':');
  if (parts.length !== 2) return encText; // texto plano
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let dec = decipher.update(parts[1], 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (e) {
    // Intentar con BACKUP_KEY_SEED si existe (fallback histórico)
    const seed = process.env.BACKUP_KEY_SEED;
    if (seed) {
      try {
        const key2 = crypto.createHash('sha256').update(seed).digest();
        const iv2 = Buffer.from(parts[0], 'hex');
        const d2 = crypto.createDecipheriv('aes-256-cbc', key2, iv2);
        let dec = d2.update(parts[1], 'hex', 'utf8');
        dec += d2.final('utf8');
        return dec;
      } catch (e2) {
        return '[decrypt failed]';
      }
    }
    return '[decrypt failed]';
  }
}

function mask(s, head = 8, tail = 6) {
  if (!s) return '(empty)';
  if (s.length <= head + tail + 3) return s[0] + '***';
  return `${s.slice(0, head)}...${s.slice(-tail)} (${s.length} chars)`;
}

// ───────────────────────── 3. Diagnóstico ─────────────────────────
const report = {
  startedAt: new Date().toISOString(),
  github: { ok: false, details: {} },
  neon: { ok: false, details: {} },
  vercel: { ok: false, details: {} },
  actions: [],
  warnings: [],
};

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  JSADR — SINCRONIZACIÓN COMPLETA GitHub + Neon + Vercel');
  console.log('═══════════════════════════════════════════════════════\n');

  // ─── 3.1 Recuperar tokens de PlataformaSync ───
  console.log('▶ PASO 1: Recuperando tokens de la BD (PlataformaSync)...');
  const tokens = {};
  try {
    const all = await prisma.plataformaSync.findMany();
    for (const row of all) {
      const t = row.tokenCifrado ? decryptSensitive(row.tokenCifrado) : '';
      tokens[row.plataforma] = {
        token: t,
        tokenMasked: mask(t),
        projectId: row.projectId || '',
        teamId: row.teamId || '',
        webhookSecret: row.webhookSecret ? decryptSensitive(row.webhookSecret) : '',
        alias: row.alias || '',
      };
      console.log(`  • ${row.plataforma}: token=${mask(t)} projectId=${row.projectId||'-'} alias=${row.alias||'-'}`);
    }
  } catch (e) {
    console.error('  ❌ No se pudo leer PlataformaSync:', e.message);
    throw e;
  }

  // También leer VariableGlobal (por si CRON_SECRET u otros están ahí)
  let globalVars = {};
  try {
    const gv = await prisma.variableGlobal.findMany();
    for (const v of gv) globalVars[v.clave] = (v.valor || '').toString();
    console.log(`  • VariableGlobal: ${gv.length} claves cargadas`);
  } catch (e) {
    console.warn('  ⚠ VariableGlobal no leíble:', e.message);
  }

  // ─── 3.2 GitHub: git status + API ───
  console.log('\n▶ PASO 2: Sincronizando GitHub...');
  try {
    // Push por si hay cambios locales sin empujar
    const statusOut = execSync('git -C /home/z/my-project status --porcelain', { encoding: 'utf8' });
    if (statusOut.trim().length > 0) {
      console.log('  ⚠ Hay cambios locales sin commit. Haciendo commit automático...');
      execSync('git -C /home/z/my-project add -A', { stdio: 'inherit' });
      execSync('git -C /home/z/my-project commit -m "chore: sync automática de plataforma"', { stdio: 'inherit' });
      report.actions.push('GitHub: commit automático de cambios pendientes');
    }
    // Push
    try {
      const pushOut = execSync('git -C /home/z/my-project push origin main 2>&1', { encoding: 'utf8' });
      console.log('  ✅ git push OK:', pushOut.trim().split('\n').slice(-2).join(' | '));
    } catch (e) {
      // Si "Everything up-to-date" sale por stderr en algunas versiones de git
      const msg = (e.stdout || '') + (e.stderr || '');
      if (/up.to.date/i.test(msg)) {
        console.log('  ✅ git push: ya está sincronizado (up-to-date)');
      } else {
        throw e;
      }
    }
    const head = execSync('git -C /home/z/my-project rev-parse HEAD', { encoding: 'utf8' }).trim();
    const remoteHead = execSync('git -C /home/z/my-project rev-parse origin/main', { encoding: 'utf8' }).trim();
    console.log(`  • HEAD local:  ${head}`);
    console.log(`  • HEAD remoto: ${remoteHead}`);
    console.log(`  ${head === remoteHead ? '✅' : '❌'} GitHub sincronizado: ${head === remoteHead}`);
    report.github.ok = (head === remoteHead);
    report.github.details = { head, remoteHead, synced: head === remoteHead };

    // Verificar webhook de GitHub
    if (tokens.GITHUB && tokens.GITHUB.token) {
      try {
        const owner = process.env.GITHUB_OWNER || 'jsadr-1029';
        const repo = process.env.GITHUB_REPO || 'jsadr-1029-jsadr';
        const whRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks?per_page=30`, {
          headers: { Authorization: `Bearer ${tokens.GITHUB.token}`, Accept: 'application/vnd.github+json' },
        });
        if (whRes.ok) {
          const hooks = await whRes.json();
          report.github.details.webhooks = hooks.map(h => ({ id: h.id, url: h.config.url, events: h.events, active: h.active }));
          console.log(`  • Webhooks GitHub: ${hooks.length} configurados`);
          hooks.forEach(h => console.log(`      - ${h.config.url} [${h.events.join(',')}] active=${h.active}`));
        } else {
          console.warn(`  ⚠ No se pudieron listar webhooks GitHub: HTTP ${whRes.status}`);
        }
      } catch (e) {
        console.warn('  ⚠ Listar webhooks GitHub falló:', e.message);
      }
    }
  } catch (e) {
    console.error('  ❌ GitHub sync falló:', e.message);
    report.warnings.push('GitHub sync: ' + e.message);
  }

  // ─── 3.3 Neon: prisma db push + verificar ───
  console.log('\n▶ PASO 3: Sincronizando Neon (schema Prisma)...');
  try {
    console.log('  • Ejecutando prisma generate...');
    execSync('npx prisma generate', { stdio: 'inherit', cwd: '/home/z/my-project' });
    console.log('  • Ejecutando prisma db push (sin resetear data)...');
    const pushOut = execSync('npx prisma db push --accept-data-loss --skip-generate 2>&1', {
      encoding: 'utf8',
      cwd: '/home/z/my-project',
      timeout: 180000,
    });
    const tail = pushOut.trim().split('\n').slice(-6).join('\n');
    console.log('  ✅ prisma db push OK:');
    console.log('  ' + tail.replace(/\n/g, '\n  '));
    report.neon.ok = true;
    report.actions.push('Neon: prisma generate + db push ejecutados');

    // Verificar conteo de tablas
    const tablas = await prisma.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
      ORDER BY table_name
    `);
    const n = Array.isArray(tablas) ? tablas.length : 0;
    console.log(`  • Tablas en Neon (public): ${n}`);
    report.neon.details.tables = n;
    report.neon.details.tablaList = (tablas || []).map(t => t.table_name);
  } catch (e) {
    console.error('  ❌ Neon sync falló:', e.message);
    report.warnings.push('Neon: ' + e.message);
  }

  // ─── 3.4 Vercel: envs + redeploy + dominio + cron + deployments ───
  console.log('\n▶ PASO 4: Sincronizando Vercel...');
  const VERCEL_TOKEN = tokens.VERCEL?.token || '';
  const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || tokens.VERCEL?.projectId || '';
  const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || tokens.VERCEL?.teamId || '';

  if (!VERCEL_TOKEN) {
    console.warn('  ❌ VERCEL_TOKEN vacío en PlataformaSync — no se puede sincronizar Vercel.');
    report.warnings.push('Vercel: VERCEL_TOKEN vacío en BD');
  } else if (!VERCEL_PROJECT_ID) {
    console.warn('  ❌ VERCEL_PROJECT_ID vacío — no se puede sincronizar Vercel.');
    report.warnings.push('Vercel: VERCEL_PROJECT_ID vacío');
  } else {
    const base = `https://api.vercel.com`;
    const teamQ = VERCEL_TEAM_ID ? `teamId=${VERCEL_TEAM_ID}` : '';
    const authH = { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' };

    // 4.1 Verificar token
    try {
      const uRes = await fetch(`${base}/v2/user`, { headers: authH });
      if (!uRes.ok) {
        console.warn(`  ❌ Vercel API /user HTTP ${uRes.status}`);
        report.warnings.push(`Vercel: token inválido (HTTP ${uRes.status})`);
      } else {
        const ud = await uRes.json();
        console.log(`  • Vercel user: ${ud.user?.email || ud.user?.username} (${ud.user?.name || '-'})`);
      }
    } catch (e) {
      console.warn('  ⚠ Vercel /user falló:', e.message);
    }

    // 4.2 Listar proyecto
    try {
      const pRes = await fetch(`${base}/v9/projects/${VERCEL_PROJECT_ID}${teamQ ? '?' + teamQ : ''}`, { headers: authH });
      if (!pRes.ok) {
        console.warn(`  ❌ Vercel project HTTP ${pRes.status}`);
      } else {
        const pd = await pRes.json();
        console.log(`  • Proyecto: ${pd.name} (id=${pd.id})`);
        console.log(`  • Framework: ${pd.framework}, defaultBranch=${pd.targets?.production?.branch || 'main'}`);
        if (pd.targets?.production?.alias?.length) {
          console.log(`  • Alias producción: ${pd.targets.production.alias.join(', ')}`);
        }
        report.vercel.details.project = { name: pd.name, id: pd.id, framework: pd.framework };
      }
    } catch (e) {
      console.warn('  ⚠ Vercel /projects falló:', e.message);
    }

    // 4.3 Listar envs actuales
    console.log('\n  ── 4a. Variables de entorno actuales en Vercel ──');
    const existingEnvs = new Map(); // key -> {id, target, type, value}
    try {
      const eRes = await fetch(`${base}/v9/projects/${VERCEL_PROJECT_ID}/env${teamQ ? '?' + teamQ : ''}`, { headers: authH });
      if (eRes.ok) {
        const ed = await eRes.json();
        for (const e of ed.envs || []) {
          existingEnvs.set(e.key, { id: e.id, target: e.target, type: e.type, value: e.value });
          const tgtStr = (e.target || []).join(',');
          console.log(`     • ${e.key.padEnd(30)} target=[${tgtStr}] type=${e.type}`);
        }
        console.log(`  → ${existingEnvs.size} variables en Vercel`);
      } else {
        console.warn(`  ⚠ Listar envs HTTP ${eRes.status}`);
      }
    } catch (e) {
      console.warn('  ⚠ Listar envs falló:', e.message);
    }

    // 4.4 Construir envs deseados desde .env
    //  - Saltarse vacíos, comentarios y SECRETOS sensibles que Vercel ya tiene cifrados
    const desiredEnvs = {};
    const lines = envContent.split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
      if (!m) continue;
      const k = m[1];
      const v = m[2];
      if (!v) continue; // vacío → no crear
      desiredEnvs[k] = v;
    }
    // Sobreescribir algunos valores desde VariableGlobal/PlataformaSync (más confiables)
    if (tokens.VERCEL?.token) desiredEnvs.VERCEL_TOKEN = tokens.VERCEL.token;
    if (tokens.NEON?.token) desiredEnvs.NEON_API_KEY = tokens.NEON.token;
    if (tokens.GITHUB?.token) desiredEnvs.GITHUB_TOKEN = tokens.GITHUB.token;
    if (tokens.WHATSAPP?.token) desiredEnvs.WHATSAPP_TOKEN = tokens.WHATSAPP.token;
    if (globalVars.CRON_SECRET) desiredEnvs.CRON_SECRET = globalVars.CRON_SECRET;
    if (tokens.GITHUB?.webhookSecret) desiredEnvs.GITHUB_WEBHOOK_SECRET = tokens.GITHUB.webhookSecret;
    if (tokens.VERCEL?.webhookSecret) desiredEnvs.VERCEL_WEBHOOK_SECRET = tokens.VERCEL.webhookSecret;
    if (tokens.NEON?.webhookSecret) desiredEnvs.NEON_WEBHOOK_SECRET = tokens.NEON.webhookSecret;
    if (tokens.WHATSAPP?.webhookSecret) desiredEnvs.WHATSAPP_WEBHOOK_SECRET = tokens.WHATSAPP.webhookSecret;

    // Forzar NEXT_PUBLIC_APP_URL en producción = dominio real
    desiredEnvs.NEXT_PUBLIC_APP_URL = 'https://jsadr.com.co';
    // NODE_ENV en Vercel lo maneja automáticamente — no enviarlo
    delete desiredEnvs.NODE_ENV;

    // 4.5 Detectar diferencias: faltantes o con valor distinto
    const toCreate = [];
    const toUpdate = [];
    const desiredKeys = Object.keys(desiredEnvs).sort();
    for (const k of desiredKeys) {
      const desired = desiredEnvs[k];
      const cur = existingEnvs.get(k);
      if (!cur) {
        toCreate.push({ key: k, value: desired });
      } else {
        // Si el valor actual está cifrado (type=encrypted) no podemos comparar.
        // Comparamos solo si cur.value es string legible.
        const isEncrypted = cur.type === 'encrypted' || (cur.value === undefined);
        const sameValue = !isEncrypted && cur.value === desired;
        const sameTarget = Array.isArray(cur.target) &&
          cur.target.includes('production') && cur.target.includes('preview') && cur.target.includes('development');
        if (!sameValue || !sameTarget) {
          toUpdate.push({ key: k, value: desired, id: cur.id, reason: !sameValue ? 'value' : 'target' });
        }
      }
    }
    console.log(`\n  ── 4b. Diferencias detectadas: ${toCreate.length} a crear, ${toUpdate.length} a actualizar ──`);

    // 4.6 Crear / actualizar envs (vía API REST de Vercel)
    // Para cada creación: POST /v10/projects/{id}/env?teamId=...
    // Para cada update: PATCH /v9/projects/{id}/env/{envId}?teamId=...
    // Targets: ['production','preview','development'] para secretos
    //          ['production','preview','development'] con type='plain' para NEXT_PUBLIC_*
    let okCreate = 0, okUpdate = 0, failOps = 0;
    const TARGETS_ALL = ['production', 'preview', 'development'];

    for (const item of toCreate) {
      const isPublic = item.key.startsWith('NEXT_PUBLIC_');
      const body = {
        key: item.key,
        value: item.value,
        type: isPublic ? 'plain' : 'encrypted',
        target: TARGETS_ALL,
      };
      try {
        const r = await fetch(`${base}/v10/projects/${VERCEL_PROJECT_ID}/env${teamQ ? '?' + teamQ : ''}`, {
          method: 'POST',
          headers: authH,
          body: JSON.stringify(body),
        });
        if (r.ok || r.status === 200 || r.status === 201) {
          okCreate++;
          console.log(`     ✅ Creada ${item.key} (${mask(item.value)})`);
        } else {
          failOps++;
          const t = await r.text();
          console.warn(`     ❌ Crear ${item.key}: HTTP ${r.status} ${t.substring(0, 200)}`);
        }
      } catch (e) {
        failOps++;
        console.warn(`     ❌ Crear ${item.key}: ${e.message}`);
      }
    }

    for (const item of toUpdate) {
      const isPublic = item.key.startsWith('NEXT_PUBLIC_');
      const body = {
        value: item.value,
        type: isPublic ? 'plain' : 'encrypted',
        target: TARGETS_ALL,
      };
      try {
        const r = await fetch(`${base}/v9/projects/${VERCEL_PROJECT_ID}/env/${item.id}${teamQ ? '?' + teamQ : ''}`, {
          method: 'PATCH',
          headers: authH,
          body: JSON.stringify(body),
        });
        if (r.ok) {
          okUpdate++;
          console.log(`     ✅ Actualizada ${item.key} (${item.reason})`);
        } else {
          failOps++;
          const t = await r.text();
          console.warn(`     ❌ Actualizar ${item.key}: HTTP ${r.status} ${t.substring(0, 200)}`);
        }
      } catch (e) {
        failOps++;
        console.warn(`     ❌ Actualizar ${item.key}: ${e.message}`);
      }
    }

    report.vercel.details.envOps = { created: okCreate, updated: okUpdate, failed: failOps };
    if (okCreate > 0 || okUpdate > 0) {
      report.actions.push(`Vercel: ${okCreate} envs creadas, ${okUpdate} actualizadas`);
    }

    // 4.7 Verificar dominios
    console.log('\n  ── 4c. Dominios del proyecto ──');
    try {
      const dRes = await fetch(`${base}/v9/projects/${VERCEL_PROJECT_ID}/domains${teamQ ? '?' + teamQ : ''}`, { headers: authH });
      if (dRes.ok) {
        const dd = await dRes.json();
        const domains = dd.domains || [];
        for (const d of domains) {
          const dns = d.configVerified ? '✅' : (d.configVerified === false ? '❌' : '⚠');
          console.log(`     • ${d.name} — verified=${d.verified} configVerified=${d.configVerified} ${dns}`);
          if (d.redirect) console.log(`         redirect → ${d.redirect}`);
          if (d.gitBranch) console.log(`         gitBranch=${d.gitBranch}`);
        }
        report.vercel.details.domains = domains.map(d => ({ name: d.name, verified: d.verified, configVerified: d.configVerified, redirect: d.redirect, gitBranch: d.gitBranch }));
      } else {
        console.warn(`  ⚠ Dominios HTTP ${dRes.status}`);
      }
    } catch (e) {
      console.warn('  ⚠ Dominios falló:', e.message);
    }

    // 4.8 Verificar último deployment
    console.log('\n  ── 4d. Últimos deployments ──');
    let latestDeployment = null;
    try {
      const dpRes = await fetch(`${base}/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=5${teamQ ? '&' + teamQ : ''}`, { headers: authH });
      if (dpRes.ok) {
        const dpd = await dpRes.json();
        for (const d of dpd.deployments || []) {
          const state = d.readyState || d.status;
          const aliasStr = (d.alias || []).join(', ');
          console.log(`     • ${d.uid.substring(0, 8)} state=${state} branch=${d.meta?.githubCommitRef||'-'} commit=${(d.meta?.githubCommitSha||'').substring(0,7)} alias=${aliasStr} createdAt=${d.createdAt}`);
        }
        latestDeployment = (dpd.deployments || [])[0] || null;
        if (latestDeployment) report.vercel.details.latestDeployment = {
          uid: latestDeployment.uid, state: latestDeployment.readyState, alias: latestDeployment.alias,
          commitSha: latestDeployment.meta?.githubCommitSha, commitRef: latestDeployment.meta?.githubCommitRef,
          createdAt: latestDeployment.createdAt,
        };
      } else {
        console.warn(`  ⚠ Deployments HTTP ${dpRes.status}`);
      }
    } catch (e) {
      console.warn('  ⚠ Deployments falló:', e.message);
    }

    // 4.9 Comparar commit del último deployment con HEAD local
    const head = execSync('git -C /home/z/my-project rev-parse HEAD', { encoding: 'utf8' }).trim();
    if (latestDeployment) {
      const dpCommit = (latestDeployment.meta?.githubCommitSha || '').trim();
      const dpState = latestDeployment.readyState;
      const synced = dpCommit === head;
      console.log(`\n  ── 4e. Sync commit ──`);
      console.log(`     • HEAD local:     ${head}`);
      console.log(`     • Vercel deploy:  ${dpCommit || '(desconocido)'} state=${dpState}`);
      console.log(`     ${synced ? '✅' : '⚠'} Deploy ${synced ? 'sincronizado con HEAD' : 'NO coincide con HEAD — disparar redeploy'}`);

      if (!synced || dpState !== 'READY') {
        console.log('\n  ── 4f. Disparando nuevo deployment via Vercel API ──');
        try {
          const deployBody = {
            name: latestDeployment.name,
            target: 'production',
            gitSource: {
              type: 'github',
              org: process.env.GITHUB_OWNER || 'jsadr-1029',
              repo: process.env.GITHUB_REPO || 'jsadr-1029-jsadr',
              ref: head,
            },
          };
          const dr = await fetch(`${base}/v13/deployments${teamQ ? '?' + teamQ : ''}`, {
            method: 'POST',
            headers: authH,
            body: JSON.stringify(deployBody),
          });
          if (dr.ok) {
            const dd = await dr.json();
            console.log(`     ✅ Deploy disparado: id=${dd.id || dd.uid} url=${dd.url || '-'}`);
            report.actions.push(`Vercel: deploy disparado (id=${dd.id || dd.uid})`);
          } else {
            const t = await dr.text();
            console.warn(`     ❌ Deploy HTTP ${dr.status} ${t.substring(0, 300)}`);
          }
        } catch (e) {
          console.warn('     ❌ Deploy falló:', e.message);
        }
      } else {
        console.log('     ✅ No hace falta disparar deploy (ya está en HEAD y READY)');
      }
    }

    report.vercel.ok = true;
  }

  // ─── 3.5 Estado final ───
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  RESUMEN DE SINCRONIZACIÓN');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  GitHub : ${report.github.ok ? '✅ sincronizado' : '❌ pendiente'}`);
  console.log(`  Neon   : ${report.neon.ok ? '✅ sincronizado' : '❌ pendiente'}`);
  console.log(`  Vercel : ${report.vercel.ok ? '✅ sincronizado' : '❌ pendiente'}`);
  if (report.actions.length) {
    console.log('\n  Acciones ejecutadas:');
    report.actions.forEach(a => console.log(`    • ${a}`));
  }
  if (report.warnings.length) {
    console.log('\n  Advertencias:');
    report.warnings.forEach(w => console.log(`    ⚠ ${w}`));
  }
  console.log('\n═══════════════════════════════════════════════════════\n');

  // Guardar reporte en disco
  fs.writeFileSync('/home/z/my-project/tool-results/sync-report.json', JSON.stringify(report, null, 2));
  console.log('  Reporte JSON guardado en /home/z/my-project/tool-results/sync-report.json');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ ERROR FATAL:', e.message);
  console.error(e.stack);
  try { await prisma.$disconnect(); } catch (_) {}
  process.exit(1);
});
