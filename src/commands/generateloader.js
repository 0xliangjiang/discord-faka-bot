const { EmbedBuilder, MessageFlags } = require('discord.js');
const { ResellerApiError } = require('../services/resellerApi');

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
  return new EmbedBuilder()
    .setTitle('加载器生成成功')
    .setDescription(username ? `已为用户 ${username} 生成专属加载器` : '已生成通用加载器')
    .setColor(0x57f287)
    .addFields(
      { name: '下载链接', value: loader.downloadUrl },
      { name: 'ZIP 密码', value: loader.zipPassword, inline: true },
      { name: '版本号', value: loader.version, inline: true },
      { name: '有效期', value: loader.expiresIn, inline: true },
    );
}

function createGenerateLoaderCommand({ allowedUserIds, resellerApi, auditLogger = { log: async () => {} } }) {
  if (!Array.isArray(allowedUserIds)) {
    throw new Error('allowedUserIds must be an array');
  }

  if (!resellerApi) {
    throw new Error('resellerApi is required');
  }

  if (!auditLogger || typeof auditLogger.log !== 'function') {
    throw new Error('auditLogger.log is required');
  }

  return {
    definition: {
      name: 'generateloader',
      description: '生成用户专属或通用加载器安装包',
      options: [
        {
          name: 'username',
          description: '可选，生成指定用户名的专属加载器',
          type: 3,
          required: false,
        },
      ],
    },
    async execute(interaction) {
      const rawUsername = interaction.options.getString('username', false);
      const username = rawUsername ? rawUsername.trim() : null;
      const baseAuditEvent = {
        event: 'generateloader_attempt',
        actorDiscordUserId: interaction.user.id,
        actorDiscordTag: interaction.user.tag || interaction.user.username || null,
        commandName: interaction.commandName || 'generateloader',
        targetUsername: username,
        targetUserId: null,
      };

      if (!allowedUserIds.includes(interaction.user.id)) {
        await auditLogger.log({
          ...baseAuditEvent,
          outcome: 'unauthorized',
          errorMessage: 'Unauthorized Discord user',
        });
        await sendPrivateResponse(interaction, {
          content: '你没有权限使用这个指令。',
        });
        return;
      }

      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      let resolvedUserId = null;

      try {
        let loader;

        if (username) {
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

          loader = await resellerApi.generateLoaderForUserId(userId);
        } else {
          loader = await resellerApi.generateGenericLoader();
        }

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
