export function authConfigured(env = process.env) {
  return Boolean(env.AUTH_SECRET && env.DATABASE_URL);
}
export function safeDestination(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/dashboard";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u0020]/.test(decoded))
      return "/dashboard";
    const parsed = new URL(value, "https://prepyard.invalid");
    if (
      parsed.origin !== "https://prepyard.invalid" ||
      /^\/(login|signup|forgot-password|reset-password|verify-email|auth|api\/auth)(\/|$)/.test(
        decodeURIComponent(parsed.pathname),
      )
    )
      return "/dashboard";
    return parsed.pathname + parsed.search;
  } catch {
    return "/dashboard";
  }
}
export function validStudentId(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
