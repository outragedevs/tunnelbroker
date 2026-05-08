import { ThemeSwitcher } from "@/components/theme-switcher";
import Logo from "@/components/logo";
import FooterLogo from "@/components/footer-logo";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex justify-between items-center py-4">
          <div className="flex items-center gap-4">
            <Logo href="/" />
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto py-12 flex justify-center items-center">
        <div className="w-full max-w-md p-6 bg-card rounded-lg shadow-sm border">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-auto">
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
