"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DyndnsTokenInfo, CreateDyndnsTokenResponse } from "@/types/api";
import { DyndnsTokenModal } from "./dyndns-token-modal";

interface Props {
  tunnelId: string;
}

export function DyndnsPanel({ tunnelId }: Props) {
  const [info, setInfo] = useState<DyndnsTokenInfo | null | "loading">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plaintext, setPlaintext] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/tunnels/${tunnelId}/dyndns`);
        if (!r.ok) throw new Error(`load failed: ${r.status}`);
        const d = (await r.json()) as DyndnsTokenInfo | null;
        if (!cancelled) setInfo(d);
      } catch (e) {
        if (!cancelled) {
          setInfo(null);
          setError(e instanceof Error ? e.message : "Failed to load DDNS info");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [tunnelId]);

  async function refresh() {
    const r = await fetch(`/api/tunnels/${tunnelId}/dyndns`);
    if (r.ok) setInfo((await r.json()) as DyndnsTokenInfo | null);
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/tunnels/${tunnelId}/dyndns`, { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `create failed: ${r.status}`);
      }
      const d = (await r.json()) as CreateDyndnsTokenResponse;
      setPlaintext(d.token);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create token");
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/tunnels/${tunnelId}/dyndns/rotate`, { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `rotate failed: ${r.status}`);
      }
      const d = (await r.json()) as CreateDyndnsTokenResponse;
      setPlaintext(d.token);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rotate token");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!confirm("Revoke DDNS token? Updates from your router or script will stop working.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/tunnels/${tunnelId}/dyndns`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `revoke failed: ${r.status}`);
      }
      setInfo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke token");
    } finally {
      setBusy(false);
    }
  }

  if (info === "loading") {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Dynamic DNS</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Loading…</p></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Dynamic DNS</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Lets a router with a dynamic IP (Fritz!Box, MikroTik, OpenWrt, ddclient) update this tunnel's client IP automatically.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {info === null ? (
            <Button disabled={busy} onClick={create}>
              {busy ? "…" : "Generate DDNS token"}
            </Button>
          ) : (
            <div className="space-y-2 text-sm">
              <div>Token: <code className="font-mono">ddns_{info.token_prefix}…</code></div>
              <div>Created: {new Date(info.created_at).toLocaleString()}</div>
              <div>
                Last update:{" "}
                {info.last_update_at
                  ? `${info.last_update_ip ?? "—"} (${new Date(info.last_update_at).toLocaleString()})`
                  : "No updates yet"}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" disabled={busy} onClick={rotate}>Rotate token</Button>
                <Button variant="destructive" disabled={busy} onClick={revoke}>Revoke token</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DyndnsTokenModal
        tunnelId={tunnelId}
        token={plaintext}
        onClose={() => setPlaintext(null)}
      />
    </>
  );
}
