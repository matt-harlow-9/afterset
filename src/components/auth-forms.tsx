"use client";

import { useActionState } from "react";
import { login, signup, magicLink, oauth } from "@/app/actions";

export function PasswordForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : signup, undefined);
  return (
    <form action={action} className="space-y-3">
      {mode === "signup" && <input name="username" placeholder="Username" className="input" required />}
      <input name="email" type="email" placeholder="Email" className="input" required />
      <input name="password" type="password" placeholder="Password" className="input" required />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{mode === "login" ? "Log in" : "Create account"}</button>
    </form>
  );
}

export function MagicLinkForm() {
  const [, action, pending] = useActionState(magicLink, undefined);
  return (
    <form action={action} className="space-y-3">
      <input name="email" type="email" placeholder="Email for a magic link" className="input" required />
      <button className="btn-ghost w-full py-2" disabled={pending}>Email me a sign-in link</button>
    </form>
  );
}

export function OAuthButtons({ google, spotify }: { google: boolean; spotify: boolean }) {
  return (
    <div className="space-y-2">
      {google && (
        <form action={oauth.bind(null, "google")}>
          <button className="btn-ghost w-full py-2">Continue with Google</button>
        </form>
      )}
      {spotify && (
        <form action={oauth.bind(null, "spotify")}>
          <button className="btn-ghost w-full py-2">Continue with Spotify</button>
        </form>
      )}
    </div>
  );
}
