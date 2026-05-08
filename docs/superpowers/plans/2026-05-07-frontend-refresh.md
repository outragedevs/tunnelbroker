# Frontend refresh implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a redesigned homepage `/` (dev-tool dark, amber accent, dark-first with light fallback, 5-section IA) and bring all `frontend/` dependencies to the latest stable, including a Tailwind v3 → v4 migration. Two reviewable commits: plain bumps first, then Tailwind v4 + redesign.

**Architecture:** Two-phase, two-commit. Phase 1 bumps non-Tailwind dependencies and proves the existing app still builds and runs. Phase 2 migrates Tailwind v3 → v4 (CSS-first config), redefines design tokens via `@theme inline`, and replaces `app/page.tsx` with new server components composed from `components/home/*`. Shadcn primitives in `components/ui/*` are not edited — they pick up the new look through unchanged token names (`primary`, `card`, `border`, ...) whose CSS values change.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Radix UI, next-themes, Geist + Geist Mono (next/font), Supabase JS (admin client for live tunnel count), TypeScript 6.

**Spec:** `docs/superpowers/specs/2026-05-07-frontend-refresh-design.md`

**Branch:** `feature/frontend-refresh` (already created and checked out)

---

## File map

### Created

- `frontend/utils/homepage-stats.ts` — `getHomepageStats()` server helper, queries Supabase admin client for tunnel count
- `frontend/utils/homepage-stats.test.ts` — unit tests for the helper
- `frontend/components/home/site-header.tsx` — homepage-only header with scroll backdrop
- `frontend/components/home/hero.tsx` — hero section (server)
- `frontend/components/home/stats-bar.tsx` — stats bar (server, presentational)
- `frontend/components/home/tunnel-types.tsx` — section with Radix Tabs (client)
- `frontend/components/home/network-section.tsx` — network section (server)
- `frontend/components/home/ddns-spotlight.tsx` — DDNS section with Tabs (client)
- `frontend/components/home/fair-use.tsx` — limits & policy (server)
- `frontend/components/home/code-block.tsx` — `<pre>` wrapper with optional copy button
- `frontend/components/home/copy-button.tsx` — clipboard button (client)

### Modified

- `frontend/package.json` — full dependency bump
- `frontend/postcss.config.js` — `tailwindcss` plugin → `@tailwindcss/postcss`
- `frontend/app/layout.tsx` — add Geist Mono font alongside Geist
- `frontend/app/globals.css` — rewritten: `@import "tailwindcss"`, `@import "tw-animate-css"`, `@theme inline` block, `:root` and `.dark` token values
- `frontend/app/page.tsx` — replaced with composition of new sections

### Deleted

- `frontend/tailwind.config.ts` — Tailwind v4 uses CSS-first config

### Untouched

- All of `app/dashboard/**`, `app/(auth-pages)/**`, `app/api/**`, `app/nic/update/**`
- All `components/ui/**` (shadcn primitives) — pick up new look through unchanged token names
- All other `components/*.tsx` (DDNS, tunnels, theme switcher, etc.)
- `lib/utils.ts`, `utils/supabase/**`, `utils/dyndns.ts`, `utils/backend-api.ts`, etc.

---

## Constants used in the plan

These appear in multiple snippets — single source of truth:

```ts
// Static facts, hardcoded everywhere they appear
export const AS_NUMBER = 198889;
export const PEER_AS_NUMBER = 56655;
export const PEER_NAME = "Gigahost";
export const BGP_SESSIONS = 4;
export const ENDPOINT_LOCATION = "Oslo, NO";
export const RTT_OSLO_IX = "~3 ms";
export const SERVER_IPV4 = "185.243.218.164";
export const WG_PORT = 51820;
export const PREFIX_POOLS = [
  { cidr: "2a05:1083:bef0::/44", role: "primary delegation" },
  { cidr: "2a12:bec0:02c0::/44", role: "secondary delegation" },
  { cidr: "2a05:1083:bee0::/44", role: "primary (alt)" },
  { cidr: "2a05:dfc1:3c10::/44", role: "secondary (alt)" },
  { cidr: "2a03:94e0:2496::/48", role: "non-BGP local" },
] as const;
export const BLOCKED_PORTS_SMTP = [25, 465, 587, 2525];
export const BLOCKED_PORTS_POP_IMAP = [110, 143, 993, 995];
```

These live in `components/home/site-data.ts` (created by Task 9 below).

---

## Phase A — Bump batch (lands as commit 1)

### Task 1: Bump non-Tailwind dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Update package.json**

Open `frontend/package.json`. Replace the `dependencies` and `devDependencies` blocks with the version bumps below. **Do NOT touch Tailwind, lucide-react, or tailwindcss-animate yet** — they go in Phase B.

```json
{
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-tabs": "^1.1.13",
    "@supabase/ssr": "latest",
    "@supabase/supabase-js": "latest",
    "autoprefixer": "10.5.0",
    "bcryptjs": "^3.0.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "next": "^16.2.5",
    "next-themes": "^0.4.6",
    "prettier": "^3.8.3",
    "react": "19.2.6",
    "react-dom": "19.2.6"
  },
  "devDependencies": {
    "@types/bcryptjs": "^3.0.0",
    "@types/node": "25.6.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "19.2.3",
    "postcss": "8.5.14",
    "tailwind-merge": "^2.5.2",
    "tailwindcss": "3.4.17",
    "tailwindcss-animate": "^1.0.7",
    "typescript": "6.0.3"
  }
}
```

- [ ] **Step 2: Reinstall**

```bash
cd frontend && rm -rf node_modules package-lock.json && npm install
```

Expected: install completes, no peer-dep errors. `npm warn`s for deprecated subpackages are OK; outright errors are not.

- [ ] **Step 3: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: clean. If TypeScript 6 surfaces errors:
- `@types/bcryptjs` 3.x sometimes requires `import bcrypt from "bcryptjs"` instead of `import * as bcrypt`. Search for `from "bcryptjs"` and adjust.
- Stricter `any` checks may show. Fix at root, no `// @ts-ignore`.

- [ ] **Step 4: Build**

```bash
cd frontend && npm run build
```

Expected: build succeeds. Warnings about Tailwind v3 are expected and untouched.

- [ ] **Step 5: Manual smoke test**

```bash
cd frontend && PORT=3100 npm run dev
```

In another terminal, curl the homepage to verify it serves:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/
```

Expected: `200`. Open the URL in a browser if practical; verify the page renders, sign-in link works, and dashboard loads after sign-in. Stop the dev server (Ctrl-C in the dev terminal).

- [ ] **Step 6: Commit**

```bash
cd /home/k/tb && git add frontend/package.json frontend/package-lock.json
git -c user.name='kofany' -c user.email='j@dabrowski.biz' commit -m "$(cat <<'EOF'
chore(frontend): bump non-Tailwind dependencies to latest stable

Next 16.0.8 → 16.2.5, React 19.0.0 → 19.2.6, TypeScript 5.7.2 → 6.0.3,
@types/node 22 → 25, @types/bcryptjs 2 → 3, all Radix UI primitives, plus
postcss/autoprefixer/prettier minor bumps. Tailwind, lucide-react, and the
Tailwind animate plugin stay on v3 in this commit — they migrate together
in the next commit alongside the homepage redesign.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit created on `feature/frontend-refresh`.

---

## Phase B — Tailwind v4 migration

### Task 2: Replace Tailwind + lucide-react packages

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Update Tailwind-related deps**

In `frontend/package.json`, apply these changes (only the lines below; everything else from Task 1 stays):

```json
{
  "dependencies": {
    "lucide-react": "^1.14.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.2.4",
    "tailwind-merge": "^3.5.0",
    "tailwindcss": "4.2.4",
    "tw-animate-css": "^1.4.1"
  }
}
```

Also **remove** the `tailwindcss-animate` line entirely. Final `frontend/package.json` should have:
- `dependencies` includes the new `lucide-react` value (replace existing)
- `devDependencies`: `@tailwindcss/postcss` added, `tailwind-merge` bumped, `tailwindcss` bumped, `tw-animate-css` added, `tailwindcss-animate` removed

- [ ] **Step 2: Reinstall**

```bash
cd frontend && rm -rf node_modules package-lock.json && npm install
```

Expected: install completes. Tailwind 4 may emit a peer-dep notice about Next; safe to ignore.

- [ ] **Step 3: Confirm `tw-animate-css` ships expected utilities**

```bash
grep -E "accordion-(up|down)|animate-(in|out)" frontend/node_modules/tw-animate-css/dist/tw-animate-css.css | head
```

Expected: matches found. These are the utilities Radix dialog/dropdown/tabs use under the hood.

- [ ] **Step 4: Verify lucide-react imports we depend on still exist**

```bash
grep -rh "from ['\"]lucide-react['\"]" frontend/components frontend/app | sed -E "s/.*\\{(.*)\\}.*/\\1/" | tr ',' '\n' | sed 's/ //g' | sort -u
```

Expected: a list of icon names. Then verify each name resolves in lucide-react 1.x:
```bash
node -e 'const l = require("lucide-react"); ["Sun","Moon","Laptop","Loader2","Copy","ExternalLink"].forEach(n => console.log(n, n in l ? "ok" : "MISSING"))'
```
Add any other names from the previous grep to the array. If `MISSING`, look up the rename in the lucide changelog and apply across the codebase before continuing.

(No commit yet — Phase B finishes with a single commit at Task 8.)

### Task 3: Switch PostCSS plugin and delete Tailwind config

**Files:**
- Modify: `frontend/postcss.config.js`
- Delete: `frontend/tailwind.config.ts`

- [ ] **Step 1: Update PostCSS config**

Replace the entire contents of `frontend/postcss.config.js` with:

```js
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 2: Delete the legacy Tailwind config**

```bash
rm frontend/tailwind.config.ts
```

Tailwind 4 reads its config from CSS (`@theme` blocks) and auto-discovers content roots; the TS config is no longer used.

### Task 4: Rewrite globals.css with new tokens

**Files:**
- Modify (full rewrite): `frontend/app/globals.css`

- [ ] **Step 1: Replace the entire file**

Overwrite `frontend/app/globals.css` with:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  /* Light theme — refined cappuccino DNA */
  --background: #faf8f4;
  --foreground: #1d1714;
  --card: #fdfbf8;
  --card-foreground: #1d1714;
  --popover: #fdfbf8;
  --popover-foreground: #1d1714;
  --primary: #b45309;          /* amber-700 — accent on light bg */
  --primary-foreground: #faf8f4;
  --secondary: #f3eee5;
  --secondary-foreground: #1d1714;
  --muted: #f3eee5;
  --muted-foreground: #5b4a36;
  --accent: #f3eee5;            /* shadcn "accent" = hover surface */
  --accent-foreground: #1d1714;
  --destructive: #b91c1c;
  --destructive-foreground: #faf8f4;
  --border: #e8e1d3;
  --input: #e8e1d3;
  --ring: #b45309;

  /* Extended tokens for the homepage */
  --success: #15803d;
  --border-strong: #cfc4ad;
  --fg-subtle: #8a7960;
  --primary-soft: rgb(180 83 9 / 0.08);

  --radius: 0.5rem;
}

.dark {
  /* Dark theme — dev-tool */
  --background: #0b0d10;
  --foreground: #e6edf3;
  --card: #0e1116;
  --card-foreground: #e6edf3;
  --popover: #0e1116;
  --popover-foreground: #e6edf3;
  --primary: #f59e0b;          /* amber-500 — accent on dark bg */
  --primary-foreground: #0b0d10;
  --secondary: #161b22;
  --secondary-foreground: #e6edf3;
  --muted: #161b22;
  --muted-foreground: #7d8590;
  --accent: #161b22;
  --accent-foreground: #e6edf3;
  --destructive: #ff7b72;
  --destructive-foreground: #0b0d10;
  --border: #1f2428;
  --input: #1f2428;
  --ring: #f59e0b;

  --success: #7ee787;
  --border-strong: #30363d;
  --fg-subtle: #484f58;
  --primary-soft: rgb(245 158 11 / 0.08);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-success: var(--success);
  --color-border-strong: var(--border-strong);
  --color-fg-subtle: var(--fg-subtle);
  --color-primary-soft: var(--primary-soft);

  --radius: var(--radius);

  --font-sans: var(--font-geist), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, "SFMono-Regular",
    "Menlo", "Consolas", monospace;
}

@layer base {
  * {
    border-color: var(--color-border);
  }

  html {
    color-scheme: light dark;
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
    font-feature-settings: "ss01" on, "cv11" on;
  }

  ::selection {
    background-color: var(--color-primary-soft);
    color: var(--color-foreground);
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

### Task 5: Add Geist Mono and wire CSS variables

**Files:**
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Add Geist Mono font and expose both as CSS variables**

Replace the entire contents of `frontend/app/layout.tsx` with:

```tsx
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { metadata } from "./metadata";

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export { metadata };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Note: `defaultTheme` flips from `"system"` to `"dark"` to honor the dark-first decision; `enableSystem` keeps respecting the user's OS preference.

### Task 6: Verify build still succeeds with v4 + tokens

**Files:** none (validation only)

- [ ] **Step 1: Build**

```bash
cd frontend && npm run build
```

Expected: build succeeds. Tailwind v4 may print one or two warnings about deprecated v3 patterns it auto-migrated; if any *errors* appear, stop and fix.

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Run dev server and confirm current page renders without crashing**

```bash
cd frontend && PORT=3100 npm run dev
```

In another terminal:
```bash
curl -s http://localhost:3100/ | grep -c "Free IPv6 Tunnel Broker"
```

Expected: `1` (the existing copy is still in `app/page.tsx` from before this task — it gets replaced in Task 16).

The page may look visually broken (old class names referencing deleted tokens) — that is OK. The build is what we are guarding here.

Stop the dev server.

(Phase B has no commit of its own — its changes ship together with Phase C/D as one logical unit: "redesign + Tailwind v4". This keeps reviewers from looking at a half-broken state in isolation.)

---

## Phase C — Foundational components and helpers

### Task 7: Build homepage-stats helper with tests

**Files:**
- Create: `frontend/utils/homepage-stats.ts`
- Create: `frontend/utils/homepage-stats.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/utils/homepage-stats.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/utils/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/utils/supabase/admin";
import { getHomepageStats } from "./homepage-stats";

describe("getHomepageStats", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns the live tunnel count when Supabase responds successfully", async () => {
    const select = vi.fn().mockResolvedValue({ count: 314, error: null });
    const from = vi.fn().mockReturnValue({ select });
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({ from });

    const stats = await getHomepageStats();

    expect(from).toHaveBeenCalledWith("tunnels");
    expect(select).toHaveBeenCalledWith("*", { count: "exact", head: true });
    expect(stats.activeTunnels).toBe(314);
    expect(stats.asNumber).toBe(198889);
    expect(stats.bgpSessions).toBe(4);
    expect(stats.endpoint).toBe("Oslo, NO");
  });

  it("returns null activeTunnels when Supabase errors", async () => {
    const select = vi
      .fn()
      .mockResolvedValue({ count: null, error: new Error("nope") });
    const from = vi.fn().mockReturnValue({ select });
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({ from });

    const stats = await getHomepageStats();

    expect(stats.activeTunnels).toBeNull();
    expect(stats.asNumber).toBe(198889);
  });

  it("returns null activeTunnels when admin client throws (e.g. missing env)", async () => {
    (createAdminClient as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("Missing SUPABASE_SECRET_KEY");
    });

    const stats = await getHomepageStats();

    expect(stats.activeTunnels).toBeNull();
  });
});
```

- [ ] **Step 2: Confirm there's no test runner configured yet, then add one**

```bash
cd frontend && cat package.json | grep -E "vitest|jest" || echo "no test runner"
```

If output is `no test runner`, add Vitest:

```bash
cd frontend && npm install --save-dev vitest @vitejs/plugin-react jsdom
```

Then create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

Add a script to `frontend/package.json`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run"
}
```

(Note: `frontend/utils/dyndns.test.ts` and `frontend/utils/rate-limit.test.ts` already exist; they presumably weren't run as part of CI. Adding the runner now lets them participate too. If those existing tests fail under Vitest, fix or skip them inline — they should be straightforward.)

- [ ] **Step 3: Run the new tests, confirm they fail**

```bash
cd frontend && npm test -- homepage-stats
```

Expected: failure — `getHomepageStats` does not exist.

- [ ] **Step 4: Implement the helper**

Create `frontend/utils/homepage-stats.ts`:

```ts
import { createAdminClient } from "@/utils/supabase/admin";

export interface HomepageStats {
  activeTunnels: number | null;
  asNumber: number;
  bgpSessions: number;
  endpoint: string;
}

const STATIC_FACTS = {
  asNumber: 198889,
  bgpSessions: 4,
  endpoint: "Oslo, NO",
} as const;

export async function getHomepageStats(): Promise<HomepageStats> {
  let activeTunnels: number | null = null;

  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("tunnels")
      .select("*", { count: "exact", head: true });

    if (!error && typeof count === "number") {
      activeTunnels = count;
    }
  } catch {
    activeTunnels = null;
  }

  return {
    activeTunnels,
    ...STATIC_FACTS,
  };
}
```

- [ ] **Step 5: Run tests, confirm they pass**

```bash
cd frontend && npm test -- homepage-stats
```

Expected: 3 passing.

### Task 8: Build site-data constants module

**Files:**
- Create: `frontend/components/home/site-data.ts`

- [ ] **Step 1: Create the constants file**

Create `frontend/components/home/site-data.ts`:

```ts
export const AS_NUMBER = 198889;
export const PEER_AS_NUMBER = 56655;
export const PEER_NAME = "Gigahost";
export const BGP_SESSIONS = 4;
export const ENDPOINT_LOCATION = "Oslo, NO";
export const RTT_OSLO_IX = "~3 ms";
export const SERVER_IPV4 = "185.243.218.164";
export const WG_PORT = 51820;

export const PREFIX_POOLS = [
  { cidr: "2a05:1083:bef0::/44", role: "primary delegation" },
  { cidr: "2a12:bec0:02c0::/44", role: "secondary delegation" },
  { cidr: "2a05:1083:bee0::/44", role: "primary (alt)" },
  { cidr: "2a05:dfc1:3c10::/44", role: "secondary (alt)" },
  { cidr: "2a03:94e0:2496::/48", role: "non-BGP local" },
] as const;

export const BLOCKED_PORTS_SMTP = [25, 465, 587, 2525];
export const BLOCKED_PORTS_POP_IMAP = [110, 143, 993, 995];

export const COMPATIBLE_DDNS_CLIENTS = [
  "Fritz!Box",
  "MikroTik",
  "OpenWrt",
  "ASUS Merlin",
  "OPNsense",
  "pfSense",
  "ddclient",
  "inadyn",
  "curl",
] as const;
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: clean.

### Task 9: Build copy-button + code-block

**Files:**
- Create: `frontend/components/home/copy-button.tsx`
- Create: `frontend/components/home/code-block.tsx`

- [ ] **Step 1: Create copy-button**

Create `frontend/components/home/copy-button.tsx`:

```tsx
"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  className?: string;
  label?: string;
}

export function CopyButton({ value, className, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore — clipboard not available */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-background/40",
        "px-2 py-1 text-xs font-mono text-muted-foreground",
        "transition-colors hover:text-foreground hover:border-primary/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className
      )}
    >
      {copied ? (
        <>
          <Check size={12} className="text-success" />
          copied
        </>
      ) : (
        <>
          <Copy size={12} />
          {label}
        </>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Create code-block**

Create `frontend/components/home/code-block.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

interface CodeBlockProps {
  filename?: string;
  copyValue?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CodeBlock({
  filename,
  copyValue,
  rightSlot,
  children,
  className,
}: CodeBlockProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border-strong bg-muted",
        className
      )}
    >
      {(filename || rightSlot || copyValue) && (
        <div className="flex items-center justify-between gap-3 border-b border-border-strong bg-card/40 px-3 py-2">
          {filename ? (
            <span className="font-mono text-xs text-muted-foreground">
              {filename}
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {rightSlot}
            {copyValue && <CopyButton value={copyValue} />}
          </div>
        </div>
      )}
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-[1.6] text-foreground">
        {children}
      </pre>
    </div>
  );
}
```

- [ ] **Step 3: Verify type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: clean.

---

## Phase D — Build the homepage sections

### Task 10: Build SiteHeader

**Files:**
- Create: `frontend/components/home/site-header.tsx`

- [ ] **Step 1: Create the header**

Create `frontend/components/home/site-header.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import Logo from "@/components/logo";
import { cn } from "@/lib/utils";

interface SiteHeaderProps {
  user: User | null;
}

export function SiteHeader({ user }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-150",
        scrolled
          ? "bg-background/85 backdrop-blur border-b border-border"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6 md:px-8">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="block h-2 w-2 rounded-full bg-primary"
          />
          <Logo href="/" width={128} height={32} className="hidden md:block" />
          <Link
            href="/"
            className="font-mono text-sm font-semibold tracking-tight md:hidden"
          >
            tunnelbroker
          </Link>
        </div>
        <nav className="hidden items-center gap-6 font-mono text-xs text-muted-foreground md:flex">
          <a href="#tunnels" className="hover:text-foreground">
            Tunnels
          </a>
          <a href="#network" className="hover:text-foreground">
            Network
          </a>
          <a
            href="https://lg.gigahost.no"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            Status ↗
          </a>
          <a href="#ddns" className="hover:text-foreground">
            DDNS
          </a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Dashboard →</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
```

### Task 11: Build StatsBar + Hero

**Files:**
- Create: `frontend/components/home/stats-bar.tsx`
- Create: `frontend/components/home/hero.tsx`

- [ ] **Step 1: Create StatsBar**

Create `frontend/components/home/stats-bar.tsx`:

```tsx
import type { HomepageStats } from "@/utils/homepage-stats";
import { RTT_OSLO_IX } from "./site-data";

interface StatsBarProps {
  stats: HomepageStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  const cells = [
    {
      label: "Active tunnels",
      value:
        stats.activeTunnels === null
          ? "—"
          : stats.activeTunnels.toLocaleString("en-US"),
    },
    {
      label: "AS",
      value: stats.asNumber.toString(),
    },
    {
      label: "BGP sessions",
      value: stats.bgpSessions.toString(),
    },
    {
      label: "Endpoint",
      value: stats.endpoint,
    },
  ];

  return (
    <div className="mt-12">
      <div className="grid grid-cols-2 gap-y-4 border-t border-border pt-5 md:grid-cols-4 md:divide-x md:divide-border md:gap-y-0">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className="px-4 first:pl-0 last:pr-0 md:px-6"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {cell.label}
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
              {cell.value}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 font-mono text-xs text-fg-subtle">
        {RTT_OSLO_IX} RTT to Oslo IX · check at{" "}
        <a
          href="https://lg.gigahost.no"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          lg.gigahost.no
        </a>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create Hero**

Create `frontend/components/home/hero.tsx`:

```tsx
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { StatsBar } from "./stats-bar";
import type { HomepageStats } from "@/utils/homepage-stats";

interface HeroProps {
  user: User | null;
  stats: HomepageStats;
}

export function Hero({ user, stats }: HeroProps) {
  return (
    <section
      id="hero"
      className="relative overflow-hidden border-b border-border"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[480px] max-w-[900px] opacity-60 [background:radial-gradient(ellipse_at_top,var(--color-primary-soft),transparent_70%)]" />
      <div className="mx-auto max-w-[1180px] px-6 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
        <div className="mx-auto max-w-[760px] text-center md:text-left">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
            // free ipv6 tunneling · norway
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-6xl lg:text-7xl">
            IPv6 for the rest of
            <br className="hidden md:inline" /> your IPv4-only world.
          </h1>
          <p className="mt-5 max-w-[560px] text-base text-muted-foreground md:mx-0 md:text-lg md:leading-[1.55]">
            SIT, GRE and WireGuard tunnels with BGP-routed /48s. Free,
            dual-stack, dyndns2-ready.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="font-medium">
              <Link href={user ? "/dashboard" : "/sign-up"}>
                {user ? "Open dashboard →" : "Get a tunnel →"}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="font-medium">
              <a href="#network">View network</a>
            </Button>
          </div>
        </div>
        <StatsBar stats={stats} />
      </div>
    </section>
  );
}
```

### Task 12: Build TunnelTypes (tabs with config previews)

**Files:**
- Create: `frontend/components/home/tunnel-types.tsx`

- [ ] **Step 1: Create the section**

Create `frontend/components/home/tunnel-types.tsx`:

```tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "./code-block";
import { SERVER_IPV4, WG_PORT } from "./site-data";

const SIT_SNIPPET = `ip tunnel add tun-XXXX-1 mode sit \\
  remote ${SERVER_IPV4} local <YOUR_IPV4> ttl 255
ip link set tun-XXXX-1 up
ip addr add fd00:beef:cafe::2/64 dev tun-XXXX-1
ip -6 route add 2a05:1083:bef0::/44 dev tun-XXXX-1`;

const GRE_SNIPPET = `ip tunnel add tun-XXXX-1 mode ip6gre \\
  remote 2a03:94e0:ffff:185:243:218:0:164 local <YOUR_IPV6_OR_4> ttl 255
ip link set tun-XXXX-1 up
ip addr add fd00:beef:cafe::2/64 dev tun-XXXX-1
ip -6 route add 2a05:1083:bef0::/44 dev tun-XXXX-1`;

const WG_SNIPPET = `[Interface]
PrivateKey = <YOUR_PRIVATE_KEY>
Address = 2a05:1083:bef0::1/64

[Peer]
PublicKey = <SERVER_PUBLIC_KEY>
Endpoint = tb.tahio.eu:${WG_PORT}
AllowedIPs = ::/0
PersistentKeepalive = 25`;

const TYPES = [
  {
    id: "sit",
    label: "SIT",
    blurb:
      "Simple Internet Transition: IPv6-over-IPv4. Pick this when you have a static IPv4 and want the leanest setup. Two prefixes per tunnel via -1 / -2 interfaces.",
    facts: [
      "kernel · sit module",
      "MTU · 1480",
      "dual-prefix · yes (-1, -2)",
    ],
    file: "setup-sit.sh",
    code: SIT_SNIPPET,
  },
  {
    id: "gre",
    label: "GRE",
    blurb:
      "Generic Routing Encapsulation. More flexible than SIT — works over IPv6 transport too. Same dual-prefix model as SIT.",
    facts: [
      "kernel · ip6_gre / gre",
      "MTU · 1462",
      "dual-prefix · yes (-1, -2)",
    ],
    file: "setup-gre.sh",
    code: GRE_SNIPPET,
  },
  {
    id: "wg",
    label: "WireGuard",
    blurb:
      "Modern, peer-driven. The endpoint learns your IP from the handshake, so dynamic IPv4 routers work out of the box. Single prefix per tunnel.",
    facts: [
      "userspace · wireguard-tools",
      "MTU · 1420",
      "dual-prefix · no (single)",
    ],
    file: "wg0.conf",
    code: WG_SNIPPET,
  },
] as const;

export function TunnelTypes() {
  return (
    <section
      id="tunnels"
      className="border-b border-border bg-card/30"
    >
      <div className="mx-auto max-w-[1180px] px-6 py-20 md:px-8 md:py-28">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
          // tunnel types
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Three ways to tunnel.
        </h2>
        <p className="mt-3 max-w-[640px] text-muted-foreground">
          Pick whichever your router speaks. All three give you the same
          BGP-routed prefixes.
        </p>

        <Tabs defaultValue="wg" className="mt-10">
          <TabsList className="bg-muted">
            {TYPES.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="font-mono text-xs"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TYPES.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-6">
              <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:gap-10">
                <div>
                  <p className="text-base leading-[1.65] text-foreground">
                    {t.blurb}
                  </p>
                  <ul className="mt-5 space-y-1.5 font-mono text-xs text-muted-foreground">
                    {t.facts.map((f) => (
                      <li key={f}>· {f}</li>
                    ))}
                  </ul>
                </div>
                <CodeBlock filename={t.file} copyValue={t.code}>
                  {t.code}
                </CodeBlock>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
```

### Task 13: Build NetworkSection

**Files:**
- Create: `frontend/components/home/network-section.tsx`

- [ ] **Step 1: Create the section**

Create `frontend/components/home/network-section.tsx`:

```tsx
import {
  AS_NUMBER,
  BGP_SESSIONS,
  PEER_AS_NUMBER,
  PEER_NAME,
  PREFIX_POOLS,
} from "./site-data";

export function NetworkSection() {
  return (
    <section id="network" className="border-b border-border">
      <div className="mx-auto max-w-[1180px] px-6 py-20 md:px-8 md:py-28">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
          // network
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Anchored in Oslo.
        </h2>
        <p className="mt-3 max-w-[640px] text-muted-foreground">
          Our own AS, peered with {PEER_NAME}, with five /44 pools to delegate
          from.
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="rounded-lg bg-primary-soft px-6 py-8">
              <span className="font-mono text-5xl font-semibold tracking-tight text-primary md:text-6xl lg:text-7xl">
                AS{AS_NUMBER}
              </span>
            </div>
            <p className="mt-5 text-base leading-[1.65] text-foreground">
              Peered with{" "}
              <span className="font-mono text-primary">
                AS{PEER_AS_NUMBER}
              </span>{" "}
              ({PEER_NAME}). {BGP_SESSIONS} BGP sessions established, importing
              default route only.
            </p>
            <p className="mt-3">
              <a
                href="https://lg.gigahost.no"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-primary underline underline-offset-4 hover:text-foreground"
              >
                Looking glass ↗
              </a>
            </p>
          </div>

          <div className="rounded-lg border border-border-strong bg-card p-5">
            <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Prefix pools
            </h3>
            <ul className="mt-4 space-y-2.5 font-mono text-sm">
              {PREFIX_POOLS.map((pool) => (
                <li
                  key={pool.cidr}
                  className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <span className="text-foreground">{pool.cidr}</span>
                  <span className="text-xs text-fg-subtle">{pool.role}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-fg-subtle">
              Each tunnel gets two /64s from the primary pools plus a /64 from
              a tertiary.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
```

### Task 14: Build DdnsSpotlight

**Files:**
- Create: `frontend/components/home/ddns-spotlight.tsx`

- [ ] **Step 1: Create the section**

Create `frontend/components/home/ddns-spotlight.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "./code-block";
import { COMPATIBLE_DDNS_CLIENTS } from "./site-data";

const CURL_SNIPPET = `curl -u tun-XXXX-1:ddns_xxxxxxxxx... \\
  "https://tb.tahio.eu/nic/update?myip=$(curl -4s ifconfig.me)"`;

const DDCLIENT_SNIPPET = `protocol=dyndns2
use=web, web=ifconfig.me
server=tb.tahio.eu
ssl=yes
login=tun-XXXX-1
password='ddns_xxxxxxxxx...'
tun-XXXX-1`;

const FRITZ_FIELDS: Array<{ field: string; value: string }> = [
  {
    field: "Update URL",
    value:
      "https://<username>:<pass>@tb.tahio.eu/nic/update?hostname=<domain>&myip=<ipaddr>",
  },
  { field: "Domain name", value: "tun-XXXX-1" },
  { field: "Username", value: "tun-XXXX-1" },
  { field: "Password", value: "ddns_xxxxxxxxx..." },
];

interface DdnsSpotlightProps {
  user: { id: string } | User | null;
}

export function DdnsSpotlight({ user }: DdnsSpotlightProps) {
  const cta = user ? "/dashboard" : "/sign-up";

  return (
    <section
      id="ddns"
      className="border-b border-border bg-card/30"
    >
      <div className="mx-auto max-w-[1180px] px-6 py-20 md:px-8 md:py-28">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
          // new
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Dynamic DNS, no dashboard required.
        </h2>
        <p className="mt-3 max-w-[640px] text-muted-foreground">
          Run your tunnel from a connection with a dynamic IPv4? Each SIT or
          GRE tunnel can issue a per-tunnel token — any router or script keeps
          the endpoint in sync over the standard{" "}
          <span className="font-mono text-foreground">dyndns2</span> protocol.
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-[1fr_1.1fr]">
          <div>
            <ul className="space-y-3 text-sm leading-[1.65] text-foreground">
              <li>
                <span className="font-mono text-xs uppercase text-primary">
                  per tunnel
                </span>{" "}
                — one token, rotateable on demand from the dashboard.
              </li>
              <li>
                <span className="font-mono text-xs uppercase text-primary">
                  bcrypt
                </span>{" "}
                — hashed in the database with cost 12. Plaintext shown once.
              </li>
              <li>
                <span className="font-mono text-xs uppercase text-primary">
                  rate-limited
                </span>{" "}
                — one update / 30 s per token, 30 / min per source IP.
              </li>
            </ul>
            <Button asChild size="lg" className="mt-6 font-medium">
              <Link href={cta}>Generate a token →</Link>
            </Button>
          </div>

          <Tabs defaultValue="curl">
            <TabsList className="bg-muted">
              <TabsTrigger value="curl" className="font-mono text-xs">
                curl
              </TabsTrigger>
              <TabsTrigger value="ddclient" className="font-mono text-xs">
                ddclient
              </TabsTrigger>
              <TabsTrigger value="fritzbox" className="font-mono text-xs">
                Fritz!Box
              </TabsTrigger>
            </TabsList>
            <TabsContent value="curl" className="mt-4">
              <CodeBlock copyValue={CURL_SNIPPET}>{CURL_SNIPPET}</CodeBlock>
            </TabsContent>
            <TabsContent value="ddclient" className="mt-4">
              <CodeBlock filename="~/.ddclient.conf" copyValue={DDCLIENT_SNIPPET}>
                {DDCLIENT_SNIPPET}
              </CodeBlock>
            </TabsContent>
            <TabsContent value="fritzbox" className="mt-4">
              <div className="overflow-hidden rounded-lg border border-border-strong bg-muted">
                <div className="border-b border-border-strong bg-card/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                  Internet · Permit access · Dynamic DNS
                </div>
                <dl className="divide-y divide-border px-4 py-3 text-[13px]">
                  {FRITZ_FIELDS.map((row) => (
                    <div
                      key={row.field}
                      className="grid grid-cols-[120px_1fr] gap-3 py-2"
                    >
                      <dt className="font-mono text-muted-foreground">
                        {row.field}
                      </dt>
                      <dd className="break-all font-mono text-foreground">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="mt-10 flex flex-wrap gap-2">
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Compatible with:
          </span>
          {COMPATIBLE_DDNS_CLIENTS.map((c) => (
            <span
              key={c}
              className="rounded-md border border-border-strong px-2 py-0.5 font-mono text-xs text-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### Task 15: Build FairUse

**Files:**
- Create: `frontend/components/home/fair-use.tsx`

- [ ] **Step 1: Create the section**

Create `frontend/components/home/fair-use.tsx`:

```tsx
import { BLOCKED_PORTS_POP_IMAP, BLOCKED_PORTS_SMTP } from "./site-data";

export function FairUse() {
  const cards = [
    {
      title: "Per-tunnel limits",
      bullets: [
        "50 Mbit/s up + down, kernel-shaped",
        "2 tunnels per account",
        "SIT/GRE: dual-prefix · WG: single",
      ],
    },
    {
      title: "Blocked ports",
      bullets: [
        `SMTP · ${BLOCKED_PORTS_SMTP.join(" · ")}`,
        `POP3/IMAP · ${BLOCKED_PORTS_POP_IMAP.join(" · ")}`,
        "We don't run mail and we won't relay yours.",
      ],
    },
    {
      title: "Abuse",
      bullets: [
        "Spam, scanning, illegal traffic, DDoS reflection — instant termination, no warning.",
        "SYN-flood + ICMP rate limits applied per-tunnel automatically.",
      ],
    },
  ];

  return (
    <section id="fair-use" className="border-b border-border">
      <div className="mx-auto max-w-[1180px] px-6 py-20 md:px-8 md:py-28">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
          // fair use
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Free isn't unlimited.
        </h2>
        <p className="mt-3 max-w-[640px] text-muted-foreground">
          Limits exist so the service stays available for everyone.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-lg border border-border-strong bg-card p-5"
            >
              <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {card.title}
              </h3>
              <ul className="mt-4 space-y-2 text-sm leading-[1.55] text-foreground">
                {card.bullets.map((b) => (
                  <li key={b} className="font-mono text-[13px]">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 max-w-[640px] font-mono text-xs text-fg-subtle">
          No SLA, no uptime guarantee. We run this because it should exist. —
          kiAntrieb.de
        </p>
      </div>
    </section>
  );
}
```

### Task 16: Compose new page.tsx

**Files:**
- Modify (full rewrite): `frontend/app/page.tsx`

- [ ] **Step 1: Replace the page**

Overwrite `frontend/app/page.tsx` with:

```tsx
import { createClient } from "@/utils/supabase/server";
import FooterLogo from "@/components/footer-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SiteHeader } from "@/components/home/site-header";
import { Hero } from "@/components/home/hero";
import { TunnelTypes } from "@/components/home/tunnel-types";
import { NetworkSection } from "@/components/home/network-section";
import { DdnsSpotlight } from "@/components/home/ddns-spotlight";
import { FairUse } from "@/components/home/fair-use";
import { getHomepageStats } from "@/utils/homepage-stats";

export const revalidate = 60;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const stats = await getHomepageStats();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader user={user} />
      <main className="flex-1">
        <Hero user={user} stats={stats} />
        <TunnelTypes />
        <NetworkSection />
        <DdnsSpotlight user={user} />
        <FairUse />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1180px] flex-col items-start gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-3">
            <FooterLogo href="/" />
            <p className="font-mono text-xs text-muted-foreground">
              © 2026 · made with care by{" "}
              <a
                href="https://kiAntrieb.de"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-primary"
              >
                kiAntrieb.de
              </a>
            </p>
          </div>
          <ThemeSwitcher />
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: clean. If errors, fix them — common likely issue: `User` type import path mismatch in `@supabase/supabase-js` if Supabase version changed; use `createClient`'s return type instead.

- [ ] **Step 3: Build**

```bash
cd frontend && npm run build
```

Expected: success. Build output should show `/` as a dynamic (`ƒ`) route since it reads cookies.

---

## Phase E — Validate and commit

### Task 17: Manual visual validation

**Files:** none (validation only)

- [ ] **Step 1: Start dev server**

```bash
cd frontend && PORT=3100 npm run dev
```

Wait for `Ready in ...`.

- [ ] **Step 2: Walk through the homepage in dark mode**

Open `http://localhost:3100/` in a browser. With theme = dark (default):
- Header has amber dot, mono nav, "Sign in" / "Sign up" or "Dashboard →" buttons.
- Hero: amber eyebrow `// free ipv6 tunneling · norway`, large headline, subhead, two buttons.
- Stats bar: 4 cells. `Active tunnels` shows a real number from Supabase (or `—` if env missing). `AS · 198889`, `BGP sessions · 4`, `Endpoint · Oslo, NO`. RTT tagline below.
- Tunnel types: tabs SIT / GRE / WireGuard. Each shows blurb + 3 facts + code block. Copy button on each code block copies to clipboard (verify).
- Network: huge `AS198889` in amber on a soft amber wash, peer info, prefix list card.
- DDNS: amber `// new` eyebrow, headline, three bullets, "Generate a token →" button, three tabs (curl / ddclient / Fritz!Box) each rendering correctly. Compatible-with chips below.
- Fair use: three cards (limits / blocked ports / abuse) + "No SLA" disclaimer.
- Footer: logo, ©, theme switcher.

- [ ] **Step 3: Toggle to light mode**

Click the theme switcher in the footer, pick `Light`. Verify:
- Background is warm cream, text is deep brown.
- Amber accent shifts to amber-700 (more saturated, readable on cream).
- All cards/borders look right; no broken contrast.
- Code blocks readable (light beige bg, dark text, amber filename).

- [ ] **Step 4: Mobile viewport (Chrome devtools, 375px)**

Verify:
- Header collapses cleanly (logo wordmark mode-toggles via `md:` classes).
- Hero stats grid: 2x2 wrap.
- Tunnel types tabs stack vertically (Radix handles this; check legibility).
- Network section stacks `AS198889` above prefix card.
- DDNS Fritz!Box dl rows wrap without overflow.
- No horizontal scroll anywhere.

- [ ] **Step 5: Auth + dashboard regression**

Click `Sign in` → sign-in page renders with new tokens (warm cream / dark surfaces). Sign in. Land on `/dashboard`. Existing dashboard, tunnel list, DDNS modal, tunnel-config dialog all render and function — no broken layouts, no visually jarring contrast.

- [ ] **Step 6: Stop dev server**

Ctrl-C the dev server.

If any check fails: stop, fix, re-run the relevant check. Do NOT proceed to commit until all checks pass.

### Task 18: Final commit

**Files:** all changes from Phase B–D

- [ ] **Step 1: Inspect git status**

```bash
cd /home/k/tb && git status
```

Expected: shows the deleted `tailwind.config.ts`, modified `package.json`, `package-lock.json`, `postcss.config.js`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`; new `vitest.config.ts`, `utils/homepage-stats.ts`, `utils/homepage-stats.test.ts`, all of `components/home/*`.

Things that must NOT be staged: `CLAUDE.md` at repo root (untracked, user's own file), the modified `.gitignore` (user's earlier edits), `.superpowers/` directory (gitignored or untracked).

- [ ] **Step 2: Stage exactly the redesign + Tailwind v4 files**

```bash
cd /home/k/tb && git add \
  frontend/package.json \
  frontend/package-lock.json \
  frontend/postcss.config.js \
  frontend/vitest.config.ts \
  frontend/app/layout.tsx \
  frontend/app/page.tsx \
  frontend/app/globals.css \
  frontend/utils/homepage-stats.ts \
  frontend/utils/homepage-stats.test.ts \
  frontend/components/home/

# Stage the deletion of the legacy Tailwind config
git rm -f frontend/tailwind.config.ts 2>/dev/null || true
```

- [ ] **Step 3: Commit**

```bash
cd /home/k/tb && git -c user.name='kofany' -c user.email='j@dabrowski.biz' commit -m "$(cat <<'EOF'
feat(frontend): redesign homepage + migrate to Tailwind v4

Homepage:
- New 5-section IA — hero (with live stats bar), tunnel types tabs
  (SIT/GRE/WireGuard with real config previews), network anchored on
  AS198889, DDNS spotlight, fair-use limits — replacing the previous
  generic three-card layout.
- Dev-tool dark identity with amber accent (dark-first, light fallback
  refining the previous cappuccino DNA).
- Stats are honest: active tunnels are live (Supabase admin client,
  null fallback); AS/BGP-sessions/endpoint are documented constants.
- New components/home/* split keeps each section under its own file;
  shadcn primitives untouched, picking up the new look through
  unchanged token names.

Tailwind v3 → v4:
- CSS-first config (@theme inline) replaces tailwind.config.ts.
- @tailwindcss/postcss replaces the old plugin entry.
- tw-animate-css replaces tailwindcss-animate (v4-incompatible).
- lucide-react bumped to 1.x.
- tailwind-merge bumped to 3.x.
- Geist Mono added alongside Geist via next/font/google.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Verify clean status**

```bash
cd /home/k/tb && git status && git log --oneline -3
```

Expected: working tree contains only pre-existing untracked items (CLAUDE.md, .superpowers/, .gitignore mod). The branch shows two new commits: bumps + redesign.

- [ ] **Step 5: Done — surface PR-ready state to operator**

Print the branch name and last two commits. Do not push or open a PR — that's the user's call.

---

## Self-review

**Spec coverage:**

- Goals 1 (homepage replacement) → Tasks 10–16 ✓
- Goals 2 (match shipped reality, drop redundancy) → tunnel-types includes WireGuard, fair-use replaces three-card "Service Information", footer drops "How it works" ✓
- Goals 3 (latest deps + Tailwind v4) → Tasks 1–4 ✓
- Goals 4 (real trust signals) → homepage-stats helper + StatsBar with `null` fallback ✓
- Non-goals (dashboard / auth / backend untouched) → Task 17 step 5 explicitly regression-tests them, plan never edits those paths ✓
- Section detail (header, hero, tunnel-types, network, ddns, fair-use, footer) → Tasks 10–16, one section per task ✓
- Visual system (palette, typography, layout) → Task 4 (CSS) + sections use the tokens ✓
- Stats data sources table → matches `getHomepageStats` impl in Task 7 ✓
- Light theme strategy → Task 4 covers `:root` + `.dark` ✓
- Package upgrade plan (two commits) → Phase A = commit 1, Phase B–E = commit 2 ✓
- `tailwindcss-animate` → `tw-animate-css` swap → Task 2 / Task 4 ✓
- Risks + mitigations → embedded in steps (typecheck after each, manual icon check, regression walk-through) ✓
- Acceptance criteria → Task 17 walkthrough enforces them ✓

**Placeholder scan:** No `TBD`, `TODO`, `implement later`, or "similar to Task N". Every code step includes the actual code.

**Type consistency:** `HomepageStats` shape is consistent — defined in Task 7, consumed unchanged by `Hero` (Task 11) and `StatsBar` (Task 11). Constants from `site-data.ts` (Task 8) are imported by name across Tasks 12–15. `User | null` shape from `@supabase/supabase-js` is consistent across `SiteHeader`, `Hero`, `DdnsSpotlight`.
