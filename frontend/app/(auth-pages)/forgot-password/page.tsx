import { forgotPasswordAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SmtpMessage } from "../smtp-message";

export default async function ForgotPassword(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  return (
    <>
      <form className="w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Enter your email to receive a password reset link
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input name="email" placeholder="you@example.com" required />
          </div>

          <SubmitButton
            className="w-full"
            formAction={forgotPasswordAction}
          >
            Reset Password
          </SubmitButton>

          <FormMessage message={searchParams} />

          <p className="text-sm text-center text-muted-foreground mt-6">
            Remember your password?{" "}
            <Link className="text-primary hover:underline font-medium" href="/sign-in">
              Sign in
            </Link>
          </p>
        </div>
      </form>
      <SmtpMessage />
    </>
  );
}
