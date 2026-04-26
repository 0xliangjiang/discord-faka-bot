require('dotenv/config');

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { loadConfig } = require('./config');
const { createResetHwidCommand } = require('./commands/resethwid');
const { createGenerateLoaderCommand } = require('./commands/generateloader');

function buildSlashCommand(definition) {
  const builder = new SlashCommandBuilder()
    .setName(definition.name)
    .setDescription(definition.description);

  for (const option of definition.options) {
    builder.addStringOption((stringOption) => stringOption
      .setName(option.name)
      .setDescription(option.description)
      .setRequired(option.required));
  }

  return builder.toJSON();
}

async function main() {
  const config = loadConfig();
  const stubbedResellerApi = {
    async getUserIdByUsername() {
      throw new Error('resellerApi is not used during command deployment');
    },
    async resetHwidByUserId() {
      throw new Error('resellerApi is not used during command deployment');
    },
    async generateLoaderForUserId() {
      throw new Error('resellerApi is not used during command deployment');
    },
    async generateGenericLoader() {
      throw new Error('resellerApi is not used during command deployment');
    },
  };

  const commandDefinitions = [
    createResetHwidCommand({
      allowedUserIds: config.allowedDiscordUserIds,
      resellerApi: stubbedResellerApi,
    }).definition,
    createGenerateLoaderCommand({
      allowedUserIds: config.allowedDiscordUserIds,
      resellerApi: stubbedResellerApi,
    }).definition,
  ];

  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  await rest.put(
    Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
    { body: commandDefinitions.map(buildSlashCommand) },
  );

  console.log('Slash commands deployed successfully.');
}

main().catch((error) => {
  console.error('Failed to deploy slash commands:', error);
  process.exitCode = 1;
});
