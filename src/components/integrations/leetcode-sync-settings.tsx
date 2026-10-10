"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientResource } from "@/lib/client/use-client-resource";
import { ResourceState } from "@/components/feedback/resource-state";
import { useClientSession } from "@/components/auth/client-session";
import {
  SYNC_SETTINGS_URL,
  announceSyncedProgress,
  postLeetCode,
  type ClientSyncSettings,
  type SyncResource,
} from "@/features/leetcode/client";

export function LeetCodeSyncSettings() {
  const resource = useClientResource<SyncResource>(SYNC_SETTINGS_URL, {
    changes: false,
  });
  return (
    <section className="prep-sync-page">
      <Link href="/dashboard" className="prep-sync-back">
        <ArrowLeft size={16} aria-hidden="true" /> Back to dashboard
      </Link>
      <header className="launch-page-heading">
        <h1>LeetCode sync</h1>
        <p>
          Keep your PrepYard checkboxes in step with your recent Accepted
          submissions.
        </p>
      </header>
      {resource.data ? (
        <SyncPanel
          key={resource.data.settings?.username ?? "disconnected"}
          settings={resource.data.settings}
          reload={resource.retry}
        />
      ) : (
        <ResourceState title="Your connection" {...resource} />
      )}
      <details className="prep-sync-help">
        <summary>What does syncing include?</summary>
        <p>
          Checks the most recent 20 publicly visible Accepted submissions every
          two minutes while a signed-in PrepYard tab is visible. Sync now uses
          the same two-minute limit.
        </p>
        <p>
          Only questions already in PrepYard are matched. Older or private
          submissions may be unavailable. This is not a full history import or
          instant live detection.
        </p>
        <p>
          Only new submission records mark completion. A later manual uncheck
          stays unchecked until you submit another accepted solution for that
          question. Your notes, bookmarks, and revision confidence remain
          unchanged.
        </p>
        <p>
          No LeetCode password, session cookie, or solution code is collected. A
          username selects a public profile; it does not verify ownership of
          that account.
        </p>
      </details>
    </section>
  );
}

function SyncPanel({
  settings,
  reload,
}: {
  settings: ClientSyncSettings | null;
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
      const result = await postLeetCode(
        action,
        action === "connect" ? username : undefined,
      );
      if (result.changed && user?.id) announceSyncedProgress(user.id);
      reload();
      setMessage(
        result.message ||
          (action === "pause"
            ? "Automatic syncing paused."
            : action === "resume"
              ? "Automatic syncing resumed."
              : action === "disconnect"
                ? "Disconnected. Your saved progress and notes are kept."
                : "Profile connected. Checking your recent submissions."),
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
        <h2>Connect your public profile</h2>
      </div>
      <p>
        Enter your LeetCode username to automatically mark matching questions as
        completed.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void act("connect");
        }}
      >
        <label htmlFor="leetcode-username">LeetCode username</label>
        <div className="prep-sync-input-row">
          <input
            id="leetcode-username"
            name="username"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={40}
            pattern={"[A-Za-z0-9_\\-]{1,40}"}
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Your username"
            disabled={!!pending}
            aria-describedby="leetcode-username-help"
          />
          <Button
            type="submit"
            loading={pending === "connect"}
            disabled={!!pending}
          >
            {settings ? "Update username" : "Connect profile"}
          </Button>
        </div>
        <p id="leetcode-username-help" className="prep-sync-meta">
          Use the username from your LeetCode profile, rather than an email
          address.
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
                    "https://leetcode.com/u/" +
                    encodeURIComponent(settings.username) +
                    "/"
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
              <dt>Last successful sync</dt>
              <dd>
                {settings.last_synced_at
                  ? new Date(settings.last_synced_at).toLocaleString()
                  : "Not synced yet"}
              </dd>
            </div>
            <div>
              <dt>Matching questions in recent submissions</dt>
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
