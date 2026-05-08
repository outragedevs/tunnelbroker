import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { StatsBar } from "./stats-bar";

interface HeroProps {
  user: User | null;
}

export function Hero({ user }: HeroProps) {
  return (
    <section
      id="hero"
      className="relative overflow-hidden border-b border-border"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[480px] max-w-[900px] opacity-60 [background:radial-gradient(ellipse_at_top,var(--color-primary-soft),transparent_70%)]" />
      <div className="mx-auto max-w-[1180px] px-6 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
        <div className="mx-auto max-w-[760px] text-center md:mx-0 md:text-left">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
            // free ipv6 tunneling · norway
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-6xl lg:text-7xl">
            IPv6 for the rest of
            <br className="hidden md:inline" /> your IPv4-only world.
          </h1>
          <p className="mt-5 max-w-[560px] text-base text-muted-foreground md:text-lg md:leading-[1.55]">
            SIT, GRE and WireGuard tunnels with BGP-routed /48s. Free,
            dual-stack, dyndns2-ready.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center md:justify-start">
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
        <StatsBar />
      </div>
    </section>
  );
}
