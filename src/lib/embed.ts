import type { EmbedProvider } from "@/generated/prisma/client";

export type ParsedEmbed = { provider: EmbedProvider; src: string | null };

/** Turn a pasted SoundCloud / YouTube / Mixcloud URL into an embeddable iframe src. */
export function parseEmbed(raw: string): ParsedEmbed {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { provider: "OTHER", src: null };
  }
  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    const id = host === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v");
    if (id && /^[\w-]{6,20}$/.test(id))
      return { provider: "YOUTUBE", src: `https://www.youtube.com/embed/${id}?enablejsapi=1` };
  }
  if (host === "soundcloud.com") {
    return {
      provider: "SOUNDCLOUD",
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.origin + u.pathname)}&visual=true`,
    };
  }
  if (host === "mixcloud.com") {
    return {
      provider: "MIXCLOUD",
      src: `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(u.pathname)}&hide_cover=1`,
    };
  }
  return { provider: "OTHER", src: null };
}

export function parseTimestamp(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  const parts = t.split(":").map(Number);
  if (parts.some((n) => !Number.isInteger(n) || n < 0)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function formatTimestamp(sec: number | null): string {
  if (sec == null) return "--:--";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .slice(0, 60);
}
