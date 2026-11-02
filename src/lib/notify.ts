import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const base = process.env.AUTH_URL ?? "http://localhost:3000";

/** Email everyone tracking this entry that it has been identified. Idempotent via notifiedAt. */
export async function notifyEntryIdentified(entryId: string) {
  const entry = await db.tracklistEntry.findUnique({
    where: { id: entryId },
    include: {
      set: { include: { artist: true } },
      tracked: { where: { notifiedAt: null }, include: { user: true } },
    },
  });
  if (!entry) return;
  const trackName = [entry.artistName, entry.title].filter(Boolean).join(" - ");
  const url = `${base}/sets/${entry.set.slug}`;
  for (const t of entry.tracked) {
    if (t.user.email) {
      await sendEmail(
        t.user.email,
        `ID found: ${trackName}`,
        `<p>A track you were tracking in <b>${entry.set.title}</b> (${entry.set.artist.name}) was identified:</p>
         <p><b>${trackName}</b></p><p><a href="${url}">View the tracklist</a></p>`,
      );
    }
    await db.trackedEntry.update({
      where: { userId_entryId: { userId: t.userId, entryId } },
      data: { notifiedAt: new Date() },
    });
  }
}
