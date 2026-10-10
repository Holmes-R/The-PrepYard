export function sameOriginMutation(request) {
  try {
    const origin = request.headers.get("origin");
    const target = new URL(request.url);
    const host = request.headers.get("host") || target.host;
    const forwardedProtocol = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      .trim();
    const protocol =
      forwardedProtocol === "https"
        ? "https:"
        : forwardedProtocol === "http"
          ? "http:"
          : target.protocol;
    // Next may construct an internal route URL with a different hostname.
    // Compare the browser's Origin to the actual incoming Host, not that URL.
    const expected = new URL(protocol + "//" + host).origin;
    return typeof origin === "string" && origin === expected;
  } catch {
    return false;
  }
}
