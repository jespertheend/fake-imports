/**
 * Wrapper for `fetch()` to provide a better error message when the fetch fails.
 * @param {Object} options
 * @param {Parameters<typeof fetch>} options.fetchArgs
 * @param {string} options.errorMessagePrefix
 */
export async function fetchWithErrorHandling({
  errorMessagePrefix,
  fetchArgs,
}) {
  let response = null;
  try {
    response = await fetch(...fetchArgs);
  } catch {
    throw new TypeError(
      `${errorMessagePrefix} A network error occurred while fetching the module.`,
    );
  }
  if (!response.ok) {
    throw new TypeError(
      `${errorMessagePrefix} The resource did not respond with an ok status code (${response.status}).`,
    );
  }
  return response;
}
