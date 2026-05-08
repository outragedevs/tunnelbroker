import { NextResponse } from "next/server";
import { requireAuthenticatedHex4Id } from "@/utils/tunnel-access";
import { createClient } from "@/utils/supabase/server";
import { generateToken, hashToken, isValidTunnelId } from "@/utils/dyndns";
import { getTunnelbrokerApiKey, getTunnelbrokerApiUrl } from "@/utils/backend-api";
import { TunnelResponse, DyndnsTokenInfo, CreateDyndnsTokenResponse } from "@/types/api";

async function fetchTunnel(tunnelId: string, hex4Id: string): Promise<TunnelResponse | NextResponse> {
  const url = `${getTunnelbrokerApiUrl()}/tunnels/${tunnelId}?user_id=${hex4Id}`;
  const r = await fetch(url, { headers: { "X-API-Key": getTunnelbrokerApiKey() } });
  if (!r.ok) {
    return NextResponse.json({ error: `tunnel lookup failed: ${r.status}` }, { status: r.status });
  }
  const data = (await r.json()) as TunnelResponse;
  if (data.tunnel.user_id !== hex4Id) {
    return NextResponse.json({ error: "You do not have access to this tunnel" }, { status: 403 });
  }
  if (data.tunnel.type === "wg") {
    return NextResponse.json({ error: "DDNS is not available for WireGuard tunnels" }, { status: 400 });
  }
  return data;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedHex4Id();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { id: tunnelId } = await params;
  if (!isValidTunnelId(tunnelId)) {
    return NextResponse.json({ error: "Invalid tunnel id" }, { status: 400 });
  }
  const tunnel = await fetchTunnel(tunnelId, auth.hex4Id);
  if (tunnel instanceof NextResponse) return tunnel;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dyndns_tokens")
    .select("token_prefix, created_at, last_update_ip, last_update_at")
    .eq("tunnel_id", tunnelId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json<DyndnsTokenInfo | null>(data ?? null);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedHex4Id();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { id: tunnelId } = await params;
  if (!isValidTunnelId(tunnelId)) {
    return NextResponse.json({ error: "Invalid tunnel id" }, { status: 400 });
  }
  const tunnel = await fetchTunnel(tunnelId, auth.hex4Id);
  if (tunnel instanceof NextResponse) return tunnel;

  const supabase = await createClient();
  const existing = await supabase
    .from("dyndns_tokens")
    .select("id")
    .eq("tunnel_id", tunnelId)
    .maybeSingle();
  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 500 });
  }
  if (existing.data) {
    return NextResponse.json(
      { error: "Token already exists for this tunnel; use POST /rotate to replace it" },
      { status: 409 }
    );
  }

  const { plaintext, prefix } = generateToken();
  const token_hash = await hashToken(plaintext);
  const insert = await supabase
    .from("dyndns_tokens")
    .insert({
      tunnel_id: tunnelId,
      user_id: auth.hex4Id,
      token_hash,
      token_prefix: prefix,
    })
    .select("created_at")
    .single();
  if (insert.error) {
    return NextResponse.json({ error: insert.error.message }, { status: 500 });
  }
  const body: CreateDyndnsTokenResponse = {
    token: plaintext,
    token_prefix: prefix,
    created_at: insert.data.created_at,
  };
  return NextResponse.json(body);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedHex4Id();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { id: tunnelId } = await params;
  if (!isValidTunnelId(tunnelId)) {
    return NextResponse.json({ error: "Invalid tunnel id" }, { status: 400 });
  }
  // ownership is enforced by RLS through the user's session;
  // we still verify via fetchTunnel to give clean error messages
  const tunnel = await fetchTunnel(tunnelId, auth.hex4Id);
  if (tunnel instanceof NextResponse) return tunnel;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dyndns_tokens")
    .delete()
    .eq("tunnel_id", tunnelId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
