import { createClient } from "@/utils/supabase/server";
import FooterLogo from "@/components/footer-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SiteHeader } from "@/components/home/site-header";
import { Hero } from "@/components/home/hero";
import { TunnelTypes } from "@/components/home/tunnel-types";
import { NetworkSection } from "@/components/home/network-section";
import { DdnsSpotlight } from "@/components/home/ddns-spotlight";
import { FairUse } from "@/components/home/fair-use";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader user={user} />
      <main className="flex-1">
        <Hero user={user} />
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
