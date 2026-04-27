require('dotenv/config');

const { Client, Events, GatewayIntentBits } = require('discord.js');
const { loadConfig } = require('./config');
const { createResellerApiClient } = require('./services/resellerApi');
const { createAuditLogger } = require('./services/auditLogger');
const { createResetHwidCommand } = require('./commands/resethwid');
const { createGenerateLoaderCommand } = require('./commands/generateloader');

async function main() {
  const config = loadConfig();
  const resellerApi = createResellerApiClient({
    baseUrl: config.resellerApiBaseUrl,
    apiKey: config.resellerApiKey,
    generateLoaderTimeoutMs: config.generateLoaderTimeoutMs,
  });
  const auditLogger = createAuditLogger({
    logFilePath: config.auditLogFilePath,
  });

  const commands = [
    createResetHwidCommand({
      allowedUserIds: config.allowedDiscordUserIds,
      allowedChannelIds: config.allowedDiscordChannelIds,
      resellerApi,
      auditLogger,
    }),
    createGenerateLoaderCommand({
      allowedUserIds: config.allowedDiscordUserIds,
      allowedChannelIds: config.allowedDiscordChannelIds,
      resellerApi,
      auditLogger,
    }),
  ];
  const commandMap = new Map(commands.map((command) => [command.definition.name, command]));

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Discord bot logged in as ${readyClient.user.tag}`);
    console.log(`Audit log file: ${config.auditLogFilePath}`);
    console.log(`Generate loader timeout: ${config.generateLoaderTimeoutMs}ms`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commandMap.get(interaction.commandName);
    if (!command) {
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('Failed to handle interaction:', error);
    }
  });

  await client.login(config.discordToken);
}

main().catch((error) => {
  console.error('Failed to start Discord bot:', error);
  process.exitCode = 1;
});
