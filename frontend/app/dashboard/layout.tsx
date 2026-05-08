import { ThemeSwitcher } from "@/components/theme-switcher";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../actions";
import Logo from "@/components/logo";
import FooterLogo from "@/components/footer-logo";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Get user metadata
  const userData = user.user_metadata;
  const displayName = userData?.nickname || userData?.full_name || user.email;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex justify-between items-center py-4">
          <div className="flex items-center gap-4">
            <Logo href="/dashboard" />
            <span className="text-sm text-muted-foreground">
              Welcome, {displayName}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <nav className="space-y-2">
              <Button
                asChild
                variant="ghost"
                className="w-full justify-start"
              >
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="w-full justify-start"
              >
                <Link href="/dashboard/tunnels">Tunnels</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="w-full justify-start"
              >
                <Link href="/dashboard/account">Account</Link>
              </Button>
            </nav>
          </div>

          {/* Content */}
          <div className="md:col-span-3">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-4">
            <FooterLogo href="/" />
            <p className="text-xs">© 2025 - Made with ❤️ by <a href="https://kiAntrieb.de" target="_blank" rel="noopener noreferrer" className="hover:underline">kiAntrieb.de</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
