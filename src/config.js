const DEFAULT_RESELLER_API_BASE_URL = 'https://noaserver.com/resellerApi';
const DEFAULT_AUDIT_LOG_FILE_PATH = 'logs/audit.log';
const DEFAULT_GENERATE_LOADER_TIMEOUT_MS = 360000;

function parsePositiveInteger(value, keyName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${keyName} must be a positive integer`);
  }
  return parsed;
}

function parseIdList(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadConfig(env = process.env) {
  const requiredKeys = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_GUILD_ID',
    'RESELLER_API_KEY',
  ];

  const missingKeys = requiredKeys.filter((key) => {
    const value = env[key];
    return typeof value !== 'string' || value.trim() === '';
  });

  if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
  }

  const allowedDiscordUserIds = parseIdList(env.ALLOWED_DISCORD_USER_IDS);
  const allowedDiscordChannelIds = parseIdList(env.ALLOWED_DISCORD_CHANNEL_IDS);

  if (allowedDiscordUserIds.length === 0 && allowedDiscordChannelIds.length === 0) {
    throw new Error('Configure at least one of ALLOWED_DISCORD_USER_IDS or ALLOWED_DISCORD_CHANNEL_IDS');
  }

  const generateLoaderTimeoutMs = env.GENERATE_LOADER_TIMEOUT_MS
    ? parsePositiveInteger(env.GENERATE_LOADER_TIMEOUT_MS.trim(), 'GENERATE_LOADER_TIMEOUT_MS')
    : DEFAULT_GENERATE_LOADER_TIMEOUT_MS;

  return {
    discordToken: env.DISCORD_TOKEN.trim(),
    discordClientId: env.DISCORD_CLIENT_ID.trim(),
    discordGuildId: env.DISCORD_GUILD_ID.trim(),
    resellerApiKey: env.RESELLER_API_KEY.trim(),
    resellerApiBaseUrl: (env.RESELLER_API_BASE_URL || DEFAULT_RESELLER_API_BASE_URL).trim(),
    allowedDiscordUserIds,
    allowedDiscordChannelIds,
    auditLogFilePath: (env.AUDIT_LOG_FILE_PATH || DEFAULT_AUDIT_LOG_FILE_PATH).trim(),
    auditChannelId: env.AUDIT_CHANNEL_ID?.trim() || null,
    generateLoaderTimeoutMs,
  };
}

module.exports = {
  DEFAULT_AUDIT_LOG_FILE_PATH,
  DEFAULT_GENERATE_LOADER_TIMEOUT_MS,
  DEFAULT_RESELLER_API_BASE_URL,
  loadConfig,
};
