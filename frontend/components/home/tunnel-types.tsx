"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "./code-block";
import { SERVER_IPV4, WG_PORT } from "./site-data";

const SIT_SNIPPET = `ip tunnel add tun-XXXX-1 mode sit \\
  remote ${SERVER_IPV4} local <YOUR_IPV4> ttl 255
ip link set tun-XXXX-1 up
ip addr add fde4:5a50:1114::2/64 dev tun-XXXX-1
ip -6 route add 2a05:1083:bef0::/44 dev tun-XXXX-1`;

const GRE_SNIPPET = `ip tunnel add tun-XXXX-1 mode ip6gre \\
  remote 2a03:94e0:ffff:185:243:218:0:164 local <YOUR_IPV6_OR_4> ttl 255
ip link set tun-XXXX-1 up
ip addr add fde4:5a50:1114::2/64 dev tun-XXXX-1
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
