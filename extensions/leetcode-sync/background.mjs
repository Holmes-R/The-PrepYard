import {
  normalizePrepYardOrigin,
  readSolvedInLeetCodeTab,
  inPrepYardTab,
} from "./browser-api.mjs";

const ALARM = "prepyard-history-sync";
let running = false;
async function runInTab(tabId, func, args = []) {
  let timeout;
  let results;
  try {
    results = await Promise.race([
      chrome.scripting.executeScript({
        target: { tabId },
        injectImmediately: true,
        func,
        args,
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                "This tab took too long to respond. Bring it to the foreground and try again.",
              ),
            ),
          45_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }

  if (results[0]?.error)
    throw new Error(
      results[0].error.message || "Could not read the browser tab.",
    );
  if (!results[0] || results[0].result === undefined)
    throw new Error("Could not read the browser tab. Reload it and try again.");
  if (results[0].result?.syncError)
    throw new Error(results[0].result.syncError);
  return results[0].result;
}
async function prepTab(origin) {
  const tabs = await chrome.tabs.query({ url: origin + "/*" });
  const tab = tabs.find((tab) => {
    try {
      return new URL(tab.url).origin === origin;
    } catch {
      return false;
    }
  });
  if (!tab?.id)
    throw new Error("Open your PrepYard site and log in before syncing.");
  return tab;
}
async function lcTab() {
  const tabs = await chrome.tabs.query({ url: "https://leetcode.com/*" });
  const tab = tabs.find((tab) => tab.active) || tabs[0];
  if (!tab?.id)
    throw new Error("Open LeetCode and sign in in the same browser.");
  return tab;
}
async function connect(origin) {
  origin = normalizePrepYardOrigin(origin);
  if (!(await chrome.permissions.contains({ origins: [origin + "/*"] })))
    throw new Error("Allow access to your PrepYard site to connect.");
  const tab = await prepTab(origin);
  const { settings } = await runInTab(tab.id, inPrepYardTab, [
    origin,
    "profile",
  ]);
  if (!settings?.binding_version)
    throw new Error(
      "Connect your LeetCode username on PrepYard's LeetCode sync page first.",
    );
  const { connection: previous } = await chrome.storage.local.get("connection");
  if (previous && previous.origin !== origin)
    await chrome.permissions
      .remove({ origins: [previous.origin + "/*"] })
      .catch(() => {});
  await chrome.storage.local.set({
    connection: {
      origin,
      username: settings.username,
      bindingVersion: settings.binding_version,
    },
  });
  await chrome.alarms.create(ALARM, { periodInMinutes: 2 });
  return sync();
}
async function sync() {
  if (running) return { ok: true, message: "A sync is already running." };
  running = true;
  try {
    const { connection } = await chrome.storage.local.get("connection");
    if (!connection)
      throw new Error("Connect the extension to PrepYard first.");
    const tab = await prepTab(connection.origin);
    const { settings } = await runInTab(tab.id, inPrepYardTab, [
      connection.origin,
      "profile",
    ]);
    if (
      !settings ||
      settings.binding_version !== connection.bindingVersion ||
      settings.username.toLowerCase() !== connection.username.toLowerCase()
    )
      throw new Error(
        "Your account or username changed. Reconnect the extension before syncing.",
      );
    if (!settings.enabled)
      return { ok: true, message: "Syncing is paused in PrepYard." };
    const solved = await runInTab((await lcTab()).id, readSolvedInLeetCodeTab);
    if (solved.username.toLowerCase() !== connection.username.toLowerCase())
      throw new Error(
        "The signed-in LeetCode account differs from your linked username. Switch accounts or update your PrepYard username.",
      );
    const result = await runInTab(tab.id, inPrepYardTab, [
      connection.origin,
      "history",
      { schema: 1, ...solved, bindingVersion: connection.bindingVersion },
    ]);
    // The full import is already committed. Its confirmation must not wait
    // for the optional public feed; failures there appear in PrepYard settings.
    void runInTab(tab.id, inPrepYardTab, [
      connection.origin,
      "recent",
      { action: "sync" },
    ]).catch(() => {});
    await chrome.storage.local.set({
      lastResult: {
        message: result.message,
        checkedAt: new Date().toISOString(),
        error: false,
      },
    });
    void chrome.action.setBadgeText({ text: "" }).catch(() => {});
    return { ok: true, message: result.message };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not sync. Open both sites and try again.";
    await chrome.storage.local.set({
      lastResult: { message, checkedAt: new Date().toISOString(), error: true },
    });
    void chrome.action.setBadgeText({ text: "!" }).catch(() => {});
    void chrome.action
      .setBadgeBackgroundColor({ color: "#b45309" })
      .catch(() => {});
    return { ok: false, message };
  } finally {
    running = false;
  }
}
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void sync();
});
async function restoreAlarm() {
  const { connection } = await chrome.storage.local.get("connection");
  if (connection) await chrome.alarms.create(ALARM, { periodInMinutes: 2 });
}
chrome.runtime.onInstalled.addListener(() => void restoreAlarm());
chrome.runtime.onStartup.addListener(async () => {
  const { connection } = await chrome.storage.local.get("connection");
  if (connection) await chrome.alarms.create(ALARM, { periodInMinutes: 2 });
});
chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  const action = async () => {
    if (message.type === "connect") return connect(message.origin);
    if (message.type === "sync") return sync();
    if (message.type === "disconnect") {
      const { connection } = await chrome.storage.local.get("connection");
      await chrome.storage.local.remove(["connection", "lastResult"]);
      if (connection)
        await chrome.permissions
          .remove({
            origins: [connection.origin + "/*"],
          })
          .catch(() => {});
      await chrome.alarms.clear(ALARM);
      void chrome.action.setBadgeText({ text: "" }).catch(() => {});
      return {
        ok: true,
        message: "Extension disconnected. PrepYard progress is kept.",
      };
    }
    return { ok: false, message: "Unknown action." };
  };
  action()
    .then(reply)
    .catch((error) =>
      reply({ ok: false, message: error.message || "Could not connect." }),
    );
  return true;
});
