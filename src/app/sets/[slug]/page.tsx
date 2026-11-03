import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { parseEmbed } from "@/lib/embed";
import { PlayerProvider, SetPlayer, Timecode, NowMarker, AddEntryForm } from "@/components/player";
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

  const timeline = set.entries.map((e) => ({
    id: e.id,
    startSec: e.startSec,
    status: e.status,
    label: e.title ? `${e.artistName} – ${e.title}` : "ID?",
  }));
  const starts = [...new Set(set.entries.map((e) => e.startSec).filter((v): v is number => v != null))].sort((a, b) => a - b);
  const nextStart = (s: number | null) => (s == null ? null : (starts.find((v) => v > s) ?? null));

  return (
    <PlayerProvider>
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{set.title}</h1>
        <p className="text-muted">{set.artist.name}{set.eventName ? ` · ${set.eventName}` : ""}</p>
      </header>

      {src && <SetPlayer provider={set.provider} src={src} title={set.title} entries={timeline} />}

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
                <Timecode sec={e.startSec} />
                <NowMarker start={e.startSec} end={nextStart(e.startSec)} />
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
          <AddEntryForm action={addEntry.bind(null, set.id)} />
        </section>
      ) : (
        <p className="text-sm text-muted">Log in to add tracks, vote, and track IDs.</p>
      )}
    </div>
    </PlayerProvider>
  );
}
