const { randomUUID } = require('node:crypto');
const { DEFAULT_PLAYSHARP_RESELLER_API_VERSION } = require('../config');

class ResellerApiError extends Error {
  constructor(message, statusCode, responseBody) {
    super(message);
    this.name = 'ResellerApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

function createResellerApiClient({
  baseUrl,
  resetHwidBaseUrl = baseUrl,
  loaderBuildsBaseUrl = resetHwidBaseUrl,
  apiKey,
  apiVersion = DEFAULT_PLAYSHARP_RESELLER_API_VERSION,
  fetchImpl = globalThis.fetch,
  generateLoaderTimeoutMs = 360000,
  idempotencyKeyFactory = randomUUID,
}) {
  if (!baseUrl) {
    throw new Error('RESELLER_API_BASE_URL is required');
  }

  if (!resetHwidBaseUrl) {
    throw new Error('RESET_HWID_API_BASE_URL is required');
  }

  if (!loaderBuildsBaseUrl) {
    throw new Error('LOADER_BUILDS_API_BASE_URL is required');
  }

  if (!apiKey) {
    throw new Error('RESELLER_API_KEY is required');
  }

  if (!apiVersion) {
    throw new Error('PLAYSHARP_RESELLER_API_VERSION is required');
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required');
  }

  if (typeof idempotencyKeyFactory !== 'function') {
    throw new Error('An idempotency key factory is required');
  }

  function buildUrl(urlBase, path) {
    return `${urlBase.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }

  function authorizationHeaders(extraHeaders = {}) {
    return {
      Authorization: `Bearer ${apiKey}`,
      'x-playsharp-reseller-api-version': apiVersion,
      ...extraHeaders,
    };
  }

  async function postHwidReset(userId) {
    const endpoint = `/customers/${encodeURIComponent(userId)}/hwid`;
    const response = await fetchImpl(buildUrl(resetHwidBaseUrl, endpoint), {
      method: 'POST',
      headers: authorizationHeaders({
        'Idempotency-Key': idempotencyKeyFactory(),
      }),
    });

    let data;
    try {
      data = await response.json();
    } catch (_error) {
      throw new ResellerApiError('Reseller API returned invalid JSON', response.status);
    }

    if (!response.ok || data?.ok === false) {
      throw new ResellerApiError(
        data?.error?.message || 'Reseller API request failed',
        response.status,
        data,
      );
    }

    return {
      message: 'HWID 重置成功',
      data: data?.data,
      endpoint,
    };
  }

  async function postJsonMutation(urlBase, endpoint, requestBody, extraOptions = {}) {
    const response = await fetchImpl(buildUrl(urlBase, endpoint), {
      method: 'POST',
      headers: authorizationHeaders({
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKeyFactory(),
      }),
      body: JSON.stringify(requestBody),
      ...extraOptions,
    });

    let data;
    try {
      data = await response.json();
    } catch (_error) {
      throw new ResellerApiError('Reseller API returned invalid JSON', response.status);
    }

    if (!response.ok || data?.ok === false) {
      throw new ResellerApiError(
        data?.error?.message || 'Reseller API request failed',
        response.status,
        data,
      );
    }

    return data;
  }

  async function postMutation(urlBase, endpoint, extraOptions = {}) {
    const response = await fetchImpl(buildUrl(urlBase, endpoint), {
      method: 'POST',
      headers: authorizationHeaders({
        'Idempotency-Key': idempotencyKeyFactory(),
      }),
      ...extraOptions,
    });

    let data;
    try {
      data = await response.json();
    } catch (_error) {
      throw new ResellerApiError('Reseller API returned invalid JSON', response.status);
    }

    if (!response.ok || data?.ok === false) {
      throw new ResellerApiError(
        data?.error?.message || 'Reseller API request failed',
        response.status,
        data,
      );
    }

    return data;
  }

  async function getJson(urlBase, endpoint) {
    const response = await fetchImpl(buildUrl(urlBase, endpoint), {
      method: 'GET',
      headers: authorizationHeaders(),
    });

    let data;
    try {
      data = await response.json();
    } catch (_error) {
      throw new ResellerApiError('Reseller API returned invalid JSON', response.status);
    }

    if (!response.ok || data?.ok === false) {
      throw new ResellerApiError(
        data?.error?.message || 'Reseller API request failed',
        response.status,
        data,
      );
    }

    return data;
  }

  async function getUserIdByUsername(username) {
    const query = new URLSearchParams({
      username,
      limit: '1',
    });
    const data = await getJson(baseUrl, `/customers?${query.toString()}`);
    const customers = Array.isArray(data?.data?.items)
      ? data.data.items
      : Array.isArray(data?.data)
        ? data.data
        : [];
    const customer = customers.find((item) => item?.username === username) || customers[0];
    return customer?.id || customer?.userId || null;
  }

  async function getActiveLicensesByUserId(userId) {
    const data = await getJson(baseUrl, `/customers/${encodeURIComponent(userId)}/licenses?limit=100`);
    const licenses = Array.isArray(data?.data?.items)
      ? data.data.items
      : Array.isArray(data?.data)
        ? data.data
        : [];
    return licenses.filter((license) => license?.status === 'ACTIVE');
  }

  async function getLatestLoaderBuildByUserId(userId) {
    const query = new URLSearchParams({
      userId,
      limit: '1',
    });
    const data = await getJson(loaderBuildsBaseUrl, `/loader-builds?${query.toString()}`);
    const builds = Array.isArray(data?.data?.items)
      ? data.data.items
      : Array.isArray(data?.data)
        ? data.data
        : [];
    return builds[0] || null;
  }

  async function resetHwidByUserId(userId) {
    try {
      return await postHwidReset(userId);
    } catch (error) {
      if (
        error instanceof ResellerApiError &&
        typeof error.message === 'string' &&
        /already\s+reset/i.test(error.message)
      ) {
        return {
          message: error.message,
          alreadyReset: true,
        };
      }
      throw error;
    }
  }

  async function generateLoader(requestBody) {
    const createData = await postJsonMutation(loaderBuildsBaseUrl, '/loader-builds', requestBody, {
      signal: AbortSignal.timeout(generateLoaderTimeoutMs),
    });
    const createdBuild = createData?.data || {};
    let buildId = createdBuild.id;

    if (!buildId) {
      const latestBuild = await getLatestLoaderBuildByUserId(requestBody.userId);
      buildId = latestBuild?.id;
    }

    if (!buildId) {
      throw new ResellerApiError('Loader build was created but no build id was returned', 500, createData);
    }

    await postMutation(loaderBuildsBaseUrl, `/loader-builds/${encodeURIComponent(buildId)}`, {
      signal: AbortSignal.timeout(generateLoaderTimeoutMs),
    });

    const detailData = await getJson(loaderBuildsBaseUrl, `/loader-builds/${encodeURIComponent(buildId)}`);
    const loaderBuild = detailData?.data || {};
    return {
      id: loaderBuild.id,
      status: loaderBuild.status,
      loaderVersion: loaderBuild.loaderVersion,
      zipPassword: loaderBuild.zipPassword,
      downloadUrl: loaderBuild.downloadUrl,
      downloadExpiresAt: loaderBuild.downloadExpiresAt,
      createdAt: loaderBuild.createdAt,
      completedAt: loaderBuild.completedAt,
      requestId: detailData?.requestId || createData?.requestId || null,
      requestBody,
    };
  }

  async function generateLoaderForUserId(userId) {
    return generateLoader({
      userId,
      count: 1,
    });
  }

  return {
    getUserIdByUsername,
    getActiveLicensesByUserId,
    resetHwidByUserId,
    generateLoaderForUserId,
  };
}

module.exports = {
  ResellerApiError,
  createResellerApiClient,
};
