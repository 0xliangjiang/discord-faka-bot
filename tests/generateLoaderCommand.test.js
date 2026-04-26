const test = require('node:test');
const assert = require('node:assert/strict');
const { EmbedBuilder, MessageFlags } = require('discord.js');

const { createGenerateLoaderCommand } = require('../src/commands/generateloader');
const { ResellerApiError } = require('../src/services/resellerApi');

function createInteraction(username, userId = '123456', tag = 'admin#0001') {
  const replies = [];
  const deferredReplies = [];
  const editedReplies = [];

  return {
    user: { id: userId, tag },
    options: {
      getString(name, required) {
        assert.equal(name, 'username');
        assert.equal(required, false);
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
          downloadUrl: 'https://example.com/loader.zip',
          zipPassword: 'secret',
          version: '1.2.3',
          expiresIn: '1 hour',
        };
      },
      async generateGenericLoader() {
        throw new Error('should not be called');
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
    description: '已为用户 yy1234 生成专属加载器',
    color: 0x57f287,
    fields: [
      { name: '下载链接', value: 'https://example.com/loader.zip' },
      { name: 'ZIP 密码', value: 'secret', inline: true },
      { name: '版本号', value: '1.2.3', inline: true },
      { name: '有效期', value: '1 hour', inline: true },
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

test('generateLoader supports generic loader mode without username and returns an embed', async () => {
  const interaction = createInteraction(null, '10001');
  const auditEvents = [];
  const command = createGenerateLoaderCommand({
    allowedUserIds: ['10001'],
    resellerApi: {
      async getUserIdByUsername() {
        throw new Error('should not be called');
      },
      async generateLoaderForUserId() {
        throw new Error('should not be called');
      },
      async generateGenericLoader() {
        return {
          downloadUrl: 'https://example.com/generic.zip',
          zipPassword: 'generic-secret',
          version: '2.0.0',
          expiresIn: '1 hour',
        };
      },
    },
    auditLogger: { async log(event) { auditEvents.push(event); } },
  });

  await command.execute(interaction);

  assert.equal(interaction.editedReplies.length, 1);
  assert.deepEqual(normalizeEmbed(interaction.editedReplies[0].embeds[0]), {
    title: '加载器生成成功',
    description: '已生成通用加载器',
    color: 0x57f287,
    fields: [
      { name: '下载链接', value: 'https://example.com/generic.zip' },
      { name: 'ZIP 密码', value: 'generic-secret', inline: true },
      { name: '版本号', value: '2.0.0', inline: true },
      { name: '有效期', value: '1 hour', inline: true },
    ],
  });
  assert.deepEqual(auditEvents, [{
    event: 'generateloader_attempt',
    actorDiscordUserId: '10001',
    actorDiscordTag: 'admin#0001',
    commandName: 'generateloader',
    targetUsername: null,
    targetUserId: null,
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
      async generateGenericLoader() {
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
      async generateGenericLoader() {
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
    targetUsername: 'yy1234',
    targetUserId: 7788,
    outcome: 'api_error',
    errorMessage: '用户无有效订阅',
  }]);
});
