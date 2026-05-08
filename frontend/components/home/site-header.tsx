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
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6 md:px-8">
        <Logo href="/" />
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
