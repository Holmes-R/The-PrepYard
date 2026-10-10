export function normalizePrepYardOrigin(value) {
  try {
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      !(
        url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname))
      )
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error(
      "Enter your PrepYard site address, such as http://localhost:3000 or https://your-site.com.",
    );
  }
}

// This self-contained function runs inside the LeetCode tab, not on PrepYard.
// The browser uses its existing session; no cookies are inspected or returned.
export async function readSolvedInLeetCodeTab() {
  try {
    if (location.origin !== "https://leetcode.com")
      throw new Error("Open a signed-in LeetCode tab first.");
    const response = await fetch("https://leetcode.com/api/problems/all/", {
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new Error(
        "LeetCode did not return your solved list. Open LeetCode and try again.",
      );
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(
        "LeetCode returned an unexpected response. No history was imported.",
      );
    }
    if (
      typeof body.user_name !== "string" ||
      !/^[A-Za-z0-9_-]{1,40}$/.test(body.user_name)
    )
      throw new Error(
        "Sign in to LeetCode in this browser before importing your history.",
      );
    if (
      !Number.isInteger(body.num_solved) ||
      body.num_solved < 0 ||
      body.num_solved > 20_000 ||
      !Array.isArray(body.stat_status_pairs) ||
      body.stat_status_pairs.length > 30_000
    )
      throw new Error(
        "LeetCode's solved-list format changed. No history was imported.",
      );
    const slugs = [];
    for (const question of body.stat_status_pairs) {
      if (question?.status !== "ac") continue;
      const slug = question.stat?.question__title_slug;
      if (
        typeof slug !== "string" ||
        slug.length > 200 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
      )
        throw new Error(
          "LeetCode returned an invalid solved question. No history was imported.",
        );
      slugs.push(slug);
    }
    const unique = [...new Set(slugs)];
    if (unique.length !== body.num_solved)
      throw new Error(
        "LeetCode returned an incomplete solved list. Nothing was imported; try again from your signed-in LeetCode tab.",
      );
    return { username: body.user_name, total: unique.length, slugs: unique };
  } catch (error) {
    return {
      syncError:
        error instanceof Error
          ? error.message
          : "Could not read this tab. Try again.",
    };
  }
}

// Runs only in the exact PrepYard tab selected by the user. Requests use that
// tab's normal session and same-origin CSRF checks, with no external endpoint.
export async function inPrepYardTab(origin, action, payload) {
  try {
    if (location.origin !== origin)
      throw new Error("Your PrepYard tab changed. Reconnect the extension.");
    const endpoint = "/api/integrations/leetcode";
    const response = await fetch(
      action === "history" ? endpoint + "/history" : endpoint,
      {
        method: action === "profile" ? "GET" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers:
          action === "profile" ? {} : { "Content-Type": "application/json" },
        body: action === "profile" ? undefined : JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (response.status === 401)
      throw new Error("Log in to PrepYard, then reconnect the extension.");
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error("This tab is not a compatible PrepYard application.");
    }
    if (!response.ok || (action !== "profile" && !body.ok))
      throw new Error(body.error || "PrepYard could not import the history.");
    if (action === "history" || (action === "recent" && body.changed))
      window.dispatchEvent(new Event("prepyard:history-imported"));
    return body;
  } catch (error) {
    return {
      syncError:
        error instanceof Error
          ? error.message
          : "Could not read this tab. Try again.",
    };
  }
}
