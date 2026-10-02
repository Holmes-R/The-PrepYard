// Auth.js can return redirects with immutable headers. Copy the response while
// preserving its body, status, redirect location, and separate Set-Cookie values.
export function privateAuthResponse(response) {
  const result = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}
