import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NewSetForm } from "@/components/new-set-form";

export const metadata = { title: "Add a set" };

export default async function NewSet() {
  if (!(await auth())?.user) redirect("/login");
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Add a set</h1>
      <p className="text-sm text-muted">Paste a SoundCloud, YouTube or Mixcloud link. Audio is embedded, never hosted.</p>
      <NewSetForm />
    </div>
  );
}
