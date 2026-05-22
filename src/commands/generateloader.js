const { EmbedBuilder, MessageFlags } = require('discord.js');
const { ResellerApiError } = require('../services/resellerApi');
const { getPermissionDenial } = require('../permissions');

async function sendPrivateResponse(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
    return;
  }

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    ...payload,
  });
}

function buildLoaderEmbed(loader, username) {
  const fields = [];

  if (loader.downloadUrl) {
    fields.push({ name: '下载链接', value: loader.downloadUrl });
  }

  if (loader.zipPassword) {
    fields.push({ name: 'ZIP 密码', value: loader.zipPassword, inline: true });
  }

  if (loader.loaderVersion) {
    fields.push({ name: '版本号', value: loader.loaderVersion, inline: true });
  }

  fields.push(
    { name: '构建 ID', value: loader.id || '未知' },
    { name: '状态', value: loader.status || '未知', inline: true },
  );

  if (loader.downloadExpiresAt) {
    fields.push({ name: '过期时间', value: loader.downloadExpiresAt, inline: true });
  } else {
    fields.push({ name: '创建时间', value: loader.createdAt || '未知', inline: true });
  }

  return new EmbedBuilder()
    .setTitle('加载器生成成功')
    .setDescription(`已为用户 ${username} 创建加载器构建`)
    .setColor(0x57f287)
    .addFields(fields);
}

function createGenerateLoaderCommand({
  allowedUserIds = [],
  allowedChannelIds = [],
  resellerApi,
  auditLogger = { log: async () => {} },
}) {
  if (!resellerApi) {
    throw new Error('resellerApi is required');
  }

  if (!auditLogger || typeof auditLogger.log !== 'function') {
    throw new Error('auditLogger.log is required');
  }

  return {
    definition: {
      name: 'generateloader',
      description: '为指定用户创建加载器构建',
      options: [
        {
          name: 'username',
          description: '需要生成加载器的用户名',
          type: 3,
          required: true,
        },
      ],
    },
    async execute(interaction) {
      const rawUsername = interaction.options.getString('username', true);
      const username = rawUsername.trim();
      const baseAuditEvent = {
        event: 'generateloader_attempt',
        actorDiscordUserId: interaction.user.id,
        actorDiscordTag: interaction.user.tag || interaction.user.username || null,
        commandName: interaction.commandName || 'generateloader',
        targetUsername: username,
        targetUserId: null,
      };

      const permissionDenial = getPermissionDenial({
        interaction,
        allowedUserIds,
        allowedChannelIds,
      });

      if (permissionDenial) {
        await auditLogger.log({
          ...baseAuditEvent,
          outcome: permissionDenial.outcome,
          errorMessage: permissionDenial.errorMessage,
        });
        await sendPrivateResponse(interaction, {
          content: permissionDenial.content,
        });
        return;
      }

      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      let resolvedUserId = null;

      try {
        const userId = await resellerApi.getUserIdByUsername(username);
        resolvedUserId = userId;
        if (!userId) {
          await auditLogger.log({
            ...baseAuditEvent,
            outcome: 'user_not_found',
            errorMessage: 'User not found',
          });
          await sendPrivateResponse(interaction, {
            content: `未找到用户 ${username}`,
          });
          return;
        }

        const activeLicenses = await resellerApi.getActiveLicensesByUserId(userId);
        if (activeLicenses.length === 0) {
          throw new ResellerApiError('用户无有效订阅', 400);
        }

        const loader = await resellerApi.generateLoaderForUserId(userId);

        await auditLogger.log({
          ...baseAuditEvent,
          targetUserId: resolvedUserId,
          outcome: 'success',
          errorMessage: null,
        });
        await sendPrivateResponse(interaction, {
          embeds: [buildLoaderEmbed(loader, username)],
        });
      } catch (error) {
        const isApiError = error instanceof ResellerApiError;
        await auditLogger.log({
          ...baseAuditEvent,
          targetUserId: error?.targetUserId ?? resolvedUserId,
          outcome: isApiError ? 'api_error' : 'unexpected_error',
          errorMessage: error.message,
        });

        const content = isApiError
          ? `生成失败：${error.message}`
          : '生成失败：服务器请求异常';

        await sendPrivateResponse(interaction, { content });
      }
    },
  };
}

module.exports = {
  createGenerateLoaderCommand,
};
