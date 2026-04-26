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

function loadConfig(env = process.env) {
  const requiredKeys = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_GUILD_ID',
    'RESELLER_API_KEY',
    'ALLOWED_DISCORD_USER_IDS',
  ];

  const missingKeys = requiredKeys.filter((key) => {
    const value = env[key];
    return typeof value !== 'string' || value.trim() === '';
  });

  if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
  }

  const allowedDiscordUserIds = env.ALLOWED_DISCORD_USER_IDS
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedDiscordUserIds.length === 0) {
    throw new Error('ALLOWED_DISCORD_USER_IDS must contain at least one Discord user ID');
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
    auditLogFilePath: (env.AUDIT_LOG_FILE_PATH || DEFAULT_AUDIT_LOG_FILE_PATH).trim(),
    generateLoaderTimeoutMs,
  };
}

module.exports = {
  DEFAULT_AUDIT_LOG_FILE_PATH,
  DEFAULT_GENERATE_LOADER_TIMEOUT_MS,
  DEFAULT_RESELLER_API_BASE_URL,
  loadConfig,
};
