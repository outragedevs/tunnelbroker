import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { GitHubAuthButton } from "@/components/github-auth-button";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function Login(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  return (
    <div className="w-full">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Sign in to TunnelBroker</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Enter your credentials to access your account
        </p>
      </div>

      <div className="space-y-4">
        <form>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input name="email" placeholder="you@example.com" required />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                <Link
                  className="text-xs text-primary hover:underline"
                  href="/forgot-password"
                >
                  Forgot Password?
                </Link>
              </div>
              <PasswordInput
                name="password"
                placeholder="Your password"
                required
                showRequirements={false}
              />
            </div>

            <SubmitButton
              className="w-full"
              pendingText="Signing In..."
              formAction={signInAction}
            >
              Sign in with Email
            </SubmitButton>

            <FormMessage message={searchParams} />
          </div>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <GitHubAuthButton />

        <p className="text-sm text-center text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link className="text-primary hover:underline font-medium" href="/sign-up">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
