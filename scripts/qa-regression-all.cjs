/**
 * qa-regression-all.cjs — Auditoría de regresión end-to-end
 *
 * Ejecuta los 13 scripts qa-m0X-*.ts en paralelo (hasta 4 concurrentes),
 * captura stdout/stderr, parsea PASS/FAIL y genera reporte consolidado.
 *
 * Uso: node scripts/qa-regression-all.cjs
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ───────── Configuración ─────────
const MODULES = [
  { id: 'M01', name: 'Autenticación',          script: 'scripts/qa-m01-auth.ts' },
  { id: 'M02', name: 'Clientes',                script: 'scripts/qa-m02-all.ts' },
  { id: 'M03', name: 'Préstamos',               script: 'scripts/qa-m03-all.ts' },
  { id: 'M04', name: 'Pagos',                   script: 'scripts/qa-m04-all.ts' },
  { id: 'M05', name: 'Correo Electrónico',      script: 'scripts/qa-m05-all.ts' },
  { id: 'M06', name: 'Seguridad',               script: 'scripts/qa-m06-all.ts' },
  { id: 'M07', name: 'Portal Cliente',          script: 'scripts/qa-m07-all.ts' },
  { id: 'M08', name: 'Portal Jurídico',         script: 'scripts/qa-m08-all.ts' },
  { id: 'M09', name: 'Notificaciones',          script: 'scripts/qa-m09-all.ts' },
  { id: 'M10', name: 'Reportes',                script: 'scripts/qa-m10-all.ts' },
  { id: 'M11', name: 'Integraciones',           script: 'scripts/qa-m11-all.ts' },
  { id: 'M12', name: 'UI/UX Mobile-Desktop',    script: 'scripts/qa-m12-all.ts' },
  { id: 'M13', name: 'Sync DevOps',             script: 'scripts/qa-m13-all.ts' },
];

const CONCURRENCY = Math.min(4, os.cpus().length);
const PER_SCRIPT_TIMEOUT_MS = 180_000; // 3 min por script

// ───────── Utilidades ─────────
function parseResults(stdout) {
  // Acepta múltiples formatos:
  //   "RESULTADO: 15 pass / 0 fail / 15 total"
  //   "RESULTADO: 113 PASS / 0 FAIL / 113 TOTAL"
  //   "RESUMEN: 95 PASS / 0 FAIL"
  //   "RESULTADO M09-Notificaciones: 47 PASS / 0 FAIL"
  //   "Total: 113 PASS / 0 FAIL de 113 sub-tests"
  //   "║   RESULTADO: 113 PASS / 0 FAIL"
  const patterns = [
    /RESULTADO[^\d]*?(\d+)\s*PASS\s*\/\s*(\d+)\s*FAIL/i,
    /RESUMEN[^\d]*?(\d+)\s*PASS\s*\/\s*(\d+)\s*FAIL/i,
    /Total[^\d]*?(\d+)\s*PASS\s*\/\s*(\d+)\s*FAIL/i,
    /(\d+)\s*pass\s*\/\s*(\d+)\s*fail/i,
  ];
  for (const re of patterns) {
    const m = stdout.match(re);
    if (m) {
      const pass = parseInt(m[1], 10);
      const fail = parseInt(m[2], 10);
      if (!Number.isNaN(pass) && !Number.isNaN(fail)) return { pass, fail };
    }
  }
  return { pass: 0, fail: 0, unparsed: true };
}

function runOne(mod) {
  return new Promise((resolve) => {
    const start = Date.now();
    const args = ['tsx', mod.script];
    const child = spawn('npx', args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';
    const chunks = [];
    const errChunks = [];

    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => errChunks.push(d));

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      resolve({
        ...mod,
        ok: false,
        timeout: true,
        durationMs: Date.now() - start,
        stdout: Buffer.concat(chunks).toString('utf8'),
        stderr: Buffer.concat(errChunks).toString('utf8') + '\n[TIMEOUT]',
        ...parseResults(Buffer.concat(chunks).toString('utf8')),
      });
    }, PER_SCRIPT_TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timer);
      stdout = Buffer.concat(chunks).toString('utf8');
      stderr = Buffer.concat(errChunks).toString('utf8');
      const parsed = parseResults(stdout);
      resolve({
        ...mod,
        ok: code === 0 && !parsed.unparsed && parsed.fail === 0,
        code,
        timeout: false,
        durationMs: Date.now() - start,
        stdout,
        stderr,
        ...parsed,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        ...mod,
        ok: false,
        error: err.message,
        durationMs: Date.now() - start,
        stdout: '',
        stderr: err.message,
        ...parseResults(''),
      });
    });
  });
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

function fmtMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ───────── Main ─────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  AUDITORÍA DE REGRESIÓN END-TO-END — 13 MÓDULOS QA');
  console.log('  Concurrencia:', CONCURRENCY, '| Timeout/script:', PER_SCRIPT_TIMEOUT_MS / 1000, 's');
  console.log('═══════════════════════════════════════════════════════════\n');

  const startedAt = new Date();
  const t0 = Date.now();

  const results = await runPool(MODULES, CONCURRENCY, async (mod) => {
    process.stdout.write(`▶ ${mod.id} ${mod.name}... `);
    const r = await runOne(mod);
    const status = r.timeout ? '⏱ TIMEOUT'
                 : r.error ? '⚠ ERROR'
                 : r.ok ? '✅ PASS'
                 : r.fail > 0 ? `❌ FAIL (${r.fail})`
                 : '⚠ UNPARSED';
    console.log(`${status} — ${r.pass} pass / ${r.fail} fail (${fmtMs(r.durationMs)})`);
    return r;
  });

  const totalMs = Date.now() - t0;
  const finishedAt = new Date();

  const totalPass = results.reduce((s, r) => s + (r.pass || 0), 0);
  const totalFail = results.reduce((s, r) => s + (r.fail || 0), 0);
  const totalTests = totalPass + totalFail;
  const modulesPassed = results.filter((r) => r.ok).length;
  const modulesFailed = MODULES.length - modulesPassed;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  RESUMEN CONSOLIDADO');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Módulos aprobados: ${modulesPassed}/${MODULES.length}`);
  console.log(`  Sub-tests PASS:    ${totalPass}`);
  console.log(`  Sub-tests FAIL:    ${totalFail}`);
  console.log(`  Total sub-tests:   ${totalTests}`);
  console.log(`  Tasa de aprobación: ${totalTests > 0 ? ((totalPass / totalTests) * 100).toFixed(2) : '0'}%`);
  console.log(`  Duración total:    ${fmtMs(totalMs)}`);
  console.log(`  Inicio:            ${startedAt.toISOString()}`);
  console.log(`  Fin:               ${finishedAt.toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Tabla por módulo
  console.log('  ID   | Módulo                    | PASS  | FAIL | Estado  | Duración');
  console.log('  -----+---------------------------+-------+------+---------+----------');
  for (const r of results) {
    const estado = r.timeout ? 'TIMEOUT'
                 : r.error ? 'ERROR'
                 : r.ok ? 'PASS'
                 : r.fail > 0 ? 'FAIL'
                 : 'UNPARSED';
    const icon = r.ok ? '✅' : '❌';
    console.log(`  ${r.id} | ${r.name.padEnd(25)} | ${String(r.pass).padStart(5)} | ${String(r.fail).padStart(4)} | ${icon} ${estado.padEnd(7)} | ${fmtMs(r.durationMs)}`);
  }
  console.log('');

  // Detalle de fallos
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log('\n═══ DETALLE DE MÓDULOS CON FALLOS ═══');
    for (const r of failed) {
      console.log(`\n❌ ${r.id} ${r.name} (exit code: ${r.code ?? 'n/a'}${r.timeout ? ', TIMEOUT' : ''}${r.error ? `, ERROR: ${r.error}` : ''})`);
      // Imprimir las líneas que empiezan con ❌ del stdout
      const lines = (r.stdout || '').split('\n').filter((l) => l.includes('❌') || l.includes('FAIL'));
      if (lines.length === 0) {
        console.log('  (no se detectaron líneas FAIL en stdout)');
        if (r.stderr) console.log('  stderr (últimas 500 chars):', r.stderr.slice(-500));
      } else {
        for (const l of lines.slice(0, 30)) console.log('  ' + l);
      }
    }
  } else {
    console.log('\n✅ TODOS LOS MÓDULOS APROBADOS — SIN FALLOS');
  }

  // Guardar JSON para reporte PDF
  const reportData = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: totalMs,
    concurrency: CONCURRENCY,
    totalModules: MODULES.length,
    modulesPassed,
    modulesFailed,
    totalPass,
    totalFail,
    totalTests,
    approvalRate: totalTests > 0 ? Number(((totalPass / totalTests) * 100).toFixed(2)) : 0,
    modules: results.map((r) => ({
      id: r.id,
      name: r.name,
      script: r.script,
      pass: r.pass || 0,
      fail: r.fail || 0,
      ok: !!r.ok,
      timeout: !!r.timeout,
      errorCode: r.code ?? null,
      errorMessage: r.error || null,
      durationMs: r.durationMs,
      failedLines: (r.stdout || '').split('\n').filter((l) => l.includes('❌') || l.includes('FAIL')).slice(0, 50),
    })),
  };

  const outDir = path.join(process.cwd(), 'download');
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'qa-regresion-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2));
  console.log(`\n📦 Resultados JSON guardados en: ${jsonPath}`);

  // Exit code
  process.exit(modulesFailed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(2);
});
