// Match Auth.js session cookies, including its numbered large-token chunks.
export function sessionCookieNames(cookies, secure) {
  const base = secure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  return cookies
    .map((cookie) => cookie.name)
    .filter(
      (name) =>
        name === base ||
        (name.startsWith(base + ".") &&
          /^\d+$/.test(name.slice(base.length + 1))),
    );
}
export function withoutSessionCookies(header, names) {
  const removed = new Set(names);
  return (header || "")
    .split(";")
    .filter((part) => {
      const separator = part.indexOf("=");
      return separator >= 0 && !removed.has(part.slice(0, separator).trim());
    })
    .map((part) => part.trim())
    .filter(Boolean)
    .join("; ");
}
