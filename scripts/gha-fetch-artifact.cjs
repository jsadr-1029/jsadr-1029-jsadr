#!/usr/bin/env node
/**
 * Descarga el artifact "qa-regression-results" del último run fallido.
 * Usa download endpoint público (redirect a S3, sin auth).
 */
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const OWNER = 'jsadr-1029';
const REPO  = 'jsadr-1029-jsadr';
const RUN_ID = process.argv[2] || '31219465193';
const ARTIFACT_NAME = 'qa-regression-results';
const OUT_DIR = '/home/z/my-project/download/ci-artifacts';

function fetchJSON(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/${path}`,
      method: 'GET',
      headers: { 'User-Agent': 'qa-watch-script', 'Accept': 'application/vnd.github+json' },
    };
    https.get(opts, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(`JSON parse: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function fetchRedirect(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302) {
        resolve(res.headers.location);
      } else {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => reject(new Error(`Expected 302, got ${res.statusCode}: ${body.slice(0, 300)}`)));
      }
    }).on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} downloading`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  console.log(`Buscando artifact "${ARTIFACT_NAME}" en run ${RUN_ID}...`);
  const data = await fetchJSON(`actions/runs/${RUN_ID}/artifacts`);
  const arts = data.artifacts || [];
  console.log(`Artifacts encontrados: ${arts.length}`);
  for (const a of arts) {
    console.log(`  • ${a.name} (id=${a.id}, size=${a.size_in_bytes} bytes)`);
  }
  const art = arts.find(a => a.name === ARTIFACT_NAME);
  if (!art) {
    console.log('No se encontró el artifact. Puede que el step fallara antes de subirlo.');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const zipPath = path.join(OUT_DIR, `${ARTIFACT_NAME}.zip`);

  console.log(`\nDescargando ${art.archive_download_url}...`);
  const redirectUrl = await fetchRedirect(art.archive_download_url);
  console.log(`Redirect a: ${redirectUrl.slice(0, 80)}...`);
  await downloadFile(redirectUrl, zipPath);
  console.log(`✅ Descargado: ${zipPath} (${fs.statSync(zipPath).size} bytes)`);

  // Unzip
  console.log('\nDescomprimiendo...');
  const { execSync } = require('node:child_process');
  execSync(`unzip -o "${zipPath}" -d "${OUT_DIR}"`, { stdio: 'inherit' });
  console.log('✅ Descomprimido.');

  // Mostrar contenido del JSON
  const jsonPath = path.join(OUT_DIR, 'qa-regresion-results.json');
  if (fs.existsSync(jsonPath)) {
    console.log('\n═══ Contenido de qa-regresion-results.json ═══');
    const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`Módulos aprobados: ${j.modulesPassed}/${j.totalModules}`);
    console.log(`Sub-tests PASS:    ${j.totalPass}`);
    console.log(`Sub-tests FAIL:    ${j.totalFail}`);
    console.log(`Aprobación:        ${j.approvalRate}%`);
    console.log('');
    for (const m of j.modules) {
      const icon = m.ok ? '✅' : '❌';
      console.log(`  ${icon} ${m.id} ${m.name} — ${m.pass} pass / ${m.fail} fail`);
      if (!m.ok && m.failedLines && m.failedLines.length > 0) {
        for (const l of m.failedLines.slice(0, 10)) {
          console.log(`       ${l.trim()}`);
        }
      }
    }
  }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
