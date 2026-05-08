import { test, expect } from "vitest";
import {
  generateToken,
  hashToken,
  verifyToken,
  isValidTunnelId,
  isPublicIpv4,
  parseBasicAuth,
  firstForwardedFor,
} from "./dyndns";

test("generateToken returns ddns_-prefixed token with 8-char prefix", () => {
  const { plaintext, prefix } = generateToken();
  expect(plaintext).toMatch(/^ddns_[A-Za-z0-9_-]{43}$/);
  expect(prefix.length).toBe(8);
  expect(plaintext.slice(5, 13)).toBe(prefix);
});

test("verifyToken matches hashToken output and rejects others", async () => {
  const { plaintext } = generateToken();
  const hash = await hashToken(plaintext);
  expect(await verifyToken(plaintext, hash)).toBe(true);
  expect(await verifyToken("ddns_wrong", hash)).toBe(false);
});

test("isValidTunnelId accepts canonical form, rejects others", () => {
  expect(isValidTunnelId("tun-1a2b-1")).toBe(true);
  expect(isValidTunnelId("tun-1a2b-2")).toBe(true);
  expect(isValidTunnelId("tun-1A2B-1")).toBe(false);
  expect(isValidTunnelId("tun-1a2b-3")).toBe(false);
  expect(isValidTunnelId("../etc/passwd")).toBe(false);
});

test("isPublicIpv4 rejects RFC1918 / loopback / link-local / 0.0.0.0/8", () => {
  for (const ip of ["10.0.0.1", "172.16.5.5", "172.31.1.1", "192.168.1.1", "127.0.0.1", "169.254.1.1", "0.0.0.0"]) {
    expect(isPublicIpv4(ip)).toBe(false);
  }
  for (const ip of ["1.2.3.4", "8.8.8.8", "172.15.255.255", "172.32.0.1"]) {
    expect(isPublicIpv4(ip)).toBe(true);
  }
});

test("parseBasicAuth decodes user:pass correctly", () => {
  const enc = Buffer.from("tun-1a2b-1:ddns_abc").toString("base64");
  expect(parseBasicAuth(`Basic ${enc}`)).toEqual({
    username: "tun-1a2b-1",
    password: "ddns_abc",
  });
  expect(parseBasicAuth(null)).toBeNull();
  expect(parseBasicAuth("Bearer xxx")).toBeNull();
});

test("firstForwardedFor returns first hop", () => {
  expect(firstForwardedFor("1.2.3.4, 10.0.0.1")).toBe("1.2.3.4");
  expect(firstForwardedFor("  1.2.3.4  ")).toBe("1.2.3.4");
  expect(firstForwardedFor(null)).toBeNull();
  expect(firstForwardedFor("")).toBeNull();
});
