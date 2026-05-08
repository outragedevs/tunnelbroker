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
          Free isn&apos;t unlimited.
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
