const test = require('node:test');
const assert = require('node:assert/strict');

const { createResellerApiClient } = require('../src/services/resellerApi');

test('getUserIdByUsername returns a user id from reseller API customers lookup', async () => {
  const calls = [];
  const client = createResellerApiClient({
    baseUrl: 'https://playsharp.example.com/api/reseller/v1',
    apiKey: 'test-key',
    apiVersion: '2026-05-22.6',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            items: [
              {
                id: 'user_123',
                username: 'yy1234',
              },
            ],
          },
        }),
      };
    },
  });

  const userId = await client.getUserIdByUsername('yy1234');

  assert.equal(userId, 'user_123');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://playsharp.example.com/api/reseller/v1/customers?username=yy1234&limit=1');
  assert.equal(calls[0].options.method, 'GET');
  assert.deepEqual(calls[0].options.headers, {
    Authorization: 'Bearer test-key',
    'x-playsharp-reseller-api-version': '2026-05-22.6',
  });
  assert.equal(calls[0].options.body, undefined);
  assert.equal(calls[0].options.signal, undefined);
});

test('getUserIdByUsername returns null when reseller API returns no customers', async () => {
  const client = createResellerApiClient({
    baseUrl: 'https://playsharp.example.com/api/reseller/v1',
    apiKey: 'test-key',
    apiVersion: '2026-05-22.6',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          items: [],
        },
      }),
    }),
  });

  const userId = await client.getUserIdByUsername('missing-user');

  assert.equal(userId, null);
});

test('resetHwidByUserId posts to the customer HWID endpoint with bearer auth and idempotency key', async () => {
  const calls = [];
  const client = createResellerApiClient({
    baseUrl: 'https://playsharp.example.com/api/reseller/v1',
    apiKey: 'test-key',
    apiVersion: '2026-05-22.6',
    idempotencyKeyFactory: () => 'fixed-idempotency-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: { reset: true },
        }),
      };
    },
  });

  const result = await client.resetHwidByUserId('user_123');

  assert.deepEqual(result, {
    message: 'HWID 重置成功',
    data: { reset: true },
    endpoint: '/customers/user_123/hwid',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://playsharp.example.com/api/reseller/v1/customers/user_123/hwid');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(calls[0].options.headers, {
    Authorization: 'Bearer test-key',
    'Idempotency-Key': 'fixed-idempotency-key',
    'x-playsharp-reseller-api-version': '2026-05-22.6',
  });
  assert.equal(calls[0].options.body, undefined);
});

test('resetHwidByUserId throws updated reseller API errors with their message', async () => {
  const client = createResellerApiClient({
    baseUrl: 'https://playsharp.example.com/api/reseller/v1',
    apiKey: 'test-key',
    apiVersion: '2026-05-22.6',
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        ok: false,
        error: { code: 'forbidden', message: '无权限' },
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

test('generateLoaderForUserId posts a loader build with bearer auth and idempotency key', async () => {
  const calls = [];
  const client = createResellerApiClient({
    baseUrl: 'https://noaserver.com/resellerApi',
    loaderBuildsBaseUrl: 'https://playsharp.example.com/api/reseller/v1',
    apiKey: 'test-key',
    apiVersion: '2026-05-22.6',
    idempotencyKeyFactory: () => 'fixed-idempotency-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url === 'https://playsharp.example.com/api/reseller/v1/loader-builds/cmpgbuild123') {
        if (options.method === 'POST') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              data: { ok: true },
              requestId: 'req_process',
            }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: {
              id: 'cmpgbuild123',
              status: 'READY',
              loaderVersion: '342',
              zipPassword: 'zip-secret',
              downloadUrl: 'https://example.com/loader.zip',
              downloadExpiresAt: '2026-05-22T03:47:17.836Z',
              createdAt: '2026-05-21T17:00:00.000Z',
              completedAt: '2026-05-22T02:47:17.836Z',
            },
            requestId: 'req_detail',
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            id: 'cmpgbuild123',
            status: 'QUEUED',
            createdAt: '2026-05-21T17:00:00.000Z',
          },
          requestId: 'req_create',
        }),
      };
    },
  });

  const result = await client.generateLoaderForUserId('user_123');

  assert.deepEqual(result, {
    id: 'cmpgbuild123',
    status: 'READY',
    loaderVersion: '342',
    zipPassword: 'zip-secret',
    downloadUrl: 'https://example.com/loader.zip',
    downloadExpiresAt: '2026-05-22T03:47:17.836Z',
    createdAt: '2026-05-21T17:00:00.000Z',
    completedAt: '2026-05-22T02:47:17.836Z',
    requestId: 'req_detail',
    requestBody: {
      userId: 'user_123',
      count: 1,
    },
  });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, 'https://playsharp.example.com/api/reseller/v1/loader-builds');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(calls[0].options.headers, {
    Authorization: 'Bearer test-key',
    'Content-Type': 'application/json',
    'Idempotency-Key': 'fixed-idempotency-key',
    'x-playsharp-reseller-api-version': '2026-05-22.6',
  });
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    userId: 'user_123',
    count: 1,
  });
  assert.equal(calls[1].url, 'https://playsharp.example.com/api/reseller/v1/loader-builds/cmpgbuild123');
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[2].url, 'https://playsharp.example.com/api/reseller/v1/loader-builds/cmpgbuild123');
  assert.equal(calls[2].options.method, 'GET');
});

test('generateLoaderForUserId falls back to the latest user loader build when create response has no id', async () => {
  const calls = [];
  const client = createResellerApiClient({
    baseUrl: 'https://noaserver.com/resellerApi',
    loaderBuildsBaseUrl: 'https://playsharp.example.com/api/reseller/v1',
    apiKey: 'test-key',
    apiVersion: '2026-05-22.6',
    idempotencyKeyFactory: () => 'fixed-idempotency-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url === 'https://playsharp.example.com/api/reseller/v1/loader-builds?userId=user_123&limit=1') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: {
              items: [
                {
                  id: 'fallback_build',
                  status: 'QUEUED',
                  createdAt: '2026-05-22T03:00:53.200Z',
                },
              ],
            },
          }),
        };
      }
      if (url === 'https://playsharp.example.com/api/reseller/v1/loader-builds/fallback_build') {
        if (options.method === 'POST') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              data: { ok: true },
            }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: {
              id: 'fallback_build',
              status: 'READY',
              downloadUrl: 'https://example.com/fallback-loader.zip',
              zipPassword: 'fallback-secret',
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: { ok: true },
          requestId: 'req_create_without_id',
        }),
      };
    },
  });

  const result = await client.generateLoaderForUserId('user_123');

  assert.equal(result.id, 'fallback_build');
  assert.equal(result.status, 'READY');
  assert.equal(result.downloadUrl, 'https://example.com/fallback-loader.zip');
  assert.equal(result.zipPassword, 'fallback-secret');
  assert.equal(calls[1].url, 'https://playsharp.example.com/api/reseller/v1/loader-builds?userId=user_123&limit=1');
  assert.equal(calls[2].url, 'https://playsharp.example.com/api/reseller/v1/loader-builds/fallback_build');
  assert.equal(calls[2].options.method, 'POST');
  assert.equal(calls[3].url, 'https://playsharp.example.com/api/reseller/v1/loader-builds/fallback_build');
  assert.equal(calls[3].options.method, 'GET');
});

test('getActiveLicensesByUserId returns only active licenses for a customer', async () => {
  const calls = [];
  const client = createResellerApiClient({
    baseUrl: 'https://playsharp.example.com/api/reseller/v1',
    apiKey: 'test-key',
    apiVersion: '2026-05-22.6',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            items: [
              {
                id: 'license_active',
                status: 'ACTIVE',
                expiresAt: '2026-06-21T17:00:00.000Z',
              },
              {
                id: 'license_expired',
                status: 'EXPIRED',
                expiresAt: '2026-05-10T17:00:00.000Z',
              },
            ],
          },
        }),
      };
    },
  });

  const result = await client.getActiveLicensesByUserId('user_123');

  assert.deepEqual(result, [
    {
      id: 'license_active',
      status: 'ACTIVE',
      expiresAt: '2026-06-21T17:00:00.000Z',
    },
  ]);
  assert.equal(calls[0].url, 'https://playsharp.example.com/api/reseller/v1/customers/user_123/licenses?limit=100');
  assert.equal(calls[0].options.method, 'GET');
});

test('generateLoaderForUserId passes a 6 minute abort signal timeout to long-running loader build mutations', async () => {
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
      loaderBuildsBaseUrl: 'https://playsharp.example.com/api/reseller/v1',
      apiKey: 'test-key',
      apiVersion: '2026-05-22.6',
      generateLoaderTimeoutMs: 360000,
      fetchImpl: async (_url, options) => {
        calls.push(options);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: {
              id: 'item_123',
              status: 'ACTIVE',
              createdAt: '2026-05-21T17:00:00.000Z',
            },
          }),
        };
      },
    });

    await client.generateLoaderForUserId(456);

    assert.deepEqual(timeoutCalls, [360000, 360000]);
    assert.equal(calls[0].signal, fakeSignal);
    assert.equal(calls[1].signal, fakeSignal);
    assert.equal(calls[2].signal, undefined);
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
      apiVersion: '2026-05-22.6',
      generateLoaderTimeoutMs: 360000,
      fetchImpl: async (_url, options) => {
        calls.push(options);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: {
              items: [
                {
                  id: 'user_123',
                  username: 'yy1234',
                },
              ],
            },
          }),
        };
      },
    });

    const userId = await client.getUserIdByUsername('yy1234');

    assert.equal(userId, 'user_123');
    assert.equal(timeoutCalled, false);
    assert.equal(calls[0].signal, undefined);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});
