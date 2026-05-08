# Frontend refresh — homepage redesign + dependency upgrade

**Date:** 2026-05-07
**Author:** k (with Claude)
**Scope:** `frontend/` only — homepage `/` redesign + full dependency upgrade including Tailwind v3 → v4 migration. Backend untouched. Auth pages, dashboard pages, and existing dyndns/tunnel components remain on the current shadcn baseline (visual system upgraded, copy/structure unchanged).

## 1. Goals

1. Replace the current "AI-template-y" homepage with a deliberate dev-tool dark identity (dark-first, light fallback) that signals the service is run by network engineers.
2. Bring the page in line with what we actually ship today — including WireGuard support, BGP routing, DDNS, real port restrictions — and remove redundancy.
3. Move every frontend dependency to the latest stable, including Tailwind v4 migration, without breaking auth/dashboard.
4. Add real, verifiable trust signals (live tunnel count, AS, peering) — no fabricated numbers.

## 2. Non-goals

- Dashboard / auth / form pages — they keep the current shadcn skeleton. The new design tokens roll through globally so they pick up the new look automatically; any component-level cleanup happens in a follow-up.
- Backend API (`tunnelbroker.service`).
- Logo SVG redesign — current `public/images/logo.svg` stays, only the accent dot/treatment around it changes.
- Marketing copy beyond the homepage (no blog, no docs site, no testimonials).
- Comparison content vs other tunnel brokers (Hurricane Electric etc.) — out of scope.

## 3. Information architecture

Five content sections + header + footer.

| # | Section | Purpose |
|---|---------|---------|
|   | **Header** | Logo (with amber dot), thin nav (Network, Status, Sign in / Dashboard), `ThemeSwitcher` |
| 1 | **Hero** | Headline, subhead, two CTAs, live stats bar (4 cells) |
| 2 | **Tunnel types** | Tabs for SIT / GRE / WireGuard, each with description, key facts, and a real config snippet |
| 3 | **Network** | AS198889 anchor, prefix pool list, peering details, looking-glass link |
| 4 | **DDNS spotlight** | The recently shipped feature — copy-pasteable curl one-liner + compatible-clients grid |
| 5 | **Fair use & limits** | 50 Mbit/s, 2 tunnels/user, blocked mail ports, rate limits, abuse policy |
|   | **Footer** | Logo, copyright, kiAntrieb.de credit, theme switcher (moves from header) |

Removed from the current page: standalone "How It Works" 1-2-3 section (redundant with the CTAs and "What you get"), three-card "Service Information" block (folded into hero subhead + Fair use), separate `What You Get` block (split into Tunnel types + Network + DDNS spotlight + a small bandwidth callout in Fair use).

## 4. Visual system

### 4.1 Palette tokens

Defined in `app/globals.css` via Tailwind v4's `@theme` block. Light tokens under `:root`, dark tokens under `.dark` (so `next-themes` class-strategy keeps working).

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `--color-bg-base` | `#0b0d10` | `#faf8f4` | Page background |
| `--color-bg-elevated` | `#0e1116` | `#fdfbf8` | Section panels, hover surfaces |
| `--color-bg-muted` | `#161b22` | `#f3eee5` | Code blocks, secondary surfaces |
| `--color-border` | `#1f2428` | `#e8e1d3` | Subtle dividers |
| `--color-border-strong` | `#30363d` | `#cfc4ad` | Visible borders, card outlines |
| `--color-fg-base` | `#e6edf3` | `#1d1714` | Primary text |
| `--color-fg-muted` | `#7d8590` | `#5b4a36` | Secondary text, labels |
| `--color-fg-subtle` | `#484f58` | `#8a7960` | Tertiary text |
| `--color-accent` | `#f59e0b` (amber-500) | `#b45309` (amber-700) | Identity color — logo dot, eyebrow, CTA bg, link hover |
| `--color-accent-fg` | `#0b0d10` | `#faf8f4` | Text on top of `accent` |
| `--color-accent-soft` | `#f59e0b14` (8% alpha) | `#b4530914` | Faint amber wash for highlighted blocks |
| `--color-success` | `#7ee787` | `#15803d` | "good", BGP up, status dot |
| `--color-danger` | `#ff7b72` | `#b91c1c` | Destructive actions, errors |

Light mode keeps the current cappuccino DNA but sharpened — the warm cream/brown family stays, the accent shifts to amber-700 for AA contrast on cream.

### 4.2 Typography

- **Sans:** Geist (already loaded in `app/layout.tsx` via `next/font/google`). Used for body, headings, labels.
- **Mono:** Geist Mono (same family, free, also via `next/font/google`). Used for eyebrow labels, stats numerals, code, IPv6 prefixes.
- Tabular numerals (`font-variant-numeric: tabular-nums`) on stats and code.

| Role | Tailwind class | Notes |
|------|----------------|-------|
| Hero h1 | `text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight` | -0.02em tracking |
| Section h2 | `text-3xl md:text-4xl font-semibold tracking-tight` | -0.018em |
| Card h3 | `text-lg md:text-xl font-semibold` | |
| Body | `text-[15px] md:text-base leading-[1.65]` | |
| Eyebrow | `text-xs font-mono uppercase tracking-[0.18em] text-accent` | |
| Code / snippet | `text-sm font-mono leading-[1.55]` | |

### 4.3 Layout

- **Container:** new `max-w-[1180px] mx-auto px-6 md:px-8` utility — tighter than current default Tailwind container. Define once as a component class or inline pattern (no `container` plugin).
- **Section vertical rhythm:** `py-20 md:py-28` (sections), hero gets `pt-16 md:pt-24 pb-20 md:pb-28`.
- **Card radius:** 8px (`rounded-lg` in Tailwind 4).
- **Card surface:** dark — `bg-bg-elevated` + 1px `border-border-strong`, no shadow. light — `bg-bg-elevated` + 1px `border-border` + `shadow-sm`.
- **Grid base:** 4px Tailwind default.

### 4.4 Interaction

- Transitions: 120ms on `background-color`, `border-color`, `color`. No `transform`, `scale`, parallax, or scroll-triggered effects.
- Card hover: border shifts to `border-strong` + `bg-bg-elevated/80`.
- Focus ring: `focus-visible:ring-2 ring-accent ring-offset-2 ring-offset-bg-base outline-none`.
- Tabs (Radix): no built-in slide, just opacity 120ms.
- `prefers-reduced-motion: reduce` → no transitions on anything.

## 5. Section detail

### 5.1 Header

Sticky-not-sticky. 64px tall, transparent background that solidifies on scroll past 24px (`bg-bg-base/85 backdrop-blur` after threshold via a tiny client component).

- Left: `<Logo>` with new amber dot ornament next to wordmark — re-export current SVG, overlay a 6px filled circle in `--color-accent` to the left.
- Center (desktop only): `<a href="#network">Network</a>` · `<a href="https://lg.gigahost.no" target="_blank">Status ↗</a>` · `<a href="#ddns">DDNS</a>` — small mono links.
- Right: signed-out → `Sign in` ghost button + `Sign up` solid (amber) button. Signed-in → `Dashboard →` solid button.
- Theme switcher moves to the footer to declutter (mobile-friendly).

### 5.2 Hero (`section#hero`)

Layout: centered text, `max-w-[760px] mx-auto`, single column.

- Eyebrow: `// free ipv6 tunneling · norway` — mono, amber, uppercase, 0.18em tracking.
- h1: **"IPv6 for the rest of your IPv4-only world."** — three lines on desktop using `<br>` after "rest of" and "your IPv4-only".
- Subhead: "SIT, GRE and WireGuard tunnels with BGP-routed /48s. Free, dual-stack, dyndns2-ready." — `text-fg-muted`, max-width 520px.
- CTAs (gap-3, flex):
  - Primary: `Get a tunnel →` — amber bg, dark text, links to `/sign-up` (or `/dashboard` if `user`)
  - Secondary: `View status` — outline, links to `#network` (anchor scroll)
- Stats bar: 4-column grid below CTAs, separated by 1px vertical dividers, mono tabular numerals. No status dots or other "live" decorations — every cell is either a real live count (Active tunnels) or a static documented fact. Tagline `~3 ms RTT to Oslo IX` rendered as small fg-subtle text below the bar.

#### 5.2.1 Stats data sources

| Cell | Source | Notes |
|------|--------|-------|
| Active tunnels | Live from backend `GET /api/v1/tunnels` (admin auth) → `length` | Server-rendered (page is async server component already). 60s `revalidate`. Fallback: render `—` if backend unreachable. |
| AS · 198889 | Static constant | |
| BGP sessions · 4 | Static constant `4` | We do not poll vtysh from frontend. "4 sessions established" is a documented fact (the BGP design — see CLAUDE.md §2). No live status dot — that would imply real-time monitoring we don't have. |
| Endpoint · Oslo, NO | Static constant | |

A new helper `utils/homepage-stats.ts` exposes `getHomepageStats()` that calls `getBackendApiClient().listTunnels()` and returns `{ activeTunnels: number | null, asNumber: 198889, bgpSessions: 4, endpoint: "Oslo, NO" }`. The `null` fallback renders as `—`.

**Out of scope:** real BGP session polling. If we ever want it live, it's a backend endpoint shelled out to `vtysh -c 'show bgp summary'`. Tracked separately.

### 5.3 Tunnel types (`section#tunnels`)

Heading h2: **"Three ways to tunnel."** Subhead: "Pick whichever your router speaks. All three give you the same prefixes."

Radix `Tabs` component (already in `components/ui/tabs.tsx`). Three tabs: SIT · GRE · WireGuard. Tab triggers in a horizontal mono pill row.

Each tab pane is a 2-column grid (`md:grid-cols-[1.1fr_1fr]`):

**Left column** (description):
- Short paragraph (2-3 sentences) describing the tunnel type and when to pick it.
- 3-line key-fact list, mono small:
  - kernel module / userspace
  - default MTU
  - dual-prefix support (SIT/GRE: yes — `-1` and `-2` interfaces; WG: peer-driven)

**Right column** (config preview):
- Code panel — `bg-bg-muted`, `border-border-strong`, `rounded-lg`, mono. Heading bar with file name (e.g. `~/wg0.conf`, `setup.sh`).
- Real, copy-pasteable config snippet. Amber syntax highlight on dynamic values (endpoint, prefixes, ports). Green for "good" state markers.
- A small `Copy` button top-right that copies the snippet to clipboard.

**Snippet content per tab** (illustrative — exact values pulled from `backend/internal/tunnels/handler.go` and existing scripts):

- **SIT:**
  ```
  ip tunnel add tun-XXX-1 mode sit \
    remote 185.243.218.164 local <YOUR_IPV4> ttl 255
  ip link set tun-XXX-1 up
  ip addr add fd00:beef:cafe::2/64 dev tun-XXX-1
  ip -6 route add 2a05:1083:bef0::/44 dev tun-XXX-1
  ```
- **GRE:** equivalent `ip tunnel ... mode ip6gre`.
- **WireGuard:** `[Interface]` + `[Peer]` block with our endpoint and one of the user's prefixes.

These are illustrative — the dashboard already shows the user-specific exact config in `tunnel-config-dialog.tsx`. The homepage just shows a representative shape.

### 5.4 Network (`section#network`)

Heading h2: **"Anchored in Oslo."** Subhead: "Our own AS, peered with Gigahost, with five /44 pools to delegate from."

Layout: 2-column grid (`md:grid-cols-[1.4fr_1fr]`):

**Left:**
- Massive mono display: `AS198889` — `text-6xl md:text-7xl font-mono`, accent-soft amber wash background, 8px padding. The visual anchor of the section.
- Peer info below: "→ peered with **AS56655** (Gigahost) · 4 BGP sessions established · imports default-only".
- External link to https://lg.gigahost.no labeled `Looking glass ↗`.

**Right:**
- Card listing all five prefix pools as a mono list with a one-line role next to each:
  ```
  2a05:1083:bef0::/44   primary delegation
  2a12:bec0:02c0::/44   secondary delegation
  2a05:1083:bee0::/44   primary (alt)
  2a05:dfc1:3c10::/44   secondary (alt)
  2a03:94e0:2496::/48   non-BGP local
  ```
- Note: "Each tunnel gets two /64s from the primary pools plus a /64 from a tertiary."

### 5.5 DDNS spotlight (`section#ddns`)

Heading h2: **"Dynamic DNS, no dashboard required."** Eyebrow: `// new`.

Layout: full-width section with a 2-column grid inside:

**Left:** copy block.
- 3-line paragraph: dynamic IPv4 → token → dyndns2 endpoint, runs from any router or script.
- Bullet list of three concrete things: per-tunnel token (rotateable), bcrypt-hashed in DB, rate-limited.
- CTA: `Generate a token →` linking to `/dashboard` (or `/sign-up` if signed out, with redirect param).

**Right:** code preview tabs — same Radix Tabs as tunnel types, smaller. Three tabs: `curl`, `ddclient`, `Fritz!Box`.

- **curl tab:**
  ```
  curl -u tun-XXXX-1:ddns_xxxxx... \
    "https://tb.tahio.eu/nic/update?myip=$(curl -4s ifconfig.me)"
  ```
- **ddclient tab:**
  ```
  protocol=dyndns2
  use=web, web=ifconfig.me
  server=tb.tahio.eu
  ssl=yes
  login=tun-XXXX-1
  password='ddns_xxxxx...'
  tun-XXXX-1
  ```
- **Fritz!Box tab:** four labeled rows showing the GUI field values:
  - Update URL: `https://<username>:<pass>@tb.tahio.eu/nic/update?hostname=<domain>&myip=<ipaddr>`
  - Domain: `tun-XXXX-1`
  - User: `tun-XXXX-1`
  - Password: `ddns_xxxxx...`

Below the card, a horizontal row of small "Compatible with" chips: Fritz!Box · MikroTik · OpenWrt · ASUS Merlin · OPNsense · pfSense · ddclient · inadyn · curl. Each chip is a non-clickable badge in mono small.

### 5.6 Fair use & limits (`section#fair-use`)

Heading h2: **"Free isn't unlimited."** Subhead: "Limits exist so the service stays available for everyone."

Three-card grid (`md:grid-cols-3`):

1. **Per-tunnel limits**
   - 50 Mbit/s up + down, shaped at the kernel
   - 2 tunnels per account
   - SIT/GRE: dual-prefix delegation; WireGuard: single

2. **Blocked ports** (anti-spam)
   - Outbound + inbound mono list:
     `25 · 465 · 587 · 2525` (SMTP) and `110 · 143 · 993 · 995` (POP3/IMAP)
   - One-line: "We don't run mail and we won't relay yours."

3. **Abuse**
   - Plain language: spam, scanning, illegal traffic, DDoS reflection — instant termination, no warning.
   - SYN-flood + ICMP rate limits applied per-tunnel automatically.

Below grid, small fg-subtle disclaimer, single line: **"No SLA. We run this because it should exist. — kiAntrieb.de"**

### 5.7 Footer

- Container, top border-strong, `py-10`.
- Left: `<FooterLogo>` + © 2026 kiAntrieb.de
- Right: `<ThemeSwitcher />` + small mono links: `Privacy` (placeholder, can stay broken until we have a page) · `Source` (link to the repo if we want to expose it — defer).

For now: just FooterLogo + copyright (current) + ThemeSwitcher. Privacy/Source links can be added later.

## 6. Component changes

### New files

- `components/home/hero.tsx` — server component, accepts `user`, `stats`. Renders eyebrow/h1/subhead/CTAs/StatsBar.
- `components/home/stats-bar.tsx` — pure presentational, `{ activeTunnels, asNumber, bgpSessions, endpoint }`.
- `components/home/tunnel-types.tsx` — client component (uses Radix Tabs); imports `code-block` for snippets.
- `components/home/network-section.tsx` — server component.
- `components/home/ddns-spotlight.tsx` — client (Tabs), reuses code-block.
- `components/home/fair-use.tsx` — server.
- `components/home/site-header.tsx` — client (scroll listener for backdrop), used only on `/`.
- `components/home/code-block.tsx` — wraps a `<pre>` with a copy button (uses `navigator.clipboard.writeText`).
- `components/home/copy-button.tsx` — separate to keep `code-block` server-friendly when no copy is needed.
- `utils/homepage-stats.ts` — `getHomepageStats()` server helper that calls the backend API client.

### Modified files

- `app/page.tsx` — replaced almost entirely. Top-level `Home` async server component composes the new sections.
- `app/layout.tsx` — add `Geist_Mono` import alongside `Geist`; expose both as CSS variables `--font-geist`, `--font-geist-mono`. Body class uses `font-sans`.
- `app/globals.css` — full rewrite. New `@import "tailwindcss"` directive + `@theme` block + `@variant dark` for theme. Drop the HSL `--background` system.
- `tailwind.config.ts` — **deleted**. Tailwind v4 replaces config-as-TS with config-as-CSS. Anything we still need (content paths, plugins) is set via CSS or auto-detected.
- `postcss.config.js` — replace `tailwindcss: {}` with `'@tailwindcss/postcss': {}`. Keep `autoprefixer`.
- `components/logo.tsx` — keep, but optionally add an amber dot prop or render an inline `<span>` next to it. Decision: simplest is a sibling element in `site-header.tsx`, leave `Logo` alone.
- `components/footer-logo.tsx` — same; leave alone, render normally in footer.
- `components/ui/button.tsx` — update variant tokens (`bg-primary` → `bg-accent` etc.) to use new token names. Same API.
- `components/ui/card.tsx` — same.
- `components/ui/dialog.tsx`, `dropdown-menu.tsx`, `tabs.tsx`, `input.tsx`, `label.tsx`, `checkbox.tsx`, `badge.tsx` — token rename pass.

### Untouched

- All `app/dashboard/**` files
- All `app/(auth-pages)/**` files
- `app/api/**` route handlers
- `app/nic/update/route.ts` and DDNS API routes
- `components/dyndns-*.tsx`, `tunnel-*.tsx`, `header-auth.tsx`, `submit-button.tsx`, `form-message.tsx`, `password-input.tsx`, `key-field.tsx`, `github-auth-button.tsx`, `theme-switcher.tsx`
- `utils/dyndns.ts`, all backend integration code
- All migrations and Supabase schemas

## 7. Package upgrade plan

Done in **two commits** to keep the diff reviewable: (a) plain bumps; (b) Tailwind v4 + redesign.

### 7.0 Tailwind 4 compatibility note

`tailwindcss-animate` is **incompatible** with Tailwind v4 (it relies on the v3 plugin API and on utilities the upgrade tool drops). The community migration path is `tw-animate-css` — drop-in replacement that ships the same `accordion-up/down`, `animate-in/out`, etc. utilities Radix expects. Replacement happens in commit 2 alongside the Tailwind v4 bump.

### 7.1 Bump batch (commit 1)

Order driven by build-graph dependencies:

```
typescript           5.7.2  → 6.0.3       major
@types/node         22.10.2 → 25.6.0      major
@types/react        ^19.0.2 → ^19.2.14    minor
@types/react-dom    19.0.2  → 19.2.3      minor
@types/bcryptjs     ^2.4.6  → ^3.0.0      major
react               19.0.0  → 19.2.6      minor
react-dom           19.0.0  → 19.2.6      minor
next                ^16.0.8 → ^16.2.5     minor
postcss             8.4.49  → 8.5.14      minor
autoprefixer        10.4.20 → 10.5.0      minor
prettier            ^3.3.3  → ^3.8.3      minor
next-themes         ^0.4.3  → ^0.4.6      patch
class-variance-…    ^0.7.0  → ^0.7.1      patch
@radix-ui/* (all)   →latest                minor/patch
```

**Validation gate after commit 1:**
- `npm ci && npm run build` passes
- `tsc --noEmit` clean
- Visual smoke in dev: homepage renders, sign-in flow works, dashboard tunnel cards render, DDNS modal opens

Risk hotspots:
- **TypeScript 6** — may surface latent strict-mode issues. Mitigation: fix on the spot, no `// @ts-ignore` shortcuts.
- **@types/bcryptjs 3** — minor type signature changes on `hash`/`compare`. Search/fix.
- **lucide-react** is in batch (b), see below.

### 7.2 Tailwind v4 + redesign (commit 2)

Done after commit 1 lands clean. Steps:

1. Bump `tailwindcss 3.4.17 → 4.2.4`. Add `@tailwindcss/postcss` (new). Bump `tailwind-merge 2.5.2 → 3.5.0`. **Remove `tailwindcss-animate`, install `tw-animate-css`** and add a single `@import "tw-animate-css"` line to `app/globals.css` (keeps Radix open/close animations working).
2. Bump `lucide-react 0.468.0 → 1.14.0`. Verify icon imports — sweep `import { ... } from 'lucide-react'` and check renames at https://lucide.dev/changelog. Likely affected: none used here but `Sun`/`Moon`/`Laptop` are stable. If anything renamed: fix.
3. Migrate config:
   - Delete `tailwind.config.ts`.
   - Rewrite `app/globals.css` with `@import "tailwindcss"` + `@theme` + dark variant.
   - Update `postcss.config.js` to `@tailwindcss/postcss`.
   - Run the official codemod `npx @tailwindcss/upgrade@latest` first as a baseline, then hand-tune.
4. Rename utility classes that changed in v4:
   - `shadow-sm` → `shadow-xs` (per v4 scale shift). Search/replace.
   - Default `border-` color is no longer `gray-200`; explicit color required everywhere we relied on default.
   - `outline-none` semantics — sweep.
5. Rewrite `app/page.tsx` using new `components/home/*`.
6. Add `Geist_Mono` font in `app/layout.tsx`.
7. Token rename in `components/ui/*` (button, card, dialog, dropdown-menu, tabs, input, label, checkbox, badge): swap HSL CSS vars (`bg-primary`, `text-primary-foreground`, etc.) for new token names (`bg-accent`, `text-accent-foreground`, etc.). Auth/dashboard automatically picks up the new colors via these primitives.

**Validation gate after commit 2:**
- `npm ci && npm run build` passes (no Tailwind warnings)
- `tsc --noEmit` clean
- Manual checks in dev (`PORT=3100 npm run dev`):
  - `/` — all five sections render in dark, in light, and after theme toggle
  - Hero stats: shows real number when backend is up, `—` when not
  - Tunnel types: all three tabs switch, copy button works
  - DDNS section: tabs switch, copy works
  - `/sign-in`, `/sign-up`, `/dashboard`, tunnel create/list, DDNS modal — all still functional and visually consistent (token rename did not break anything)
  - Mobile (375px viewport): hero, stats bar wraps to 2x2, all sections readable, no horizontal scroll
  - Reduced-motion: animations disabled
- Lighthouse on `/`: Performance ≥ 90, A11y ≥ 95.

## 8. Light theme strategy

`next-themes` already class-strategy. Keep `.dark` selector. Tailwind v4 supports `@variant dark (&:where(.dark, .dark *))` to map.

- All tokens have a light counterpart (table 4.1).
- Hero in light: cream background, deep brown headline, amber-700 accent. Code blocks: `bg-bg-muted` (warm beige) with amber-700 keywords, success green `#15803d`.
- Background gradient (subtle radial behind hero in dark) becomes a flat warm cream in light — no gradient.
- All color usage goes through tokens, no hard-coded hex outside `globals.css`.

## 9. Stats integrity

Reiterating the no-fabrication rule:

- Active tunnels: live, with graceful fallback to `—`.
- AS, BGP sessions, endpoint: documented facts — hard-coded constants, never made up.
- We do **not** display "uptime %", "users worldwide", "MB transferred", or any number we can't back up. If we want any of these later, we instrument first.

## 10. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Tailwind v4 codemod breaks shadcn primitives | Run codemod on a branch, build, fix every warning by hand. Keep commit 2 separate from commit 1. |
| TypeScript 6 surfaces latent issues | Run `tsc --noEmit` on every step; fix at root, no `@ts-ignore`. |
| lucide-react 1.x icon rename breaks an import | Grep imports, cross-check against changelog. We use `Sun`, `Moon`, `Laptop`, `Loader2`, etc. — all unchanged historically, but verify. |
| `@tailwindcss/postcss` not happy with Next 16 | Documented combination per Next 16 docs. If broken, fall back to `@tailwindcss/cli` or downgrade to v4.0.x. |
| Dashboard pages break due to token rename | Token rename is one-way and mechanical. Every changed primitive is exercised in the validation walk-through (DDNS modal, tunnel form, sign-in). |
| Geist Mono adds bundle weight | Both fonts via `next/font` are subsetted to `latin`. Combined adds ~20–25 KB. Acceptable for a dev tool homepage. |
| Sticky-with-blur header janks on scroll | Use `position: sticky` + `backdrop-filter` only above scroll threshold. If perf is bad, drop to a simple solid header. |

## 11. Out of scope (explicit)

- Status page (separate `/status` route with live BGP / health metrics)
- Live BGP polling endpoint in the backend
- Looking-glass embed (just link out to `lg.gigahost.no`)
- i18n / Polish translation (UI stays English per project rules)
- Logo SVG redesign
- New marketing illustrations or photos
- Animation-heavy hero (Vercel-style canvas / shaders / WebGL)
- Cookie banner / consent (we don't set tracking cookies)
- Analytics integration

## 12. Acceptance

The redesign is done when:

1. `frontend/package.json` shows every package at the latest stable as of 2026-05-07 except where pinned by a spec'd workaround.
2. `npm ci && npm run build` is clean. No Tailwind warnings, no TS errors.
3. Homepage `/` renders the five new sections + new header + footer in both themes, mobile and desktop.
4. Auth pages, dashboard, tunnel CRUD, DDNS modal all still function and look visually consistent with the new tokens (no jarring contrast or broken layout).
5. The two commits are reviewable independently — bumps in one, design + Tailwind v4 in the other.
