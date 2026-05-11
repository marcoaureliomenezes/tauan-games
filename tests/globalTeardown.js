const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.TEST_PORT || '8080', 10);
const PID_FILE = path.join(__dirname, `.server-${PORT}.pid`);

module.exports = async function globalTeardown() {
  if (!fs.existsSync(PID_FILE)) return;
  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`\n  Static server (PID ${pid}) stopped.\n`);
  } catch (e) {
    // already dead — ignore
  }
  fs.unlinkSync(PID_FILE);
};
