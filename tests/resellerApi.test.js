const test = require('node:test');
const assert = require('node:assert/strict');

const { createResellerApiClient } = require('../src/services/resellerApi');

test('getUserIdByUsername returns a user id from reseller API lookup', async () => {
  const calls = [];
  const client = createResellerApiClient({
    baseUrl: 'https://noaserver.com/resellerApi',
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: { error: 0, message: 'ok' },
          userId: 123,
        }),
      };
    },
  });

  const userId = await client.getUserIdByUsername('yy1234');

  assert.equal(userId, 123);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://noaserver.com/resellerApi');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['x-api-key'], 'test-key');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    action: 'getUserByDetails',
    username: 'yy1234',
  });
  assert.equal(calls[0].options.signal, undefined);
});

test('getUserIdByUsername returns null when reseller API says user does not exist', async () => {
  const client = createResellerApiClient({
    baseUrl: 'https://noaserver.com/resellerApi',
    apiKey: 'test-key',
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      json: async () => ({
        status: { error: 1, message: '用户不存在' },
      }),
    }),
  });

  const userId = await client.getUserIdByUsername('missing-user');

  assert.equal(userId, null);
});

test('resetHwidByUserId sends resetHwid action and returns API message', async () => {
  const client = createResellerApiClient({
    baseUrl: 'https://noaserver.com/resellerApi',
    apiKey: 'test-key',
    fetchImpl: async (_url, options) => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: { error: 0, message: 'HWID 重置成功' },
        echoedBody: JSON.parse(options.body),
      }),
    }),
  });

  const result = await client.resetHwidByUserId(456);

  assert.equal(result.message, 'HWID 重置成功');
  assert.deepEqual(result.requestBody, {
    action: 'resetHwid',
    userId: 456,
  });
});

test('resetHwidByUserId throws reseller API errors with their message', async () => {
  const client = createResellerApiClient({
    baseUrl: 'https://noaserver.com/resellerApi',
    apiKey: 'test-key',
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        status: { error: 1, message: '无权限' },
      }),
    }),
  });

  await assert.rejects(
    () => client.resetHwidByUserId(456),
    (error) => {
      assert.equal(error.message, '无权限');
      assert.equal(error.name, 'ResellerApiError');
      assert.equal(error.statusCode, 403);
      return true;
    },
  );
});

test('generateLoaderForUserId sends generateLoader with userId and returns loader fields', async () => {
  const client = createResellerApiClient({
    baseUrl: 'https://noaserver.com/resellerApi',
    apiKey: 'test-key',
    fetchImpl: async (_url, options) => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: { error: 0, message: '加载器生成成功' },
        downloadUrl: 'https://example.com/loader.zip',
        zipPassword: 'secret',
        version: '1.2.3',
        expiresIn: '1 hour',
        echoedBody: JSON.parse(options.body),
      }),
    }),
  });

  const result = await client.generateLoaderForUserId(456);

  assert.deepEqual(result, {
    downloadUrl: 'https://example.com/loader.zip',
    zipPassword: 'secret',
    version: '1.2.3',
    expiresIn: '1 hour',
    requestBody: {
      action: 'generateLoader',
      userId: 456,
    },
  });
});

test('generateGenericLoader sends generateLoader without userId', async () => {
  const client = createResellerApiClient({
    baseUrl: 'https://noaserver.com/resellerApi',
    apiKey: 'test-key',
    fetchImpl: async (_url, options) => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: { error: 0, message: '加载器生成成功' },
        downloadUrl: 'https://example.com/generic.zip',
        zipPassword: 'generic-secret',
        version: '2.0.0',
        expiresIn: '1 hour',
        echoedBody: JSON.parse(options.body),
      }),
    }),
  });

  const result = await client.generateGenericLoader();

  assert.deepEqual(result, {
    downloadUrl: 'https://example.com/generic.zip',
    zipPassword: 'generic-secret',
    version: '2.0.0',
    expiresIn: '1 hour',
    requestBody: {
      action: 'generateLoader',
    },
  });
});

test('generateLoaderForUserId passes a 6 minute abort signal timeout to fetch', async () => {
  const timeoutCalls = [];
  const originalTimeout = AbortSignal.timeout;
  const fakeSignal = { fake: true };
  AbortSignal.timeout = (ms) => {
    timeoutCalls.push(ms);
    return fakeSignal;
  };

  try {
    const calls = [];
    const client = createResellerApiClient({
      baseUrl: 'https://noaserver.com/resellerApi',
      apiKey: 'test-key',
      generateLoaderTimeoutMs: 360000,
      fetchImpl: async (_url, options) => {
        calls.push(options);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: { error: 0, message: '加载器生成成功' },
            downloadUrl: 'https://example.com/loader.zip',
            zipPassword: 'secret',
            version: '1.2.3',
            expiresIn: '1 hour',
          }),
        };
      },
    });

    await client.generateLoaderForUserId(456);

    assert.deepEqual(timeoutCalls, [360000]);
    assert.equal(calls[0].signal, fakeSignal);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test('getUserIdByUsername does not attach the long loader timeout signal', async () => {
  const originalTimeout = AbortSignal.timeout;
  let timeoutCalled = false;
  AbortSignal.timeout = () => {
    timeoutCalled = true;
    return { fake: true };
  };

  try {
    const calls = [];
    const client = createResellerApiClient({
      baseUrl: 'https://noaserver.com/resellerApi',
      apiKey: 'test-key',
      generateLoaderTimeoutMs: 360000,
      fetchImpl: async (_url, options) => {
        calls.push(options);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: { error: 0, message: 'ok' },
            userId: 123,
          }),
        };
      },
    });

    const userId = await client.getUserIdByUsername('yy1234');

    assert.equal(userId, 123);
    assert.equal(timeoutCalled, false);
    assert.equal(calls[0].signal, undefined);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});
