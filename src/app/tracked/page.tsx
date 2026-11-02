import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { formatTimestamp } from "@/lib/embed";

export const metadata = { title: "Tracked IDs" };
export const dynamic = "force-dynamic";

export default async function Tracked() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const rows = await db.trackedEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { entry: { include: { set: { include: { artist: true } } } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tracked IDs</h1>
      {rows.length === 0 && <p className="text-muted">Nothing tracked yet. Hit “Track ID” on any unidentified track.</p>}
      {rows.map(({ entry }) => (
        <Link key={entry.id} href={`/sets/${entry.set.slug}`} className="block rounded-lg border border-border bg-card p-4 hover:border-accent">
          <div className="font-medium">
            {entry.title ? `${entry.artistName} – ${entry.title}` : "Still unidentified"}
          </div>
          <div className="text-sm text-muted">
            {entry.set.artist.name} · {entry.set.title} · {formatTimestamp(entry.startSec)}
          </div>
        </Link>
      ))}
    </div>
  );
}
