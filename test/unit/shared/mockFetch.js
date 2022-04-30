const originalFetch = globalThis.fetch;

export function installMockFetch({
  responseText = "",
  contentType = "text/javascript",
  triggerNetworkError = false,
  responseCode = 200,
} = {}) {
  const mockFetchData = {
    calls:
      /** @type {{url: RequestInfo, init: RequestInit | undefined}[]} */ ([]),
  };
  /**
   * @param {RequestInfo} url
   * @param {RequestInit} [init]
   */
  const mockFetch = async (url, init) => {
    await new Promise((r) => r(null));
    mockFetchData.calls.push({ url, init });
    if (triggerNetworkError) {
      throw new TypeError("NetworkError when attempting to fetch resource.");
    }
    return new Response(responseText, {
      status: responseCode,
      headers: {
        "content-type": contentType,
      },
    });
  };
  globalThis.fetch = /** @type {typeof fetch} */ (mockFetch);
  return mockFetchData;
}

export function uninstallMockFetch() {
  globalThis.fetch = originalFetch;
}
