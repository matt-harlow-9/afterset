import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { parseEmbed, formatTimestamp } from "@/lib/embed";
import { addEntry, proposeId, vote, toggleTrack, confirmEntry } from "@/app/actions";

export const dynamic = "force-dynamic";

const statusLabel = {
  UNIDENTIFIED: "ID?",
  PROPOSED: "Unverified",
  VERIFIED: "Verified",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
} as const;

export default async function SetPage({ params }: PageProps<"/sets/[slug]">) {
  const { slug } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  const set = await db.djSet.findUnique({
    where: { slug },
    include: {
      artist: true,
      entries: {
        orderBy: [{ startSec: "asc" }, { position: "asc" }],
        include: {
          votes: userId ? { where: { userId } } : false,
          tracked: userId ? { where: { userId } } : false,
        },
      },
    },
  });
  if (!set) notFound();
  const src = parseEmbed(set.embedUrl).src;
  const isMod = session?.user?.role === "ADMIN" || session?.user?.role === "MODERATOR";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{set.title}</h1>
        <p className="text-muted">{set.artist.name}{set.eventName ? ` · ${set.eventName}` : ""}</p>
      </header>

      {src && (
        <iframe
          src={src}
          title={set.title}
          className="w-full rounded-lg border border-border"
          style={{ height: set.provider === "YOUTUBE" ? 400 : 166 }}
          allow="autoplay; encrypted-media"
          loading="lazy"
        />
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">Tracklist</h2>
        {set.entries.length === 0 && <p className="text-muted">No tracks yet.</p>}
        {set.entries.map((e) => {
          const myVote = e.votes?.[0]?.value ?? 0;
          const tracking = !!e.tracked?.length;
          const open = e.status === "UNIDENTIFIED" || e.status === "REJECTED";
          return (
            <div key={e.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <span className="w-14 font-mono text-sm text-muted">{formatTimestamp(e.startSec)}</span>
                <div className="flex-1">
                  {open ? (
                    <span className="text-muted">ID?</span>
                  ) : (
                    <span>{e.artistName} – {e.title}</span>
                  )}
                  <span className="ml-2 rounded bg-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                    {statusLabel[e.status]}
                  </span>
                </div>
                {e.status === "PROPOSED" && userId && (
                  <div className="flex items-center gap-1 text-sm">
                    <form action={vote.bind(null, e.id, 1)}>
                      <button className={`btn-ghost ${myVote === 1 ? "border-accent text-accent" : ""}`}>▲</button>
                    </form>
                    <span className="w-6 text-center font-mono">{e.score}</span>
                    <form action={vote.bind(null, e.id, -1)}>
                      <button className={`btn-ghost ${myVote === -1 ? "border-accent text-accent" : ""}`}>▼</button>
                    </form>
                  </div>
                )}
                {open && userId && (
                  <form action={toggleTrack.bind(null, e.id)}>
                    <button className={`btn-ghost ${tracking ? "border-accent text-accent" : ""}`}>
                      {tracking ? "Tracking" : "Track ID"}
                    </button>
                  </form>
                )}
                {isMod && e.status === "VERIFIED" && (
                  <form action={confirmEntry.bind(null, e.id)}><button className="btn-ghost">Confirm</button></form>
                )}
              </div>
              {open && userId && (
                <form action={proposeId.bind(null, e.id)} className="mt-2 flex gap-2">
                  <input name="artistName" placeholder="Artist" className="input" required />
                  <input name="title" placeholder="Track title" className="input" required />
                  <button className="btn">Suggest ID</button>
                </form>
              )}
            </div>
          );
        })}
      </section>

      {userId ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">Add a track</h2>
          <form action={addEntry.bind(null, set.id)} className="grid grid-cols-[5rem_1fr_1fr_auto] gap-2">
            <input name="time" placeholder="0:00" className="input font-mono" />
            <input name="artistName" placeholder="Artist (blank = unknown)" className="input" />
            <input name="title" placeholder="Title (blank = unknown)" className="input" />
            <button className="btn">Add</button>
          </form>
          <p className="text-xs text-muted">Leave artist and title empty to flag a moment that needs an ID.</p>
        </section>
      ) : (
        <p className="text-sm text-muted">Log in to add tracks, vote, and track IDs.</p>
      )}
    </div>
  );
}
