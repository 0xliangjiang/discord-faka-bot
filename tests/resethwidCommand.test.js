const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');

const { createResetHwidCommand } = require('../src/commands/resethwid');
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
        assert.equal(required, true);
        return username;
      },
    },
    commandName: 'resethwid',
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

test('handler rejects callers outside allowed Discord user IDs and writes an audit entry', async () => {
  const interaction = createInteraction('yy1234', 'not-allowed');
  const auditEvents = [];
  const command = createResetHwidCommand({
    allowedUserIds: ['10001'],
    resellerApi: {
      async getUserIdByUsername() {
        throw new Error('should not be called');
      },
      async resetHwidByUserId() {
        throw new Error('should not be called');
      },
    },
    auditLogger: {
      async log(event) {
        auditEvents.push(event);
      },
    },
  });

  await command.execute(interaction);

  assert.deepEqual(interaction.deferredReplies, []);
  assert.deepEqual(interaction.replies, [
    {
      flags: MessageFlags.Ephemeral,
      content: '你没有权限使用这个指令。',
    },
  ]);
  assert.deepEqual(interaction.editedReplies, []);
  assert.deepEqual(auditEvents, [
    {
      actorDiscordTag: 'admin#0001',
      actorDiscordUserId: 'not-allowed',
      commandName: 'resethwid',
      errorMessage: 'Unauthorized Discord user',
      event: 'resethwid_attempt',
      outcome: 'unauthorized',
      targetUserId: null,
      targetUsername: 'yy1234',
    },
  ]);
});

test('handler defers and edits reply when username cannot be found', async () => {
  const interaction = createInteraction('missing-user', '10001');
  const auditEvents = [];
  const command = createResetHwidCommand({
    allowedUserIds: ['10001'],
    resellerApi: {
      async getUserIdByUsername(username) {
        assert.equal(username, 'missing-user');
        return null;
      },
      async resetHwidByUserId() {
        throw new Error('should not be called');
      },
    },
    auditLogger: {
      async log(event) {
        auditEvents.push(event);
      },
    },
  });

  await command.execute(interaction);

  assert.deepEqual(interaction.deferredReplies, [{ flags: MessageFlags.Ephemeral }]);
  assert.deepEqual(interaction.replies, []);
  assert.deepEqual(interaction.editedReplies, [
    {
      content: '未找到用户 missing-user',
    },
  ]);
  assert.deepEqual(auditEvents, [
    {
      actorDiscordTag: 'admin#0001',
      actorDiscordUserId: '10001',
      commandName: 'resethwid',
      errorMessage: 'User not found',
      event: 'resethwid_attempt',
      outcome: 'user_not_found',
      targetUserId: null,
      targetUsername: 'missing-user',
    },
  ]);
});

test('handler defers and edits a private success message', async () => {
  const interaction = createInteraction('yy1234', '10001');
  const auditEvents = [];
  const command = createResetHwidCommand({
    allowedUserIds: ['10001'],
    resellerApi: {
      async getUserIdByUsername(username) {
        assert.equal(username, 'yy1234');
        return 7788;
      },
      async resetHwidByUserId(userId) {
        assert.equal(userId, 7788);
        return { message: 'HWID 重置成功' };
      },
    },
    auditLogger: {
      async log(event) {
        auditEvents.push(event);
      },
    },
  });

  await command.execute(interaction);

  assert.deepEqual(interaction.deferredReplies, [{ flags: MessageFlags.Ephemeral }]);
  assert.deepEqual(interaction.replies, []);
  assert.deepEqual(interaction.editedReplies, [
    {
      content: '已成功解绑 yy1234 的 HWID',
    },
  ]);
  assert.deepEqual(auditEvents, [
    {
      actorDiscordTag: 'admin#0001',
      actorDiscordUserId: '10001',
      commandName: 'resethwid',
      errorMessage: null,
      event: 'resethwid_attempt',
      outcome: 'success',
      targetUserId: 7788,
      targetUsername: 'yy1234',
    },
  ]);
});

test('handler shows success message when HWID is already reset', async () => {
  const interaction = createInteraction('yy1234', '10001');
  const auditEvents = [];
  const command = createResetHwidCommand({
    allowedUserIds: ['10001'],
    resellerApi: {
      async getUserIdByUsername() {
        return 7788;
      },
      async resetHwidByUserId(userId) {
        assert.equal(userId, 7788);
        return { message: 'Maybe already reset', requestBody: {}, alreadyReset: true };
      },
    },
    auditLogger: {
      async log(event) {
        auditEvents.push(event);
      },
    },
  });

  await command.execute(interaction);

  assert.deepEqual(interaction.deferredReplies, [{ flags: MessageFlags.Ephemeral }]);
  assert.deepEqual(interaction.replies, []);
  assert.deepEqual(interaction.editedReplies, [
    {
      content: '已成功解绑 yy1234 的 HWID',
    },
  ]);
  assert.deepEqual(auditEvents, [
    {
      actorDiscordTag: 'admin#0001',
      actorDiscordUserId: '10001',
      commandName: 'resethwid',
      errorMessage: null,
      event: 'resethwid_attempt',
      outcome: 'success',
      targetUserId: 7788,
      targetUsername: 'yy1234',
    },
  ]);
});

test('handler edits the deferred reply when reseller API returns an error', async () => {
  const interaction = createInteraction('yy1234', '10001');
  const auditEvents = [];
  const command = createResetHwidCommand({
    allowedUserIds: ['10001'],
    resellerApi: {
      async getUserIdByUsername() {
        return 7788;
      },
      async resetHwidByUserId() {
        throw new ResellerApiError('无权限', 403);
      },
    },
    auditLogger: {
      async log(event) {
        auditEvents.push(event);
      },
    },
  });

  await command.execute(interaction);

  assert.deepEqual(interaction.deferredReplies, [{ flags: MessageFlags.Ephemeral }]);
  assert.deepEqual(interaction.replies, []);
  assert.deepEqual(interaction.editedReplies, [
    {
      content: '解绑失败：无权限',
    },
  ]);
  assert.deepEqual(auditEvents, [
    {
      actorDiscordTag: 'admin#0001',
      actorDiscordUserId: '10001',
      commandName: 'resethwid',
      errorMessage: '无权限',
      event: 'resethwid_attempt',
      outcome: 'api_error',
      targetUserId: 7788,
      targetUsername: 'yy1234',
    },
  ]);
});
