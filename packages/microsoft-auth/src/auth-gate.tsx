import { CheckIcon, CopyIcon, ExternalLinkIcon, KeyRoundIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { errorMessage } from "@repo/ui/lib/utils";
import type { AuthStatus } from "./client";
import { getStatus, startLogin } from "./client";
import type { Resource } from "./config";
import { RESOURCES } from "./config";

/** Renders children once the user is signed in for every required resource (device code via the proxy). */
export function AuthGate({ resources, children }: { resources: Resource[]; children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = !!status && resources.every((r) => status.resources[r]);

  const refresh = useCallback(
    () =>
      getStatus()
        .then((next) => {
          setStatus(next);
          setError(null);
        })
        .catch((e) => setError(errorMessage(e))),
    [],
  );

  useEffect(() => {
    void refresh();
    if (ready) return;
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [ready, refresh]);

  if (ready) return <>{children}</>;

  return (
    <div className="grid h-dvh place-items-center bg-muted/40 p-6">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border bg-background p-8 shadow-[0_8px_30px_rgb(0_0_0/0.06)]">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <KeyRoundIcon className="size-6" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Sign in to Microsoft</h1>
          <p className="mt-1 text-sm text-muted-foreground">Once per machine — the session is then refreshed automatically.</p>
        </div>

        {error ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-destructive">{error}</p>
            <code className="rounded-lg bg-muted px-3 py-2 font-mono text-xs">bun run auth-proxy</code>
          </div>
        ) : !status ? (
          <Spinner className="mx-auto text-muted-foreground" />
        ) : (
          <ul className="flex flex-col gap-2">
            {resources.map((resource) => (
              <ResourceRow key={resource} resource={resource} status={status} onStarted={refresh} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResourceRow({ resource, status, onStarted }: { resource: Resource; status: AuthStatus; onStarted: () => void }) {
  const [copied, setCopied] = useState(false);
  const pending = status.pending?.resource === resource ? status.pending : null;
  const signedIn = status.resources[resource];

  return (
    <li className="rounded-xl border px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-medium">{RESOURCES[resource].label}</span>
        {signedIn ? (
          <CheckIcon className="size-4 text-green-600" />
        ) : (
          !pending && (
            <Button size="sm" onClick={() => void startLogin(resource).then(onStarted)}>
              Sign in
            </Button>
          )
        )}
      </div>
      {pending && !signedIn && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Enter this code on the Microsoft page:</p>
          <button
            className="flex items-center justify-center gap-2 rounded-lg bg-muted py-2 font-mono text-lg tracking-widest"
            onClick={() => {
              void navigator.clipboard.writeText(pending.userCode);
              setCopied(true);
            }}
          >
            {pending.userCode} {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
          </button>
          <a
            href={pending.verificationUri}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1 text-xs text-primary hover:underline"
          >
            Open {pending.verificationUri.replace(/^https?:\/\//, "")} <ExternalLinkIcon className="size-3" />
          </a>
          <p className="text-center text-[11px] text-muted-foreground">
            Expires at {new Date(pending.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
            <button className="underline-offset-2 hover:underline" onClick={() => void startLogin(resource).then(onStarted)}>
              new code
            </button>
          </p>
          {pending.error && <p className="text-xs text-destructive">{pending.error}</p>}
        </div>
      )}
    </li>
  );
}
