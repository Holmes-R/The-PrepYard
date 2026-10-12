"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Link2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientResource } from "@/lib/client/use-client-resource";
import { ResourceState } from "@/components/feedback/resource-state";
import { useClientSession } from "@/components/auth/client-session";
import { announceSyncedProgress } from "@/features/leetcode/client";
import { LeetCodeAccountPanel } from "./leetcode-sync-settings";
import {
  GFG_SETTINGS_URL,
  postGfg,
  type AccountResource,
  type ClientAccountSettings,
} from "@/features/accounts/client";

export function AccountSyncSettings() {
  return (
    <section className="prep-sync-page">
      <Link href="/dashboard" className="prep-sync-back">
        <ArrowLeft size={16} aria-hidden="true" /> Back to dashboard
      </Link>
      <header className="launch-page-heading">
        <h1>Sync accounts</h1>
        <p>
          Connect your practice accounts to keep completion up to date across
          company and pattern pages.
        </p>
      </header>
      <div className="prep-sync-accounts">
        <LeetCodeAccountPanel />
        <GfgAccountPanel />
      </div>
      <details className="prep-sync-help">
        <summary>
          <span>How sync works</span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <ol>
          <li>Connect each public username separately.</li>
          <li>Solve a question on a connected platform.</li>
          <li>
            Return to PrepYard. Matching questions update across company and
            pattern pages on the next check.
          </li>
        </ol>
        <p>
          Checks run every two minutes while PrepYard is visible and online.
          LeetCode checks your latest 20 public Accepted submissions and imports
          only those accepted after connecting.
        </p>
        <p>
          GeeksforGeeks records your existing solved list when you connect,
          leaving those older solves unchanged. Later checks mark newly visible
          solved questions that match PrepYard, including its free GeeksforGeeks
          alternatives. Re-solving a question already in that list does not
          trigger another update.
        </p>
        <p>
          Public profile delays may postpone updates. Your notes and revision
          ratings stay unchanged. No platform password is needed. Pause or
          disconnect each account independently.
        </p>
      </details>
      <details className="prep-sync-help prep-sync-manual">
        <summary>
          <span>Other platforms · manual tracking</span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <p>
          NeetCode, HackerRank and CodeChef questions can still be practised and
          marked complete in PrepYard. Automatic username syncing is unavailable
          for these platforms in this release. Use the question checkbox after
          solving them.
        </p>
      </details>
    </section>
  );
}
function GfgAccountPanel() {
  const resource = useClientResource<AccountResource>(GFG_SETTINGS_URL, {
    changes: false,
  });
  return resource.data ? (
    <GfgPanel
      key={resource.data.settings?.binding_version ?? "disconnected"}
      settings={resource.data.settings}
      reload={resource.retry}
    />
  ) : (
    <ResourceState title="GeeksforGeeks connection" {...resource} />
  );
}
function GfgPanel({
  settings,
  reload,
}: {
  settings: ClientAccountSettings | null;
  reload: () => void;
}) {
  const { user } = useClientSession();
  const [username, setUsername] = useState(settings?.username ?? "");
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function act(action: string) {
    if (pending) return;
    setPending(action);
    setMessage("");
    setError("");
    try {
      const result = await postGfg(
        action,
        action === "connect" ? username : undefined,
      );
      if (result.changed && user?.id) announceSyncedProgress(user.id);
      reload();
      setMessage(
        result.message ||
          (action === "disconnect"
            ? "Disconnected. Your progress and notes are kept."
            : action === "pause"
              ? "Automatic syncing paused."
              : action === "resume"
                ? "Automatic syncing resumed."
                : "Connected. Existing solves are unchanged; newly visible solves will sync automatically."),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not connect. Please try again.",
      );
      reload();
    } finally {
      setPending("");
    }
  }
  return (
    <div className="prep-sync-card">
      <div className="prep-sync-card-title">
        <Link2 size={20} aria-hidden="true" />
        <h2>GeeksforGeeks</h2>
      </div>
      <p>
        Connect your public practice profile. Existing solves form your starting
        point; new matching solves update PrepYard automatically.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void act("connect");
        }}
      >
        <label htmlFor="gfg-username">GeeksforGeeks username</label>
        <div className="prep-sync-input-row">
          <input
            id="gfg-username"
            name="username"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={60}
            pattern={"[A-Za-z0-9_\\-]{1,60}"}
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Your public username"
            disabled={!!pending}
            aria-describedby="gfg-username-help"
          />
          <Button
            type="submit"
            loading={pending === "connect"}
            disabled={!!pending}
          >
            {settings ? "Update username" : "Enable automatic sync"}
          </Button>
        </div>
        <p id="gfg-username-help" className="prep-sync-meta">
          Use your profile username and keep your GeeksforGeeks practice profile
          public.
        </p>
      </form>
      {settings && (
        <>
          <dl className="prep-sync-details">
            <div>
              <dt>Profile</dt>
              <dd>
                <a
                  href={
                    "https://www.geeksforgeeks.org/profile/" +
                    encodeURIComponent(settings.username) +
                    "?tab=practice"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {settings.username}
                </a>
              </dd>
            </div>
            <div>
              <dt>Automatic sync</dt>
              <dd className={settings.enabled ? "prep-sync-on" : ""}>
                {settings.enabled
                  ? "On · every two minutes while open"
                  : "Paused"}
              </dd>
            </div>
            <div>
              <dt>Tracking newly visible solves since</dt>
              <dd>{new Date(settings.sync_started_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Last successful check</dt>
              <dd>
                {settings.last_synced_at
                  ? new Date(settings.last_synced_at).toLocaleString()
                  : "Not checked yet"}
              </dd>
            </div>
            <div>
              <dt>Matching new questions in last check</dt>
              <dd>{settings.last_matched_count}</dd>
            </div>
          </dl>
          <div className="prep-sync-actions">
            <Button
              onClick={() => void act("sync")}
              disabled={!!pending || !settings.enabled}
              loading={pending === "sync"}
            >
              <RefreshCw size={16} aria-hidden="true" /> Sync now
            </Button>
            <Button
              variant="secondary"
              disabled={!!pending}
              loading={pending === "pause" || pending === "resume"}
              onClick={() => void act(settings.enabled ? "pause" : "resume")}
            >
              {settings.enabled ? "Pause sync" : "Resume sync"}
            </Button>
            <Button
              variant="ghost"
              disabled={!!pending}
              loading={pending === "disconnect"}
              onClick={() => void act("disconnect")}
            >
              Disconnect
            </Button>
          </div>
          {settings.last_error && !error && (
            <p role="alert" className="prep-sync-error">
              {settings.last_error}
            </p>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="prep-sync-error">
          {error}
        </p>
      )}
    </div>
  );
}
