const fs = require('node:fs/promises');
const path = require('node:path');

function createAuditLogger({ logFilePath, appendFile = fs.appendFile, mkdir = fs.mkdir }) {
  if (!logFilePath) {
    throw new Error('AUDIT_LOG_FILE_PATH is required');
  }

  async function log(event) {
    const entry = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    await mkdir(path.dirname(logFilePath), { recursive: true });
    await appendFile(logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  return {
    log,
  };
}

module.exports = {
  createAuditLogger,
};
