"use client";

import { createClient } from "@/utils/supabase/client";

function GitHubMark({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .297a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.83.58A12 12 0 0 0 12 .297" />
    </svg>
  );
}

export function GitHubAuthButton() {
  const supabase = createClient();

  const handleGitHubSignIn = async () => {
    console.log('GitHub sign in button clicked');
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('GitHub sign in error:', error);
      } else {
        console.log('GitHub sign in successful, data:', data);

        // W nowszych wersjach Supabase Auth, funkcja nie wykonuje automatycznego przekierowania
        // Musimy ręcznie przekierować użytkownika do URL zwróconego przez Supabase
        if (data?.url) {
          console.log('Redirecting to:', data.url);
          window.location.href = data.url;
        }
      }
    } catch (err) {
      console.error('GitHub sign in exception:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGitHubSignIn}
      className="w-full flex items-center justify-center gap-2 h-10 px-4 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium"
    >
      <GitHubMark size={16} className="mr-2" />
      <span>Continue with GitHub</span>
    </button>
  );
}
