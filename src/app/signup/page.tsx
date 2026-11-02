import Link from "next/link";
import { enabledProviders } from "@/auth";
import { OAuthButtons, PasswordForm } from "@/components/auth-forms";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <PasswordForm mode="signup" />
      <OAuthButtons google={enabledProviders.google} spotify={enabledProviders.spotify} />
      <p className="text-sm text-muted">
        Already have one? <Link href="/login" className="text-accent">Log in</Link>
      </p>
    </div>
  );
}
