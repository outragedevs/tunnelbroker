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
