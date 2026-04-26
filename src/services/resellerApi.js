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
  apiKey,
  fetchImpl = globalThis.fetch,
  generateLoaderTimeoutMs = 360000,
}) {
  if (!baseUrl) {
    throw new Error('RESELLER_API_BASE_URL is required');
  }

  if (!apiKey) {
    throw new Error('RESELLER_API_KEY is required');
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required');
  }

  async function post(payload, extraOptions = {}) {
    const response = await fetchImpl(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
      ...extraOptions,
    });

    let data;
    try {
      data = await response.json();
    } catch (_error) {
      throw new ResellerApiError('Reseller API returned invalid JSON', response.status);
    }

    const status = data?.status;
    if (!response.ok || status?.error) {
      throw new ResellerApiError(status?.message || 'Reseller API request failed', response.status, data);
    }

    return data;
  }

  async function getUserIdByUsername(username) {
    try {
      const data = await post({
        action: 'getUserByDetails',
        username,
      });
      return data.userId ?? null;
    } catch (error) {
      if (error instanceof ResellerApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async function resetHwidByUserId(userId) {
    const requestBody = {
      action: 'resetHwid',
      userId,
    };

    try {
      const data = await post(requestBody);
      return {
        message: data?.status?.message || 'HWID 重置成功',
        requestBody,
      };
    } catch (error) {
      if (
        error instanceof ResellerApiError &&
        typeof error.message === 'string' &&
        /already\s+reset/i.test(error.message)
      ) {
        return {
          message: error.message,
          requestBody,
          alreadyReset: true,
        };
      }
      throw error;
    }
  }

  async function generateLoader(requestBody) {
    const data = await post(requestBody, {
      signal: AbortSignal.timeout(generateLoaderTimeoutMs),
    });
    return {
      downloadUrl: data.downloadUrl,
      zipPassword: data.zipPassword,
      version: data.version,
      expiresIn: data.expiresIn,
      requestBody,
    };
  }

  async function generateLoaderForUserId(userId) {
    return generateLoader({
      action: 'generateLoader',
      userId,
    });
  }

  async function generateGenericLoader() {
    return generateLoader({
      action: 'generateLoader',
    });
  }

  return {
    getUserIdByUsername,
    resetHwidByUserId,
    generateLoaderForUserId,
    generateGenericLoader,
  };
}

module.exports = {
  ResellerApiError,
  createResellerApiClient,
};
