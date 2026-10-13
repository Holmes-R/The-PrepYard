import nodemailer from "nodemailer";

function provider(env) {
  return env.AUTH_EMAIL_PROVIDER?.trim().toLowerCase() || "gmail";
}

function origin(env) {
  const value = env.AUTH_URL?.trim() || env.RENDER_EXTERNAL_URL?.trim();
  if (!value) throw new Error("Email delivery is not configured.");
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error("Use HTTPS for AUTH_URL.");
  return url.origin;
}

function validMailbox(value) {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(
      value,
    )
  );
}

async function requestJson(fetchImpl, url, request, stage) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...request,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(stage + " request failed.");
  }
  if (!response.ok)
    throw new Error(stage + " failed (HTTP " + response.status + ").");
  const result = await response.json().catch(() => null);
  if (!result || typeof result !== "object")
    throw new Error(stage + " returned an invalid response.");
  return result;
}

async function sendWithGmailApi(env, message, fetchImpl) {
  if (!validMailbox(message.to))
    throw new Error("A single valid recipient is required.");
  const credentials = new URLSearchParams({
    client_id: env.GMAIL_CLIENT_ID.trim(),
    client_secret: env.GMAIL_CLIENT_SECRET.trim(),
    refresh_token: env.GMAIL_REFRESH_TOKEN.trim(),
    grant_type: "refresh_token",
  });
  const authorization = await requestJson(
    fetchImpl,
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: credentials.toString(),
    },
    "Gmail authorization",
  );
  if (
    typeof authorization.access_token !== "string" ||
    !authorization.access_token ||
    typeof authorization.token_type !== "string" ||
    authorization.token_type.toLowerCase() !== "bearer"
  )
    throw new Error("Gmail authorization returned an invalid response.");
  const body = Buffer.from(message.text, "utf8")
    .toString("base64")
    .match(/.{1,76}/g)
    .join("\r\n");
  const mime = [
    "From: PrepYard <" + env.GMAIL_USER.trim() + ">",
    "To: <" + message.to + ">",
    "Subject: " + message.subject,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
  const result = await requestJson(
    fetchImpl,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + authorization.access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: Buffer.from(mime, "utf8").toString("base64url"),
      }),
    },
    "Gmail delivery",
  );
  if (typeof result.id !== "string" || !result.id)
    throw new Error("Gmail delivery returned an invalid response.");
}

export function emailConfigured(env = process.env) {
  try {
    origin(env);
  } catch {
    return false;
  }
  if (provider(env) === "gmail-api") {
    return Boolean(
      validMailbox(env.GMAIL_USER?.trim()) &&
      env.GMAIL_CLIENT_ID?.trim() &&
      env.GMAIL_CLIENT_SECRET?.trim() &&
      env.GMAIL_REFRESH_TOKEN?.trim(),
    );
  }
  if (provider(env) === "resend") {
    const from = env.AUTH_EMAIL_FROM?.trim();
    return Boolean(
      env.RESEND_API_KEY?.trim() &&
      from &&
      from.length <= 500 &&
      !/[\r\n]/.test(from),
    );
  }
  return (
    provider(env) === "gmail" &&
    Boolean(
      env.GMAIL_USER?.trim() && env.GMAIL_APP_PASSWORD?.replace(/\s/g, ""),
    )
  );
}

export async function sendAuthEmail(email, token, purpose, options = {}) {
  const {
    env = process.env,
    fetchImpl = globalThis.fetch,
    createTransport = nodemailer.createTransport,
  } = options;
  if (!emailConfigured(env))
    throw new Error("Email delivery is not configured.");
  const link = new URL(
    purpose === "verify" ? "/verify-email" : "/reset-password",
    origin(env),
  );
  // Fragments keep verification/reset tokens out of request and referrer logs.
  link.hash = new URLSearchParams({ token }).toString();
  const message = {
    to: email,
    subject:
      purpose === "verify"
        ? "Verify your PrepYard email"
        : "Reset your PrepYard password",
    text:
      (purpose === "verify"
        ? "Confirm your email to create your PrepYard account. This link expires in one hour."
        : "Choose a new PrepYard password. This link expires in 30 minutes.") +
      "\n\n" +
      link.href +
      "\n\nIf you did not request this, ignore this email.",
  };
  if (provider(env) === "gmail-api") {
    await sendWithGmailApi(env, message, fetchImpl);
    return;
  }
  if (provider(env) === "resend") {
    // A fixed HTTPS API works on hosts that block outbound SMTP, including Render Free.
    let response;
    try {
      response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: "Bearer " + env.RESEND_API_KEY.trim(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...message,
          from: env.AUTH_EMAIL_FROM.trim(),
          to: [email],
        }),
      });
    } catch {
      throw new Error("Email delivery request failed.");
    }
    // Never include provider response bodies, recipient addresses, keys or tokens in errors.
    if (!response.ok)
      throw new Error("Email delivery failed (HTTP " + response.status + ").");
    const result = await response.json().catch(() => null);
    if (!result || typeof result.id !== "string" || !result.id)
      throw new Error("Email delivery returned an invalid response.");
    return;
  }
  const user = env.GMAIL_USER.trim();
  const transporter = createTransport({
    service: "gmail",
    auth: { user, pass: env.GMAIL_APP_PASSWORD.replace(/\s/g, "") },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  await transporter.sendMail({ ...message, from: `PrepYard <${user}>` });
}
