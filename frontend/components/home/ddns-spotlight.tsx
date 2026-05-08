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
  user: User | null;
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

        <div className="mt-10 flex flex-wrap items-center gap-2">
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
