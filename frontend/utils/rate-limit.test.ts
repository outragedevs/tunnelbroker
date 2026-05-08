import { test, expect } from "vitest";
import { rateLimit } from "./rate-limit";

test("allows up to max within window, blocks afterwards, resets after window", () => {
  const t0 = 1_000_000;
  expect(rateLimit("k", 1000, 2, t0).allowed).toBe(true);
  expect(rateLimit("k", 1000, 2, t0 + 100).allowed).toBe(true);
  expect(rateLimit("k", 1000, 2, t0 + 200).allowed).toBe(false);
  expect(rateLimit("k", 1000, 2, t0 + 1500).allowed).toBe(true);
});
