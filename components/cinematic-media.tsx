"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";

type CinematicMediaProps = {
  kind: "image" | "video";
  src: string;
  poster?: string;
  alt: string;
  eyebrow: string;
  title: string;
  description: string;
  available: boolean;
  posterAvailable?: boolean;
  priority?: boolean;
  variant?: "hero" | "section" | "compact";
  sizes?: string;
};

type MediaConnection = {
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

function subscribeToPlaybackPreferences(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const queries = [
    window.matchMedia("(prefers-reduced-motion: reduce)"),
    window.matchMedia("(prefers-reduced-data: reduce)"),
    window.matchMedia("(max-width: 860px)"),
    window.matchMedia("(pointer: coarse)"),
  ];

  for (const query of queries) {
    query.addEventListener("change", onStoreChange);
  }

  const connection = (navigator as Navigator & { connection?: MediaConnection }).connection;
  connection?.addEventListener?.("change", onStoreChange);

  return () => {
    for (const query of queries) {
      query.removeEventListener("change", onStoreChange);
    }

    connection?.removeEventListener?.("change", onStoreChange);
  };
}

function getPlaybackPreferenceSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  const connection = (navigator as Navigator & { connection?: MediaConnection }).connection;

  return !(
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    window.matchMedia("(prefers-reduced-data: reduce)").matches ||
    window.matchMedia("(max-width: 860px)").matches ||
    window.matchMedia("(pointer: coarse)").matches ||
    connection?.saveData
  );
}

export default function CinematicMedia({
  kind,
  src,
  poster,
  alt,
  eyebrow,
  title,
  description,
  available,
  posterAvailable = false,
  priority = false,
  variant = "section",
  sizes,
}: CinematicMediaProps) {
  const effectiveSizes =
    sizes ??
    ({
      hero: "(max-width: 860px) 100vw, 48vw",
      section: "(max-width: 860px) 100vw, 52vw",
      compact: "(max-width: 860px) 100vw, 40vw",
    } satisfies Record<NonNullable<CinematicMediaProps["variant"]>, string>)[variant];
  const prefersVideoPlayback = useSyncExternalStore(
    subscribeToPlaybackPreferences,
    getPlaybackPreferenceSnapshot,
    () => false,
  );
  const videoEnabled = kind === "video" && available && prefersVideoPlayback;
  const showPoster = kind === "video" && poster && posterAvailable && !videoEnabled;

  return (
    <figure className={`cinematic-media is-${variant}`}>
      <div className={`cinematic-visual is-${kind} is-${variant}`}>
        {kind === "image" && available ? (
          <Image
            src={src}
            alt={alt}
            fill
            className="cinematic-image"
            sizes={effectiveSizes}
            priority={priority}
          />
        ) : null}

        {showPoster ? (
          <Image
            src={poster}
            alt={alt}
            fill
            className="cinematic-image cinematic-poster"
            sizes={effectiveSizes}
            priority={priority}
          />
        ) : null}

        {kind === "video" && available && videoEnabled ? (
          <video
            className="cinematic-video"
            autoPlay
            muted
            loop
            playsInline
            preload={priority ? "auto" : "metadata"}
            poster={posterAvailable ? poster : undefined}
            aria-label={alt}
          >
            <source src={src} type="video/mp4" />
          </video>
        ) : null}

        {!available ? <div className="cinematic-placeholder" aria-hidden="true" /> : null}

        <div className="cinematic-overlay">
          <span className="cinematic-eyebrow">{eyebrow}</span>
          <h3 className="cinematic-title">{title}</h3>
          <p className="cinematic-copy">{description}</p>
        </div>
      </div>
    </figure>
  );
}
