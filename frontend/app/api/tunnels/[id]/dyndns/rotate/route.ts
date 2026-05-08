import { NextResponse } from "next/server";
import { requireAuthenticatedHex4Id } from "@/utils/tunnel-access";
import { createClient } from "@/utils/supabase/server";
import { generateToken, hashToken, isValidTunnelId } from "@/utils/dyndns";
import { getTunnelbrokerApiKey, getTunnelbrokerApiUrl } from "@/utils/backend-api";
import { TunnelResponse, CreateDyndnsTokenResponse } from "@/types/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedHex4Id();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { id: tunnelId } = await params;
  if (!isValidTunnelId(tunnelId)) {
    return NextResponse.json({ error: "Invalid tunnel id" }, { status: 400 });
  }

  const tr = await fetch(
    `${getTunnelbrokerApiUrl()}/tunnels/${tunnelId}?user_id=${auth.hex4Id}`,
    { headers: { "X-API-Key": getTunnelbrokerApiKey() } }
  );
  if (!tr.ok) {
    return NextResponse.json({ error: `tunnel lookup failed: ${tr.status}` }, { status: tr.status });
  }
  const td = (await tr.json()) as TunnelResponse;
  if (td.tunnel.user_id !== auth.hex4Id) {
    return NextResponse.json({ error: "You do not have access to this tunnel" }, { status: 403 });
  }
  if (td.tunnel.type === "wg") {
    return NextResponse.json({ error: "DDNS is not available for WireGuard tunnels" }, { status: 400 });
  }

  const supabase = await createClient();
  const { plaintext, prefix } = generateToken();
  const token_hash = await hashToken(plaintext);
  const upd = await supabase
    .from("dyndns_tokens")
    .update({ token_hash, token_prefix: prefix })
    .eq("tunnel_id", tunnelId)
    .select("created_at")
    .single();
  if (upd.error || !upd.data) {
    return NextResponse.json(
      { error: upd.error?.message ?? "No existing token to rotate; use POST /dyndns to create one" },
      { status: upd.error ? 500 : 404 }
    );
  }
  const body: CreateDyndnsTokenResponse = {
    token: plaintext,
    token_prefix: prefix,
    created_at: upd.data.created_at,
  };
  return NextResponse.json(body);
}
