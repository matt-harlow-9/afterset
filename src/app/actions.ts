"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuthError } from "next-auth";
import { auth, signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { parseEmbed, parseTimestamp, slugify } from "@/lib/embed";
import { notifyEntryIdentified } from "@/lib/notify";

const VERIFY_THRESHOLD = 3;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

// ---------- accounts ----------

export type FormState = { error?: string } | undefined;

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({
      email: z.string().email(),
      password: z.string().min(8, "Password must be at least 8 characters"),
      username: z.string().regex(/^[a-z0-9_]{3,20}$/i, "Username: 3-20 letters, numbers, underscore"),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = parsed.data.email.toLowerCase();
  const username = parsed.data.username.toLowerCase();

  const taken = await db.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (taken) return { error: "Email or username already in use" };

  await db.user.create({
    data: { email, username, name: username, passwordHash: await bcrypt.hash(parsed.data.password, 12) },
  });
  return login(undefined, form);
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: String(form.get("email")),
      password: String(form.get("password")),
      redirectTo: "/",
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Invalid email or password" };
    throw e; // redirect
  }
}

export async function magicLink(_: FormState, form: FormData): Promise<FormState> {
  await signIn("resend", { email: String(form.get("email")), redirectTo: "/" });
  return undefined;
}

export async function oauth(provider: "google" | "spotify") {
  await signIn(provider, { redirectTo: "/" });
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}

// ---------- sets ----------

export async function createSet(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({
      title: z.string().min(2).max(160),
      artist: z.string().min(1).max(80),
      eventName: z.string().max(120).optional(),
      embedUrl: z.string().url(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please fill in title, artist and a valid URL" };

  const embed = parseEmbed(parsed.data.embedUrl);
  if (!embed.src) return { error: "Only SoundCloud, YouTube and Mixcloud links are supported for now" };

  const artistSlug = slugify(parsed.data.artist);
  const artist = await db.artist.upsert({
    where: { slug: artistSlug },
    update: {},
    create: { name: parsed.data.artist, slug: artistSlug },
  });
  const base = slugify(`${parsed.data.artist} ${parsed.data.title}`);
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  await db.djSet.create({
    data: {
      title: parsed.data.title,
      slug,
      artistId: artist.id,
      eventName: parsed.data.eventName || null,
      embedUrl: parsed.data.embedUrl,
      provider: embed.provider,
      createdById: user.id,
    },
  });
  redirect(`/sets/${slug}`);
}

// ---------- tracklist ----------

/** Add a row at a timestamp. With no artist/title it becomes an "ID this" gap. */
export async function addEntry(setId: string, form: FormData) {
  const user = await requireUser();
  const artistName = String(form.get("artistName") ?? "").trim() || null;
  const title = String(form.get("title") ?? "").trim() || null;
  const startSec = parseTimestamp(String(form.get("time") ?? ""));
  const set = await db.djSet.findUniqueOrThrow({ where: { id: setId }, select: { slug: true } });
  const last = await db.tracklistEntry.aggregate({ where: { setId }, _max: { position: true } });
  await db.tracklistEntry.create({
    data: {
      setId,
      position: (last._max.position ?? 0) + 1,
      startSec,
      artistName,
      title,
      status: artistName || title ? "PROPOSED" : "UNIDENTIFIED",
      submittedById: user.id,
    },
  });
  revalidatePath(`/sets/${set.slug}`);
}

/** Propose an ID for an unidentified (or rejected) row. */
export async function proposeId(entryId: string, form: FormData) {
  const user = await requireUser();
  const artistName = String(form.get("artistName") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  if (!artistName || !title) return;
  const entry = await db.tracklistEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: { set: { select: { slug: true } } },
  });
  if (entry.status !== "UNIDENTIFIED" && entry.status !== "REJECTED") return;
  await db.$transaction([
    db.vote.deleteMany({ where: { entryId } }),
    db.tracklistEntry.update({
      where: { id: entryId },
      data: { artistName, title, status: "PROPOSED", score: 0, submittedById: user.id },
    }),
  ]);
  revalidatePath(`/sets/${entry.set.slug}`);
}

export async function vote(entryId: string, value: 1 | -1) {
  const user = await requireUser();
  const entry = await db.tracklistEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: { set: { select: { slug: true } } },
  });
  if (entry.status !== "PROPOSED") return;
  if (entry.submittedById === user.id) return; // no self-voting

  const existing = await db.vote.findUnique({ where: { userId_entryId: { userId: user.id, entryId } } });
  if (existing?.value === value) {
    await db.vote.delete({ where: { userId_entryId: { userId: user.id, entryId } } });
  } else {
    await db.vote.upsert({
      where: { userId_entryId: { userId: user.id, entryId } },
      update: { value },
      create: { userId: user.id, entryId, value },
    });
  }
  const agg = await db.vote.aggregate({ where: { entryId }, _sum: { value: true } });
  const score = agg._sum.value ?? 0;
  const status = score >= VERIFY_THRESHOLD ? "VERIFIED" : score <= -VERIFY_THRESHOLD ? "REJECTED" : "PROPOSED";
  await db.tracklistEntry.update({
    where: { id: entryId },
    data: { score, status, identifiedAt: status === "VERIFIED" ? new Date() : null },
  });
  if (status === "VERIFIED") await notifyEntryIdentified(entryId);
  revalidatePath(`/sets/${entry.set.slug}`);
}

export async function confirmEntry(entryId: string) {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "MODERATOR") return;
  const entry = await db.tracklistEntry.update({
    where: { id: entryId },
    data: { status: "CONFIRMED", identifiedAt: new Date() },
    include: { set: { select: { slug: true } } },
  });
  await notifyEntryIdentified(entryId);
  revalidatePath(`/sets/${entry.set.slug}`);
}

export async function toggleTrack(entryId: string) {
  const user = await requireUser();
  const key = { userId_entryId: { userId: user.id, entryId } };
  const existing = await db.trackedEntry.findUnique({ where: key });
  if (existing) await db.trackedEntry.delete({ where: key });
  else await db.trackedEntry.create({ data: { userId: user.id, entryId } });
  const entry = await db.tracklistEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: { set: { select: { slug: true } } },
  });
  revalidatePath(`/sets/${entry.set.slug}`);
  revalidatePath("/tracked");
}

export async function toggleFollow(artistId: string) {
  const user = await requireUser();
  const key = { userId_artistId: { userId: user.id, artistId } };
  const existing = await db.artistFollow.findUnique({ where: key });
  if (existing) await db.artistFollow.delete({ where: key });
  else await db.artistFollow.create({ data: { userId: user.id, artistId } });
  revalidatePath("/", "layout");
}
