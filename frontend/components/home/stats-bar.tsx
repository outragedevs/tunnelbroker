import {
  AS_NUMBER,
  BGP_SESSIONS,
  ENDPOINT_LOCATION,
  RTT_OSLO_IX,
} from "./site-data";

const CELLS = [
  { label: "AS", value: AS_NUMBER.toString() },
  { label: "BGP sessions", value: BGP_SESSIONS.toString() },
  { label: "Endpoint", value: ENDPOINT_LOCATION },
] as const;

export function StatsBar() {
  return (
    <div className="mt-12">
      <div className="grid grid-cols-3 gap-x-2 gap-y-4 border-t border-border pt-5 md:divide-x md:divide-border">
        {CELLS.map((cell) => (
          <div
            key={cell.label}
            className="px-2 first:pl-0 last:pr-0 md:px-6"
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
