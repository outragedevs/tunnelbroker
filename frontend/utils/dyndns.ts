import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export const TUNNEL_ID_RE = /^tun-[0-9a-f]{4}-[12]$/;
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export interface GeneratedToken {
  plaintext: string;     // "ddns_<43 base64url>"
  prefix: string;        // first 8 chars after "ddns_"
}

export function generateToken(): GeneratedToken {
  const buf = randomBytes(32);
  const b64url = buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const plaintext = `ddns_${b64url}`;
  const prefix = b64url.slice(0, 8);
  return { plaintext, prefix };
}

export async function hashToken(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}

export async function verifyToken(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export function isValidTunnelId(value: string): boolean {
  return TUNNEL_ID_RE.test(value);
}

export function isValidIpv4(value: string): boolean {
  if (!IPV4_RE.test(value)) return false;
  return value.split(".").every((part) => {
    const n = parseInt(part, 10);
    return n >= 0 && n <= 255;
  });
}

/**
 * Reject any IPv4 address that is not a globally routable unicast endpoint.
 * Returns true only for addresses suitable as a public tunnel client IP.
 *
 * Rejected ranges (RFC 1918, RFC 5735, RFC 5737, RFC 6598, RFC 2544 et al.):
 *   0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16,
 *   172.16.0.0/12, 192.0.2.0/24, 192.168.0.0/16, 198.18.0.0/15,
 *   198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 240.0.0.0/4
 *   (the last block already covers 255.255.255.255 broadcast).
 */
export function isPublicIpv4(value: string): boolean {
  if (!isValidIpv4(value)) return false;
  const [a, b, c] = value.split(".").map((p) => parseInt(p, 10));
  if (a === 0) return false;                                 // 0.0.0.0/8
  if (a === 10) return false;                                // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return false;        // 100.64.0.0/10 (CGNAT)
  if (a === 127) return false;                               // 127.0.0.0/8
  if (a === 169 && b === 254) return false;                  // 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return false;         // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 2) return false;         // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 168) return false;                  // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return false;     // 198.18.0.0/15 (benchmarking)
  if (a === 198 && b === 51 && c === 100) return false;      // 198.51.100.0/24 (TEST-NET-2)
  if (a === 203 && b === 0 && c === 113) return false;       // 203.0.113.0/24 (TEST-NET-3)
  if (a >= 224 && a <= 239) return false;                    // 224.0.0.0/4 (multicast)
  if (a >= 240) return false;                                // 240.0.0.0/4 + broadcast
  return true;
}

export function parseBasicAuth(header: string | null): { username: string; password: string } | null {
  if (!header || !header.startsWith("Basic ")) return null;
  const encoded = header.slice("Basic ".length).trim();
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return null;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return null;
  return {
    username: decoded.slice(0, idx),
    password: decoded.slice(idx + 1),
  };
}

export function firstForwardedFor(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export function plainText(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
