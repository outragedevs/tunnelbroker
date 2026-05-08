import { signUpAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { GitHubAuthButton } from "@/components/github-auth-button";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SmtpMessage } from "../smtp-message";

export default async function Signup(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  if ("message" in searchParams) {
    return (
      <div className="w-full flex-1 flex items-center h-screen sm:max-w-md justify-center gap-2 p-4">
        <FormMessage message={searchParams} />
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Sign up to start using TunnelBroker services
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
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  name="password"
                  placeholder="Your password"
                  minLength={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input name="full_name" placeholder="Your full name" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname (optional)</Label>
                <Input name="nickname" placeholder="Your nickname" />
              </div>

              <SubmitButton
                className="w-full"
                formAction={signUpAction}
                pendingText="Signing up..."
              >
                Sign up with Email
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
            Already have an account?{" "}
            <Link className="text-primary hover:underline font-medium" href="/sign-in">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      <SmtpMessage />
    </>
  );
}
