"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { formatTimestamp, parseTimestamp } from "@/lib/embed";

type Provider = "SOUNDCLOUD" | "YOUTUBE" | "MIXCLOUD" | "OTHER";
type Status = "UNIDENTIFIED" | "PROPOSED" | "VERIFIED" | "CONFIRMED" | "REJECTED";

export type TimelineEntry = {
  id: string;
  startSec: number | null;
  status: Status;
  label: string;
};

type Ctx = {
  time: number;
  duration: number;
  seek: (sec: number) => void;
  register: (seek: (sec: number) => void) => void;
  setTime: (t: number) => void;
  setDuration: (d: number) => void;
};

const PlayerCtx = createContext<Ctx | null>(null);

function usePlayer() {
  const c = useContext(PlayerCtx);
  if (!c) throw new Error("PlayerProvider missing");
  return c;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const seekRef = useRef<(sec: number) => void>(() => {});
  const register = useCallback((fn: (sec: number) => void) => {
    seekRef.current = fn;
  }, []);
  const seek = useCallback((sec: number) => {
    seekRef.current(sec);
    setTime(sec);
  }, []);
  return (
    <PlayerCtx.Provider value={{ time, duration, seek, register, setTime, setDuration }}>
      {children}
    </PlayerCtx.Provider>
  );
}

// ---------- provider SDKs ----------

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  if (!scripts.has(src)) {
    scripts.set(
      src,
      new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
      }),
    );
  }
  return scripts.get(src)!;
}

type Attach = (
  iframe: HTMLIFrameElement,
  onTime: (s: number) => void,
  onDuration: (s: number) => void,
) => Promise<{ seek: (s: number) => void; destroy: () => void }>;

const attachYouTube: Attach = async (iframe, onTime, onDuration) => {
  const w = window as any;
  if (!w.YT?.Player) {
    await new Promise<void>((resolve) => {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      loadScript("https://www.youtube.com/iframe_api");
    });
  }
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setInterval>;
    const p = new w.YT.Player(iframe, {
      events: {
        onReady: () => {
          onDuration(p.getDuration());
          timer = setInterval(() => {
            onTime(p.getCurrentTime());
            const d = p.getDuration();
            if (d) onDuration(d);
          }, 500);
          resolve({
            seek: (s) => {
              p.seekTo(s, true);
              p.playVideo();
            },
            destroy: () => clearInterval(timer),
          });
        },
      },
    });
  });
};

const attachSoundCloud: Attach = async (iframe, onTime, onDuration) => {
  await loadScript("https://w.soundcloud.com/player/api.js");
  const SC = (window as any).SC;
  const w = SC.Widget(iframe);
  const getDur = () => w.getDuration((ms: number) => ms && onDuration(ms / 1000));
  w.bind(SC.Widget.Events.READY, getDur);
  w.bind(SC.Widget.Events.PLAY_PROGRESS, (e: any) => {
    onTime(e.currentPosition / 1000);
    getDur();
  });
  getDur();
  return {
    seek: (s) => {
      w.seekTo(s * 1000);
      w.play();
    },
    destroy: () => {
      w.unbind(SC.Widget.Events.READY);
      w.unbind(SC.Widget.Events.PLAY_PROGRESS);
    },
  };
};

const attachMixcloud: Attach = async (iframe, onTime, onDuration) => {
  await loadScript("https://widget.mixcloud.com/media/js/widgetApi.js");
  const w = (window as any).Mixcloud.PlayerWidget(iframe);
  await w.ready;
  w.getDuration().then((d: number) => d && onDuration(d));
  w.events.progress.on((pos: number, dur: number) => {
    onTime(pos);
    if (dur) onDuration(dur);
  });
  return {
    seek: (s) => {
      w.seek(s);
      w.play();
    },
    destroy: () => {},
  };
};

const attachers: Partial<Record<Provider, Attach>> = {
  YOUTUBE: attachYouTube,
  SOUNDCLOUD: attachSoundCloud,
  MIXCLOUD: attachMixcloud,
};

// ---------- components ----------

const statusColor: Record<Status, string> = {
  UNIDENTIFIED: "#f59e0b",
  PROPOSED: "#6d5bd0",
  VERIFIED: "#22c55e",
  CONFIRMED: "#16a34a",
  REJECTED: "#52525b",
};

export function SetPlayer({
  provider,
  src,
  title,
  entries,
}: {
  provider: Provider;
  src: string;
  title: string;
  entries: TimelineEntry[];
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const { register, setTime, setDuration, seek, time, duration } = usePlayer();

  useEffect(() => {
    const attach = attachers[provider];
    if (!attach || !ref.current) return;
    let cancelled = false;
    let handle: { destroy: () => void } | undefined;
    attach(ref.current, setTime, setDuration)
      .then((h) => {
        if (cancelled) return h.destroy();
        handle = h;
        register(h.seek);
      })
      .catch((e) => console.warn("player attach failed", e));
    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, [provider, register, setTime, setDuration]);

  const timed = entries
    .filter((e) => e.startSec != null)
    .sort((a, b) => a.startSec! - b.startSec!);

  return (
    <div className="space-y-2">
      <iframe
        ref={ref}
        src={src}
        title={title}
        className="w-full rounded-lg border border-border"
        style={{ height: provider === "YOUTUBE" ? 400 : provider === "SOUNDCLOUD" ? 300 : 166 }}
        allow="autoplay; encrypted-media"
        loading="lazy"
      />
      <div
        className="relative h-10 cursor-pointer overflow-hidden rounded-md border border-border bg-card"
        role="slider"
        aria-label="Set timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        onClick={(e) => {
          if (!duration) return;
          const r = e.currentTarget.getBoundingClientRect();
          seek(((e.clientX - r.left) / r.width) * duration);
        }}
      >
        {duration > 0 &&
          timed.map((e, i) => {
            const start = e.startSec!;
            const end = timed[i + 1]?.startSec ?? duration;
            return (
              <div
                key={e.id}
                title={`${formatTimestamp(start)} · ${e.label}`}
                className="absolute inset-y-0 border-r border-background"
                style={{
                  left: `${(start / duration) * 100}%`,
                  width: `${(Math.max(end - start, 0) / duration) * 100}%`,
                  background: statusColor[e.status],
                  opacity: 0.55,
                }}
              />
            );
          })}
        {duration > 0 && (
          <div
            className="absolute inset-y-0 w-0.5 bg-white"
            style={{ left: `${Math.min(time / duration, 1) * 100}%` }}
          />
        )}
        {!duration && (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-muted">
            Press play to load the timeline
          </span>
        )}
      </div>
      <div className="flex justify-between font-mono text-xs text-muted">
        <span>{formatTimestamp(Math.floor(time))}</span>
        <span className="flex gap-3 font-sans">
          <Legend c={statusColor.UNIDENTIFIED} t="needs ID" />
          <Legend c={statusColor.PROPOSED} t="unverified" />
          <Legend c={statusColor.VERIFIED} t="verified" />
        </span>
        <span>{duration ? formatTimestamp(Math.floor(duration)) : "--:--"}</span>
      </div>
    </div>
  );
}

function Legend({ c, t }: { c: string; t: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-sm" style={{ background: c }} />
      {t}
    </span>
  );
}

/** Clickable timestamp that seeks the player. */
export function Timecode({ sec }: { sec: number | null }) {
  const { seek } = usePlayer();
  if (sec == null) return <span className="w-14 font-mono text-sm text-muted">--:--</span>;
  return (
    <button
      type="button"
      onClick={() => seek(sec)}
      className="w-14 text-left font-mono text-sm text-accent hover:underline"
    >
      {formatTimestamp(sec)}
    </button>
  );
}

/** Marker shown on the row that matches the current playback time. */
export function NowMarker({ start, end }: { start: number | null; end: number | null }) {
  const { time } = usePlayer();
  if (start == null) return null;
  const on = time >= start && (end == null || time < end);
  return on ? <span className="text-accent" title="Now playing">▶</span> : null;
}

/** Add-track form with a "use current time" button and a one-click ID flag. */
export function AddEntryForm({ action }: { action: (form: FormData) => Promise<void> }) {
  const { time } = usePlayer();
  const [t, setT] = useState("");
  const [pending, start] = useTransition();
  const now = () => formatTimestamp(Math.floor(time));

  return (
    <div className="space-y-2">
      <form
        action={(fd) =>
          start(async () => {
            await action(fd);
            setT("");
          })
        }
        className="grid grid-cols-[7rem_1fr_1fr_auto] gap-2"
      >
        <div className="flex gap-1">
          <input
            name="time"
            value={t}
            onChange={(e) => setT(e.target.value)}
            placeholder="0:00"
            className="input font-mono"
          />
          <button type="button" className="btn-ghost" title="Use current player time" onClick={() => setT(now())}>
            ⏱
          </button>
        </div>
        <input name="artistName" placeholder="Artist (blank = unknown)" className="input" />
        <input name="title" placeholder="Title (blank = unknown)" className="input" />
        <button className="btn" disabled={pending}>Add</button>
      </form>
      <button
        type="button"
        className="btn-ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("time", now());
            await action(fd);
          })
        }
      >
        ⚑ Flag “ID this” at {now()}
      </button>
      <p className="text-xs text-muted">
        Press ⏱ to grab the player&apos;s current time, or flag the moment you&apos;re hearing right now.
        {parseTimestamp(t) === null && t ? " (Use m:ss or h:mm:ss)" : ""}
      </p>
    </div>
  );
}
