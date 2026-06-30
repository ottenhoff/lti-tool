import packageJson from '../../../../package.json' with { type: 'json' };

/**
 * Wrapper around fetch() that automatically adds User-Agent header for LTI service requests.
 *
 * Canvas enforces User-Agent headers on all API requests starting January 2026.
 * This wrapper ensures compliance while allowing user override if needed.
 *
 * @param url - Request URL (string or URL object)
 * @param init - Fetch options (headers, method, body, etc.)
 * @returns Promise resolving to Response
 *
 * @see https://community.canvaslms.com/t5/Releases-Production/Canvas-Release-Notes-2026-01-17/ta-p/616001
 *
 * @example
 * ```typescript
 * const response = await ltiServiceFetch('https://api.example.com/scores', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ score: 95 })
 * });
 * */
// oxlint-disable-next-line require-await
export async function ltiServiceFetch(
  url: string | URL,
  init?: RequestInit,
): Promise<Response> {
  // Create Headers object from init.headers (handles all header input types)
  const headers = new Headers(init?.headers);
  // Add User-Agent only if not already present (allows override)
  if (!headers.has('User-Agent')) {
    headers.set(
      'User-Agent',
      `@longsightgroup/lti-tool/${packageJson.version} (https://github.com/LongsightGroup/lti-tool)`,
    );
  }
  // Call fetch with merged headers
  return fetch(url, {
    ...init,
    headers,
  });
}
