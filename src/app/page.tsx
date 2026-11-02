import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sets = await db.djSet.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { artist: true, _count: { select: { entries: true } } },
  });
  const unidentified = await db.tracklistEntry.groupBy({
    by: ["setId"],
    where: { status: "UNIDENTIFIED" },
    _count: true,
  });
  const gaps = new Map(unidentified.map((u) => [u.setId, u._count]));

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Find the track. Skip the rewind.</h1>
        <p className="mt-2 text-muted">
          Community tracklists for DJ sets. Track an unknown ID and get emailed the moment it&apos;s found.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">Latest sets</h2>
        {sets.length === 0 && (
          <p className="text-muted">
            No sets yet. <Link href="/sets/new" className="text-accent">Add the first one</Link>.
          </p>
        )}
        {sets.map((s) => (
          <Link key={s.id} href={`/sets/${s.slug}`} className="block rounded-lg border border-border bg-card p-4 hover:border-accent">
            <div className="font-medium">{s.title}</div>
            <div className="text-sm text-muted">
              {s.artist.name}{s.eventName ? ` · ${s.eventName}` : ""} · {s._count.entries} tracks
              {gaps.get(s.id) ? ` · ${gaps.get(s.id)} to ID` : ""}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
