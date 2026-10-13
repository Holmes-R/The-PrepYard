import test from "node:test";
import assert from "node:assert/strict";
import {
  emailConfigured,
  sendAuthEmail,
} from "../../src/lib/auth/email-delivery.mjs";
const resend = {
  AUTH_URL: "https://prepyard.example",
  AUTH_EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "test-api-key",
  AUTH_EMAIL_FROM: "PrepYard <noreply@example.com>",
};
const gmail = {
  AUTH_URL: "http://localhost:3000",
  GMAIL_USER: "test@example.com",
  GMAIL_APP_PASSWORD: "test app password",
};
test("mail configuration requires the selected provider and a trusted HTTPS origin", () => {
  assert.equal(emailConfigured(resend), true);
  assert.equal(emailConfigured(gmail), true);
  assert.equal(
    emailConfigured({ ...gmail, RESEND_API_KEY: "unused-legacy-key" }),
    true,
  );
  assert.equal(
    emailConfigured({
      ...resend,
      AUTH_URL: "",
      RENDER_EXTERNAL_URL: "https://assigned.onrender.com",
    }),
    true,
  );
  for (const patch of [
    { RESEND_API_KEY: "" },
    { AUTH_EMAIL_FROM: "" },
    { AUTH_EMAIL_FROM: "sender\nInjected: yes" },
    { AUTH_URL: "http://public.example" },
    { AUTH_EMAIL_PROVIDER: "unknown" },
    { AUTH_URL: "https://user:pass@example.com" },
  ])
    assert.equal(emailConfigured({ ...resend, ...patch }), false);
  assert.equal(
    emailConfigured({ ...gmail, AUTH_EMAIL_PROVIDER: "resend" }),
    false,
  );
});
test("Resend sends both auth flows using HTTPS and keeps tokens in fragments", async () => {
  for (const purpose of ["verify", "reset"]) {
    let captured;
    await sendAuthEmail("student@example.com", "opaque+token", purpose, {
      env: resend,
      createTransport: () => {
        throw Error("SMTP must not run");
      },
      fetchImpl: async (url, request) => {
        captured = { url, request };
        return new Response(JSON.stringify({ id: "email-id" }), {
          status: 200,
        });
      },
    });
    assert.equal(captured.url, "https://api.resend.com/emails");
    assert.equal(captured.request.method, "POST");
    assert.equal(captured.request.redirect, "error");
    assert.equal(captured.request.headers.Authorization, "Bearer test-api-key");
    assert.ok(captured.request.signal instanceof AbortSignal);
    const payload = JSON.parse(captured.request.body);
    assert.deepEqual(payload.to, ["student@example.com"]);
    assert.equal(payload.from, resend.AUTH_EMAIL_FROM);
    const link = new URL(payload.text.match(/https:\/\/\S+/)[0]);
    assert.equal(
      link.pathname,
      purpose === "verify" ? "/verify-email" : "/reset-password",
    );
    assert.equal(link.search, "");
    assert.equal(
      new URLSearchParams(link.hash.slice(1)).get("token"),
      "opaque+token",
    );
    assert.match(payload.subject, purpose === "verify" ? /Verify/ : /Reset/);
  }
});
test("provider failures fail closed without reflecting sensitive response content", async () => {
  for (const fetchImpl of [
    async () =>
      new Response("private email token test-api-key", { status: 403 }),
    async () => {
      throw Error("private email token test-api-key");
    },
    async () => new Response("not JSON", { status: 200 }),
    async () => new Response(JSON.stringify({ id: null }), { status: 200 }),
  ]) {
    await assert.rejects(
      sendAuthEmail("student@example.com", "token", "verify", {
        env: resend,
        fetchImpl,
      }),
      (error) => {
        assert.doesNotMatch(
          error.message,
          /student@example|test-api-key|private email|token/,
        );
        return true;
      },
    );
  }
});
test("missing Resend configuration never falls back to SMTP", async () => {
  await assert.rejects(
    sendAuthEmail("student@example.com", "token", "verify", {
      env: { ...gmail, AUTH_EMAIL_PROVIDER: "resend" },
      fetchImpl: () => {
        throw Error("Must not call API");
      },
      createTransport: () => {
        throw Error("Must not call SMTP");
      },
    }),
    /not configured/,
  );
});
test("existing local Gmail setup still works with bounded SMTP timeouts", async () => {
  let config, message;
  await sendAuthEmail("student@example.com", "token", "reset", {
    env: gmail,
    createTransport: (options) => {
      config = options;
      return {
        sendMail: async (value) => {
          message = value;
        },
      };
    },
    fetchImpl: () => {
      throw Error("Gmail must not call Resend");
    },
  });
  assert.equal(config.auth.pass, "testapppassword");
  assert.equal(config.service, "gmail");
  assert.equal(config.socketTimeout, 15000);
  assert.equal(message.to, "student@example.com");
  assert.match(
    message.text,
    /http:\/\/localhost:3000\/reset-password#token=token/,
  );
});

const gmailApi = {
  AUTH_EMAIL_PROVIDER: "gmail-api",
  AUTH_URL: "https://assigned.onrender.com",
  GMAIL_USER: "sender@gmail.com",
  GMAIL_CLIENT_ID: "test-client",
  GMAIL_CLIENT_SECRET: "test-secret",
  GMAIL_REFRESH_TOKEN: "test-refresh",
};
test("Gmail API needs complete owner credentials and a single safe sender address", () => {
  assert.equal(emailConfigured(gmailApi), true);
  for (const key of [
    "GMAIL_USER",
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
  ])
    assert.equal(emailConfigured({ ...gmailApi, [key]: "" }), false);
  assert.equal(
    emailConfigured({
      ...gmailApi,
      GMAIL_USER: "sender@gmail.com\r\nBcc: other@gmail.com",
    }),
    false,
  );
  assert.equal(
    emailConfigured({ ...gmailApi, GMAIL_USER: "a@gmail.com,b@gmail.com" }),
    false,
  );
});
test("Gmail API refreshes through Google and sends a single RFC MIME message over HTTPS", async () => {
  for (const purpose of ["verify", "reset"]) {
    const calls = [];
    await sendAuthEmail("student+alias@example.com", "opaque+token", purpose, {
      env: gmailApi,
      createTransport: () => {
        throw Error("SMTP must not run");
      },
      fetchImpl: async (url, request) => {
        calls.push({ url, request });
        return new Response(
          JSON.stringify(
            calls.length === 1
              ? { access_token: "access-value", token_type: "Bearer" }
              : { id: "gmail-message-id" },
          ),
          { status: 200 },
        );
      },
    });
    assert.deepEqual(
      calls.map((c) => c.url),
      [
        "https://oauth2.googleapis.com/token",
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      ],
    );
    const credentials = new URLSearchParams(calls[0].request.body);
    assert.equal(credentials.get("client_id"), "test-client");
    assert.equal(credentials.get("client_secret"), "test-secret");
    assert.equal(credentials.get("refresh_token"), "test-refresh");
    assert.equal(credentials.get("grant_type"), "refresh_token");
    for (const { request } of calls) {
      assert.equal(request.method, "POST");
      assert.equal(request.redirect, "error");
      assert.ok(request.signal instanceof AbortSignal);
    }
    const raw = JSON.parse(calls[1].request.body).raw;
    assert.match(raw, /^[A-Za-z0-9_-]+$/);
    const mime = Buffer.from(raw, "base64url").toString("utf8");
    assert.match(mime, /From: PrepYard <sender@gmail.com>\r\n/);
    assert.match(mime, /To: <student\+alias@example.com>\r\n/);
    assert.doesNotMatch(mime, /Bcc:/);
    const body = Buffer.from(mime.split("\r\n\r\n")[1], "base64").toString(
      "utf8",
    );
    const link = new URL(body.match(/https:\/\/\S+/)[0]);
    assert.equal(
      link.pathname,
      purpose === "verify" ? "/verify-email" : "/reset-password",
    );
    assert.equal(link.search, "");
    assert.equal(
      new URLSearchParams(link.hash.slice(1)).get("token"),
      "opaque+token",
    );
    assert.equal(calls[1].request.headers.Authorization, "Bearer access-value");
  }
});
test("Gmail API rejects recipient header injection and multiple recipients before making a request", async () => {
  for (const email of [
    "a@example.com\r\nBcc: b@example.com",
    "a@example.com,b@example.com",
    "User <a@example.com>",
  ]) {
    let calls = 0;
    await assert.rejects(
      sendAuthEmail(email, "token", "verify", {
        env: gmailApi,
        fetchImpl: async () => {
          calls++;
          throw Error("Must not request");
        },
      }),
      /single valid recipient/,
    );
    assert.equal(calls, 0);
  }
});
test("invalid Google authorization never sends an email or exposes the provider response", async () => {
  for (const result of [
    { error: "test-secret test-refresh token" },
    { access_token: "access-value" },
    { access_token: "access-value", token_type: "Basic" },
  ]) {
    let calls = 0;
    await assert.rejects(
      sendAuthEmail("student@example.com", "token", "verify", {
        env: gmailApi,
        fetchImpl: async () => {
          calls++;
          return new Response(JSON.stringify(result), { status: 200 });
        },
      }),
      (error) => {
        assert.doesNotMatch(
          error.message,
          /test-secret|test-refresh|student@example/,
        );
        return true;
      },
    );
    assert.equal(calls, 1);
  }
});
test("Google API failures remain sanitized and do not fall back to SMTP", async () => {
  for (const failAt of [1, 2]) {
    let calls = 0;
    await assert.rejects(
      sendAuthEmail("student@example.com", "token", "reset", {
        env: gmailApi,
        createTransport: () => {
          throw Error("Must not use SMTP");
        },
        fetchImpl: async () => {
          calls++;
          if (calls === failAt)
            return new Response(
              "test-secret test-refresh token student@example.com",
              { status: 401 },
            );
          return new Response(
            JSON.stringify({
              access_token: "access-value",
              token_type: "Bearer",
            }),
            { status: 200 },
          );
        },
      }),
      (error) => {
        assert.match(error.message, /HTTP 401/);
        assert.doesNotMatch(
          error.message,
          /test-secret|test-refresh|student@example/,
        );
        return true;
      },
    );
    assert.equal(calls, failAt);
  }
});
