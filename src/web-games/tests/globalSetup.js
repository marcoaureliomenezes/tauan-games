const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = parseInt(process.env.TEST_PORT || '8080', 10);
const PID_FILE = path.join(__dirname, `.server-${PORT}.pid`);
const REPO_ROOT = path.join(__dirname, '..', '..', '..');

function checkPort() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}`, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => { req.destroy(); resolve(false); });
  });
}

function waitForServer(retries = 10) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      checkPort().then((up) => {
        if (up) return resolve();
        if (++attempts >= retries) return reject(new Error(`Server on port ${PORT} did not start`));
        setTimeout(check, 200);
      });
    };
    check();
  });
}

module.exports = async function globalSetup() {
  // v0.10.0 T-06 (2): pid file cujo processo MORREU é removido em vez de
  // abortar o run — órfão de crash anterior não pode mais quebrar execução.
  if (fs.existsSync(PID_FILE)) {
    const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    let alive = false;
    try { process.kill(oldPid, 0); alive = true; } catch (e) { /* morto */ }
    if (!alive) {
      fs.unlinkSync(PID_FILE);
      console.log(`\n  Orphan pid file removed (PID ${oldPid} is dead).\n`);
    }
  }

  const alreadyUp = await checkPort();
  if (alreadyUp) {
    throw new Error(`Port ${PORT} is already in use. Stop whatever is running on it before running tests.`);
  }

  // v0.10.0 T-06 (1): run-start clean — artefatos da execução anterior não
  // sobrevivem ao início do run seguinte. Só no INÍCIO, nunca no fim.
  const outputDir = path.join(__dirname, 'screenshots');
  const reportDir = path.join(__dirname, '..', 'playwright-report');
  const resultsDir = path.join(__dirname, '..', 'test-results');
  for (const dir of [outputDir, reportDir, resultsDir]) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`  run-start clean: removed ${path.relative(process.cwd(), dir)}`);
    }
  }

  const server = spawn('python3', ['-m', 'http.server', String(PORT)], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: 'ignore',
  });

  server.unref();
  fs.writeFileSync(PID_FILE, String(server.pid));

  await waitForServer();
  console.log(`\n  Static server started on http://localhost:${PORT} (PID ${server.pid})\n`);
};
