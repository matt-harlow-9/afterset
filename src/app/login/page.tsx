import Link from "next/link";
import { enabledProviders } from "@/auth";
import { MagicLinkForm, OAuthButtons, PasswordForm } from "@/components/auth-forms";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <PasswordForm mode="login" />
      {enabledProviders.magicLink && <MagicLinkForm />}
      <OAuthButtons google={enabledProviders.google} spotify={enabledProviders.spotify} />
      <p className="text-sm text-muted">
        No account? <Link href="/signup" className="text-accent">Sign up</Link>
      </p>
    </div>
  );
}
