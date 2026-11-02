"use client";

import { useActionState } from "react";
import { createSet } from "@/app/actions";

export function NewSetForm() {
  const [state, action, pending] = useActionState(createSet, undefined);
  return (
    <form action={action} className="space-y-3">
      <input name="artist" placeholder="Artist / DJ" className="input" required />
      <input name="title" placeholder="Set title" className="input" required />
      <input name="eventName" placeholder="Event / festival / show (optional)" className="input" />
      <input name="embedUrl" type="url" placeholder="https://soundcloud.com/…" className="input" required />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button className="btn" disabled={pending}>Create set</button>
    </form>
  );
}
