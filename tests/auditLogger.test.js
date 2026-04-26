const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { createAuditLogger } = require('../src/services/auditLogger');

test('audit logger appends one JSON line per event and creates parent directory', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-log-test-'));
  const logFilePath = path.join(tempDir, 'nested', 'audit.log');
  const logger = createAuditLogger({ logFilePath });

  await logger.log({
    event: 'resethwid_attempt',
    actorDiscordUserId: '10001',
    actorDiscordTag: 'admin#0001',
    commandName: 'resethwid',
    targetUsername: 'yy1234',
    targetUserId: 7788,
    outcome: 'success',
    errorMessage: null,
  });

  const fileContents = await fs.readFile(logFilePath, 'utf8');
  const lines = fileContents.trim().split('\n');

  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.event, 'resethwid_attempt');
  assert.equal(entry.actorDiscordUserId, '10001');
  assert.equal(entry.targetUsername, 'yy1234');
  assert.equal(entry.targetUserId, 7788);
  assert.equal(entry.outcome, 'success');
  assert.equal(entry.errorMessage, null);
  assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});
