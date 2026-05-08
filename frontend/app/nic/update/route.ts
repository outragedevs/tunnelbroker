import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  isValidTunnelId,
  isValidIpv4,
  isPublicIpv4,
  parseBasicAuth,
  firstForwardedFor,
  verifyToken,
  plainText,
} from "@/utils/dyndns";
import {
  rateLimit,
  DDNS_TOKEN_WINDOW_MS,
  DDNS_TOKEN_MAX,
  DDNS_IP_WINDOW_MS,
  DDNS_IP_MAX,
} from "@/utils/rate-limit";
import { getTunnelbrokerApiKey, getTunnelbrokerApiUrl } from "@/utils/backend-api";

async function handleUpdate(req: NextRequest): Promise<Response> {
  const sourceIp = firstForwardedFor(req.headers.get("x-forwarded-for")) ?? "0.0.0.0";

  // Per-IP anti-bruteforce gate (independent of auth result)
  const ipLimit = rateLimit(`ip:${sourceIp}`, DDNS_IP_WINDOW_MS, DDNS_IP_MAX);
  if (!ipLimit.allowed) {
    return plainText("abuse", 200);
  }

  const basic = parseBasicAuth(req.headers.get("authorization"));
  if (!basic) return plainText("badauth", 401);

  const url = new URL(req.url);
  const hostname = url.searchParams.get("hostname") ?? "";
  const myipRaw = url.searchParams.get("myip") ?? "";

  // hostname format check first; on bad shape return notfqdn (per dyndns2)
  if (!isValidTunnelId(hostname)) return plainText("notfqdn", 200);

  // username must equal hostname (sanity)
  if (basic.username !== hostname) return plainText("nohost", 200);

  // Look up token row by tunnel_id (= username = hostname)
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("dyndns_tokens")
    .select("tunnel_id, user_id, token_hash, last_update_ip")
    .eq("tunnel_id", hostname)
    .maybeSingle();
  if (error) {
    console.error("dyndns: supabase error", { tunnel_id: hostname, error: error.message });
    return plainText("911", 200);
  }
  if (!row) return plainText("badauth", 401);

  const verified = await verifyToken(basic.password, row.token_hash);
  if (!verified) return plainText("badauth", 401);

  // Resolve effective IP
  let effective: string;
  if (myipRaw && myipRaw.toLowerCase() !== "auto") {
    if (!isValidIpv4(myipRaw)) {
      console.warn("dyndns: bad_myip", { tunnel_id: hostname, myip: myipRaw });
      return plainText("911", 200);
    }
    effective = myipRaw;
  } else {
    if (!isValidIpv4(sourceIp)) {
      console.warn("dyndns: no_source_ip", { tunnel_id: hostname, sourceIp });
      return plainText("911", 200);
    }
    effective = sourceIp;
  }
  if (!isPublicIpv4(effective)) {
    console.warn("dyndns: rejected_private_ip", { tunnel_id: hostname, effective });
    return plainText("911", 200);
  }

  const apiUrl = getTunnelbrokerApiUrl();
  if (!apiUrl) {
    console.error("dyndns: missing_tunnelbroker_api_url");
    return plainText("911", 200);
  }
  const apiKey = getTunnelbrokerApiKey();

  // Verify tunnel exists, type, and current IP via backend
  const detailUrl = `${apiUrl}/tunnels/${hostname}?user_id=${row.user_id}`;
  let detail: Response;
  try {
    detail = await fetch(detailUrl, { headers: { "X-API-Key": apiKey } });
  } catch (e) {
    console.error("dyndns: backend_lookup_threw", {
      tunnel_id: hostname,
      error: e instanceof Error ? e.message : String(e),
    });
    return plainText("911", 200);
  }
  if (detail.status === 404) return plainText("nohost", 200);
  if (!detail.ok) {
    console.error("dyndns: backend_lookup_failed", { tunnel_id: hostname, status: detail.status });
    return plainText("911", 200);
  }
  const detailJson = (await detail.json()) as {
    tunnel: { type: string; client_ipv4?: string; user_id: string };
  };
  if (detailJson.tunnel.user_id !== row.user_id) return plainText("nohost", 200);
  if (detailJson.tunnel.type === "wg") return plainText("nohost", 200);

  const current = detailJson.tunnel.client_ipv4;
  if (current === effective) {
    // same IP — refresh last_update_at for liveness; do not call backend
    await admin
      .from("dyndns_tokens")
      .update({ last_update_at: new Date().toISOString() })
      .eq("tunnel_id", hostname);
    console.info("dyndns: nochg", { tunnel_id: hostname, sourceIp, effective });
    return plainText(`nochg ${effective}`, 200);
  }

  // Per-token rate limit applies only to actual IP changes, so legitimate
  // same-IP polls (which return nochg) don't burn the budget.
  const tokLimit = rateLimit(`tok:${row.tunnel_id}`, DDNS_TOKEN_WINDOW_MS, DDNS_TOKEN_MAX);
  if (!tokLimit.allowed) return plainText("abuse", 200);

  // Push new IP to backend
  let patch: Response;
  try {
    patch = await fetch(`${apiUrl}/tunnels/${hostname}/ip`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ user_id: row.user_id, client_ipv4: effective }),
    });
  } catch (e) {
    console.error("dyndns: backend_patch_threw", {
      tunnel_id: hostname,
      error: e instanceof Error ? e.message : String(e),
    });
    return plainText("911", 200);
  }
  if (!patch.ok) {
    console.error("dyndns: backend_patch_failed", {
      tunnel_id: hostname,
      status: patch.status,
    });
    return plainText("911", 200);
  }

  // Update token row metadata; failure here doesn't roll back the IP change
  const { error: updErr } = await admin
    .from("dyndns_tokens")
    .update({
      last_update_ip: effective,
      last_update_at: new Date().toISOString(),
    })
    .eq("tunnel_id", hostname);
  if (updErr) {
    console.warn("dyndns: metadata_update_failed", {
      tunnel_id: hostname,
      error: updErr.message,
    });
  }

  console.info("dyndns: good", { tunnel_id: hostname, sourceIp, effective });
  return plainText(`good ${effective}`, 200);
}

export async function GET(req: NextRequest) {
  return handleUpdate(req);
}

export async function POST(req: NextRequest) {
  return handleUpdate(req);
}
