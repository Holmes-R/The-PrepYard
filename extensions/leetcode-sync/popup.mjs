import { normalizePrepYardOrigin } from "./browser-api.mjs";
const origin = document.querySelector("#origin"),
  status = document.querySelector("#status");
async function render() {
  const { connection, lastResult } = await chrome.storage.local.get([
    "connection",
    "lastResult",
  ]);
  document.querySelector("#connection").hidden = !connection;
  if (connection) {
    origin.value = connection.origin;
    document.querySelector("#profile").textContent =
      "Linked to " + connection.username;
  }
  if (lastResult)
    show(
      lastResult.message +
        " · " +
        new Date(lastResult.checkedAt).toLocaleTimeString(),
      lastResult.error,
    );
}
function show(message, error = false) {
  status.textContent = message;
  status.classList.toggle("error", error);
  status.setAttribute("role", error ? "alert" : "status");
}
async function act(type, originValue) {
  document.querySelectorAll("button,input").forEach((el) => {
    el.disabled = true;
  });
  show("Checking your solved questions…");
  try {
    const result = await chrome.runtime.sendMessage({
      type,
      origin: originValue,
    });
    await render();
    show(result.message, !result.ok);
  } catch (error) {
    show(error.message || "Could not sync.", true);
  } finally {
    document.querySelectorAll("button,input").forEach((el) => {
      el.disabled = false;
    });
  }
}
document
  .querySelector("#connect-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const site = normalizePrepYardOrigin(origin.value.trim());
      if (!(await chrome.permissions.request({ origins: [site + "/*"] }))) {
        show("Site access was not granted.", true);
        return;
      }
      await act("connect", site);
    } catch (error) {
      show(error.message, true);
    }
  });
document
  .querySelector("#sync")
  .addEventListener("click", () => void act("sync"));
document
  .querySelector("#disconnect")
  .addEventListener("click", () => void act("disconnect"));
void render();
