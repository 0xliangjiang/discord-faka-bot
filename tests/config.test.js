const test = require('node:test');
const assert = require('node:assert/strict');

const { loadConfig } = require('../src/config');

test('loadConfig parses env vars and allowed Discord user/channel IDs', () => {
  const config = loadConfig({
    DISCORD_TOKEN: 'bot-token',
    DISCORD_CLIENT_ID: 'client-id',
    DISCORD_GUILD_ID: 'guild-id',
    RESELLER_API_KEY: 'api-key',
    RESELLER_API_BASE_URL: 'https://noaserver.com/resellerApi',
    RESET_HWID_API_BASE_URL: 'https://playsharp.example.com/api/reseller/v1',
    LOADER_BUILDS_API_BASE_URL: 'https://playsharp.example.com/api/reseller/v1',
    PLAYSHARP_RESELLER_API_VERSION: '2026-05-22.7',
    ALLOWED_DISCORD_USER_IDS: '111, 222 ,333',
    ALLOWED_DISCORD_CHANNEL_IDS: '444, 555 ,666',
    AUDIT_LOG_FILE_PATH: 'logs/audit.log',
    AUDIT_CHANNEL_ID: '999888777',
    GENERATE_LOADER_TIMEOUT_MS: '360000',
  });

  assert.deepEqual(config, {
    discordToken: 'bot-token',
    discordClientId: 'client-id',
    discordGuildId: 'guild-id',
    resellerApiKey: 'api-key',
    resellerApiBaseUrl: 'https://noaserver.com/resellerApi',
    resetHwidApiBaseUrl: 'https://playsharp.example.com/api/reseller/v1',
    loaderBuildsApiBaseUrl: 'https://playsharp.example.com/api/reseller/v1',
    playsharpResellerApiVersion: '2026-05-22.7',
    allowedDiscordUserIds: ['111', '222', '333'],
    allowedDiscordChannelIds: ['444', '555', '666'],
    auditLogFilePath: 'logs/audit.log',
    auditChannelId: '999888777',
    generateLoaderTimeoutMs: 360000,
  });
});

test('loadConfig throws when required env vars are missing', () => {
  assert.throws(
    () => loadConfig({}),
    /Missing required environment variables: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, RESELLER_API_KEY/,
  );
});

test('loadConfig allows channel-only permissions when user IDs are omitted', () => {
  const config = loadConfig({
    DISCORD_TOKEN: 'bot-token',
    DISCORD_CLIENT_ID: 'client-id',
    DISCORD_GUILD_ID: 'guild-id',
    RESELLER_API_KEY: 'api-key',
    ALLOWED_DISCORD_CHANNEL_IDS: '444,555',
  });

  assert.deepEqual(config.allowedDiscordUserIds, []);
  assert.deepEqual(config.allowedDiscordChannelIds, ['444', '555']);
});

test('loadConfig requires at least one permission allowlist', () => {
  assert.throws(
    () => loadConfig({
      DISCORD_TOKEN: 'bot-token',
      DISCORD_CLIENT_ID: 'client-id',
      DISCORD_GUILD_ID: 'guild-id',
      RESELLER_API_KEY: 'api-key',
    }),
    /Configure at least one of ALLOWED_DISCORD_USER_IDS or ALLOWED_DISCORD_CHANNEL_IDS/,
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

  assert.deepEqual(config.allowedDiscordChannelIds, []);
  assert.equal(config.resellerApiBaseUrl, 'https://playsharp.io/api/reseller/v1');
  assert.equal(config.resetHwidApiBaseUrl, 'https://playsharp.io/api/reseller/v1');
  assert.equal(config.loaderBuildsApiBaseUrl, 'https://playsharp.io/api/reseller/v1');
  assert.equal(config.playsharpResellerApiVersion, '2026-07-16.2');
  assert.equal(config.auditLogFilePath, 'logs/audit.log');
  assert.equal(config.auditChannelId, null);
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
