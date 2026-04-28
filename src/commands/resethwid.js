const { MessageFlags } = require('discord.js');
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

function createResetHwidCommand({
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
      name: 'resethwid',
      description: '通过用户名解绑用户机器码（HWID）',
      options: [
        {
          name: 'username',
          description: '需要解绑 HWID 的用户名',
          type: 3,
          required: true,
        },
      ],
    },
    async execute(interaction) {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      const username = interaction.options.getString('username', true).trim();
      const baseAuditEvent = {
        event: 'resethwid_attempt',
        actorDiscordUserId: interaction.user.id,
        actorDiscordTag: interaction.user.tag || interaction.user.username || null,
        commandName: interaction.commandName || 'resethwid',
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

        await resellerApi.resetHwidByUserId(userId);
        await auditLogger.log({
          ...baseAuditEvent,
          targetUserId: userId,
          outcome: 'success',
          errorMessage: null,
        });
        await sendPrivateResponse(interaction, {
          content: `已成功解绑 ${username} 的 HWID`,
        });
      } catch (error) {
        const isApiError = error instanceof ResellerApiError;
        await auditLogger.log({
          ...baseAuditEvent,
          outcome: isApiError ? 'api_error' : 'unexpected_error',
          targetUserId: error?.targetUserId ?? resolvedUserId,
          errorMessage: error.message,
        });

        const content = isApiError
          ? `解绑失败：${error.message}`
          : '解绑失败：服务器请求异常';

        await sendPrivateResponse(interaction, { content });
      }
    },
  };
}

module.exports = {
  createResetHwidCommand,
};
