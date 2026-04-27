function ensureArray(value, keyName) {
  if (!Array.isArray(value)) {
    throw new Error(`${keyName} must be an array`);
  }
}

function getPermissionDenial({ interaction, allowedUserIds = [], allowedChannelIds = [] }) {
  ensureArray(allowedUserIds, 'allowedUserIds');
  ensureArray(allowedChannelIds, 'allowedChannelIds');

  if (allowedUserIds.length > 0 && !allowedUserIds.includes(interaction.user.id)) {
    return {
      outcome: 'unauthorized',
      errorMessage: 'Unauthorized Discord user',
      content: '你没有权限使用这个指令。',
    };
  }

  if (allowedChannelIds.length > 0 && !allowedChannelIds.includes(interaction.channelId)) {
    return {
      outcome: 'unauthorized_channel',
      errorMessage: 'Unauthorized Discord channel',
      content: '这个指令只能在指定频道使用。',
    };
  }

  return null;
}

module.exports = {
  getPermissionDenial,
};
