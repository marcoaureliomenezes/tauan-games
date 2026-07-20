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
  const alreadyUp = await checkPort();
  if (alreadyUp) {
    throw new Error(`Port ${PORT} is already in use. Stop whatever is running on it before running tests.`);
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
