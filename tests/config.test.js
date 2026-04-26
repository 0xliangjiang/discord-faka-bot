const test = require('node:test');
const assert = require('node:assert/strict');

const { loadConfig } = require('../src/config');

test('loadConfig parses env vars and allowed Discord user IDs', () => {
  const config = loadConfig({
    DISCORD_TOKEN: 'bot-token',
    DISCORD_CLIENT_ID: 'client-id',
    DISCORD_GUILD_ID: 'guild-id',
    RESELLER_API_KEY: 'api-key',
    RESELLER_API_BASE_URL: 'https://noaserver.com/resellerApi',
    ALLOWED_DISCORD_USER_IDS: '111, 222 ,333',
    AUDIT_LOG_FILE_PATH: 'logs/audit.log',
    GENERATE_LOADER_TIMEOUT_MS: '360000',
  });

  assert.deepEqual(config, {
    discordToken: 'bot-token',
    discordClientId: 'client-id',
    discordGuildId: 'guild-id',
    resellerApiKey: 'api-key',
    resellerApiBaseUrl: 'https://noaserver.com/resellerApi',
    allowedDiscordUserIds: ['111', '222', '333'],
    auditLogFilePath: 'logs/audit.log',
    generateLoaderTimeoutMs: 360000,
  });
});

test('loadConfig throws when required env vars are missing', () => {
  assert.throws(
    () => loadConfig({}),
    /Missing required environment variables: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, RESELLER_API_KEY, ALLOWED_DISCORD_USER_IDS/,
  );
});

test('loadConfig uses defaults for optional settings when omitted', () => {
  const config = loadConfig({
    DISCORD_TOKEN: 'bot-token',
    DISCORD_CLIENT_ID: 'client-id',
    DISCORD_GUILD_ID: 'guild-id',
    RESELLER_API_KEY: 'api-key',
    ALLOWED_DISCORD_USER_IDS: '111',
  });

  assert.equal(config.resellerApiBaseUrl, 'https://noaserver.com/resellerApi');
  assert.equal(config.auditLogFilePath, 'logs/audit.log');
  assert.equal(config.generateLoaderTimeoutMs, 360000);
});

test('loadConfig rejects invalid generate loader timeout values', () => {
  assert.throws(
    () => loadConfig({
      DISCORD_TOKEN: 'bot-token',
      DISCORD_CLIENT_ID: 'client-id',
      DISCORD_GUILD_ID: 'guild-id',
      RESELLER_API_KEY: 'api-key',
      ALLOWED_DISCORD_USER_IDS: '111',
      GENERATE_LOADER_TIMEOUT_MS: 'abc',
    }),
    /GENERATE_LOADER_TIMEOUT_MS must be a positive integer/,
  );
});
