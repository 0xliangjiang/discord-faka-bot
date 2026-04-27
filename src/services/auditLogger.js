const fs = require('node:fs/promises');
const path = require('node:path');

function formatAuditChannelMessage(entry) {
  const lines = [
    '```',
    `[${entry.timestamp}] ${entry.commandName || entry.event}: ${entry.outcome}`,
    `操作者: ${entry.actorDiscordTag || 'unknown'} (${entry.actorDiscordUserId || 'unknown'})`,
  ];

  if (entry.targetUsername) {
    lines.push(`目标用户: ${entry.targetUsername}`);
  }

  if (entry.targetUserId) {
    lines.push(`目标用户ID: ${entry.targetUserId}`);
  }

  if (entry.errorMessage) {
    lines.push(`错误: ${entry.errorMessage}`);
  }

  lines.push('```');
  return lines.join('\n');
}

function createAuditLogger({
  logFilePath,
  appendFile = fs.appendFile,
  mkdir = fs.mkdir,
  auditChannelId = null,
  discordClient = null,
  consoleError = console.error,
}) {
  if (!logFilePath) {
    throw new Error('AUDIT_LOG_FILE_PATH is required');
  }

  async function sendToAuditChannel(entry) {
    if (!auditChannelId || !discordClient) {
      return;
    }

    try {
      const channel = await discordClient.channels.fetch(auditChannelId);
      if (!channel || typeof channel.send !== 'function') {
        throw new Error(`Audit channel ${auditChannelId} is not sendable`);
      }

      await channel.send({
        content: formatAuditChannelMessage(entry),
      });
    } catch (error) {
      consoleError('Failed to send audit event to Discord channel:', error);
    }
  }

  async function log(event) {
    const entry = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    await mkdir(path.dirname(logFilePath), { recursive: true });
    await appendFile(logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
    await sendToAuditChannel(entry);
  }

  return {
    log,
  };
}

module.exports = {
  createAuditLogger,
};
