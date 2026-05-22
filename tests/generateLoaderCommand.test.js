const test = require('node:test');
const assert = require('node:assert/strict');
const { EmbedBuilder, MessageFlags } = require('discord.js');

const { createGenerateLoaderCommand } = require('../src/commands/generateloader');
const { ResellerApiError } = require('../src/services/resellerApi');

function createInteraction(username, userId = '123456', tag = 'admin#0001', channelId = 'channel-1') {
  const replies = [];
  const deferredReplies = [];
  const editedReplies = [];

  return {
    user: { id: userId, tag },
    channelId,
    options: {
      getString(name, required) {
        assert.equal(name, 'username');
        assert.equal(required, true);
        return username;
      },
    },
    commandName: 'generateloader',
    deferred: false,
    replied: false,
    async deferReply(payload) {
      this.deferred = true;
      deferredReplies.push(payload);
    },
    async reply(payload) {
      this.replied = true;
      replies.push(payload);
    },
    async editReply(payload) {
      this.replied = true;
      editedReplies.push(payload);
    },
    get replies() {
      return replies;
    },
    get deferredReplies() {
      return deferredReplies;
    },
    get editedReplies() {
      return editedReplies;
    },
  };
}

function normalizeEmbed(embedLike) {
  if (embedLike instanceof EmbedBuilder) {
    return embedLike.toJSON();
  }
  return embedLike;
}

test('generateLoader rejects callers outside allowed Discord user IDs and audits it', async () => {
  const interaction = createInteraction('yy1234', 'not-allowed');
  const auditEvents = [];
  const command = createGenerateLoaderCommand({
    allowedUserIds: ['10001'],
    resellerApi: {},
    auditLogger: { async log(event) { auditEvents.push(event); } },
  });

  await command.execute(interaction);

  assert.deepEqual(interaction.deferredReplies, []);
  assert.deepEqual(interaction.replies, [{
    flags: MessageFlags.Ephemeral,
    content: '你没有权限使用这个指令。',
  }]);
  assert.deepEqual(interaction.editedReplies, []);
  assert.deepEqual(auditEvents, [{
    event: 'generateloader_attempt',
    actorDiscordUserId: 'not-allowed',
    actorDiscordTag: 'admin#0001',
    commandName: 'generateloader',
    targetUsername: 'yy1234',
    targetUserId: null,
    outcome: 'unauthorized',
    errorMessage: 'Unauthorized Discord user',
  }]);
});

test('generateLoader allows any caller in an allowed channel when user IDs are not configured', async () => {
  const interaction = createInteraction('yy1234', 'any-user', 'user#0001', 'allowed-channel');
  const auditEvents = [];
  const command = createGenerateLoaderCommand({
    allowedUserIds: [],
    allowedChannelIds: ['allowed-channel'],
    resellerApi: {
      async getUserIdByUsername() {
        return 'user_123';
      },
      async generateLoaderForUserId() {
        return {
          id: 'item_123',
          status: 'READY',
          loaderVersion: '342',
          downloadUrl: 'https://example.com/loader.zip',
          zipPassword: 'zip-secret',
          downloadExpiresAt: '2026-05-22T03:47:17.836Z',
          createdAt: '2026-05-21T17:00:00.000Z',
        };
      },
      async getActiveLicensesByUserId() {
        return [{ id: 'license_123', status: 'ACTIVE' }];
      },
    },
    auditLogger: { async log(event) { auditEvents.push(event); } },
  });

  await command.execute(interaction);

  assert.deepEqual(interaction.deferredReplies, [{ flags: MessageFlags.Ephemeral }]);
  assert.deepEqual(interaction.replies, []);
  assert.equal(interaction.editedReplies.length, 1);
  assert.equal(auditEvents[0].outcome, 'success');
});

test('generateLoader resolves username to userId and returns loader details in an embed', async () => {
  const interaction = createInteraction('yy1234', '10001');
  const auditEvents = [];
  const command = createGenerateLoaderCommand({
    allowedUserIds: ['10001'],
    resellerApi: {
      async getUserIdByUsername(username) {
        assert.equal(username, 'yy1234');
        return 7788;
      },
      async generateLoaderForUserId(userId) {
        assert.equal(userId, 7788);
        return {
          id: 'item_123',
          status: 'READY',
          loaderVersion: '342',
          downloadUrl: 'https://example.com/loader.zip',
          zipPassword: 'zip-secret',
          downloadExpiresAt: '2026-05-22T03:47:17.836Z',
          createdAt: '2026-05-21T17:00:00.000Z',
          requestId: 'req_01HXAMPLE123456789',
        };
      },
      async getActiveLicensesByUserId(userId) {
        assert.equal(userId, 7788);
        return [{ id: 'license_123', status: 'ACTIVE' }];
      },
    },
    auditLogger: { async log(event) { auditEvents.push(event); } },
  });

  await command.execute(interaction);

  assert.deepEqual(interaction.deferredReplies, [{ flags: MessageFlags.Ephemeral }]);
  assert.deepEqual(interaction.replies, []);
  assert.equal(interaction.editedReplies.length, 1);
  assert.equal(interaction.editedReplies[0].content, undefined);
  assert.equal(interaction.editedReplies[0].embeds.length, 1);
  assert.deepEqual(normalizeEmbed(interaction.editedReplies[0].embeds[0]), {
    title: '加载器生成成功',
    description: '已为用户 yy1234 创建加载器构建',
    color: 0x57f287,
    fields: [
      { name: '下载链接', value: 'https://example.com/loader.zip' },
      { name: 'ZIP 密码', value: 'zip-secret', inline: true },
      { name: '版本号', value: '342', inline: true },
      { name: '构建 ID', value: 'item_123' },
      { name: '状态', value: 'READY', inline: true },
      { name: '过期时间', value: '2026-05-22T03:47:17.836Z', inline: true },
    ],
  });
  assert.deepEqual(auditEvents, [{
    event: 'generateloader_attempt',
    actorDiscordUserId: '10001',
    actorDiscordTag: 'admin#0001',
    commandName: 'generateloader',
    targetUsername: 'yy1234',
    targetUserId: 7788,
    outcome: 'success',
    errorMessage: null,
  }]);
});

test('generateLoader reports when username cannot be found', async () => {
  const interaction = createInteraction('missing-user', '10001');
  const auditEvents = [];
  const command = createGenerateLoaderCommand({
    allowedUserIds: ['10001'],
    resellerApi: {
      async getUserIdByUsername(username) {
        assert.equal(username, 'missing-user');
        return null;
      },
      async generateLoaderForUserId() {
        throw new Error('should not be called');
      },
      async getActiveLicensesByUserId() {
        throw new Error('should not be called');
      },
    },
    auditLogger: { async log(event) { auditEvents.push(event); } },
  });

  await command.execute(interaction);

  assert.deepEqual(interaction.editedReplies, [{
    content: '未找到用户 missing-user',
  }]);
  assert.deepEqual(auditEvents, [{
    event: 'generateloader_attempt',
    actorDiscordUserId: '10001',
    actorDiscordTag: 'admin#0001',
    commandName: 'generateloader',
    targetUsername: 'missing-user',
    targetUserId: null,
    outcome: 'user_not_found',
    errorMessage: 'User not found',
  }]);
});

test('generateLoader returns reseller API error messages privately', async () => {
  const interaction = createInteraction('yy1234', '10001');
  const auditEvents = [];
  const command = createGenerateLoaderCommand({
    allowedUserIds: ['10001'],
    resellerApi: {
      async getUserIdByUsername() {
        return 7788;
      },
      async generateLoaderForUserId() {
        throw new ResellerApiError('用户无有效订阅', 400);
      },
      async getActiveLicensesByUserId() {
        return [{ id: 'license_123', status: 'ACTIVE' }];
      },
    },
    auditLogger: { async log(event) { auditEvents.push(event); } },
  });

  await command.execute(interaction);

  assert.deepEqual(interaction.editedReplies, [{
    content: '生成失败：用户无有效订阅',
  }]);
  assert.deepEqual(auditEvents, [{
    event: 'generateloader_attempt',
    actorDiscordUserId: '10001',
    actorDiscordTag: 'admin#0001',
    commandName: 'generateloader',
    targetUsername: 'yy1234',
    targetUserId: 7788,
    outcome: 'api_error',
    errorMessage: '用户无有效订阅',
  }]);
});

test('generateLoader reports when user has no active licenses before creating a loader build', async () => {
  const interaction = createInteraction('aha666', '10001');
  const auditEvents = [];
  const command = createGenerateLoaderCommand({
    allowedUserIds: ['10001'],
    resellerApi: {
      async getUserIdByUsername() {
        return 'user_123';
      },
      async getActiveLicensesByUserId(userId) {
        assert.equal(userId, 'user_123');
        return [];
      },
      async generateLoaderForUserId() {
        throw new Error('should not be called');
      },
    },
    auditLogger: { async log(event) { auditEvents.push(event); } },
  });

  await command.execute(interaction);

  assert.deepEqual(interaction.editedReplies, [{
    content: '生成失败：用户无有效订阅',
  }]);
  assert.deepEqual(auditEvents, [{
    event: 'generateloader_attempt',
    actorDiscordUserId: '10001',
    actorDiscordTag: 'admin#0001',
    commandName: 'generateloader',
    targetUsername: 'aha666',
    targetUserId: 'user_123',
    outcome: 'api_error',
    errorMessage: '用户无有效订阅',
  }]);
});
