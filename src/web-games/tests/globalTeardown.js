const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.TEST_PORT || '8080', 10);
const PID_FILE = path.join(__dirname, `.server-${PORT}.pid`);

// v0.10.0 T-06 (1): remoção do pid GARANTIDA também em morte anormal —
// try/finally no teardown + handlers para SIGINT/SIGTERM/exit registrados
// já no carregamento (o Playwright nem sempre chama o teardown quando um
// run morre; o handler limpa o pid e o servidor mesmo assim).
function cleanup() {
  if (!fs.existsSync(PID_FILE)) return;
  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`\n  Static server (PID ${pid}) stopped.\n`);
  } catch (e) {
    // already dead — ignore
  }
  try { fs.unlinkSync(PID_FILE); } catch (e) { /* ignore */ }
}

for (const sig of ['SIGINT', 'SIGTERM', 'exit']) {
  process.once(sig, cleanup);
}

module.exports = async function globalTeardown() {
  try {
    cleanup();
  } finally {
    fs.rmSync(PID_FILE, { force: true });
  }
};
