"use client";

import { useState } from "react";
import type { PlaylistTrack } from "@/lib/types";
import styles from "./Playlist.module.css";

interface PlaylistProps {
  tracks: PlaylistTrack[];
  currentId: string | null;
  isPlaying: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onPlay: () => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TrackArt({ src, title }: { src: string | null; title: string }) {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return <span className={styles.artFallback} aria-hidden />;
  }

  return (
    <span className={styles.artWrap}>
      {!loaded && <span className={styles.artSkeleton} aria-hidden />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`${styles.art} ${loaded ? styles.artVisible : styles.artHidden}`}
        width={48}
        height={48}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
      <span className={styles.srOnly}>{title}</span>
    </span>
  );
}

export default function Playlist({
  tracks,
  currentId,
  isPlaying,
  onSelect,
  onRemove,
  onPlay,
}: PlaylistProps) {
  return (
    <section className={styles.section} aria-labelledby="playlist-heading">
      <div className={styles.headRow}>
        <div className={styles.head}>
          <h2 id="playlist-heading">Fila da collab</h2>
          <p>
            {tracks.length === 0
              ? "Ainda vazia — busque e adicione a primeira faixa."
              : `${tracks.length} faixa${tracks.length === 1 ? "" : "s"} na fila coletiva.`}
          </p>
        </div>

        <button
          type="button"
          className={styles.playBtn}
          onClick={onPlay}
          disabled={tracks.length === 0}
          aria-label={isPlaying ? "Pausar playlist" : "Tocar playlist"}
        >
          <span className={styles.playIcon}>{isPlaying ? "❚❚" : "▶"}</span>
          {isPlaying ? "Pausar" : "Play"}
        </button>
      </div>

      {tracks.length > 0 && (
        <ol className={styles.list}>
          {tracks.map((track, index) => {
            const active = track.id === currentId;
            return (
              <li
                key={`${track.id}-${track.addedAt}`}
                className={`${styles.row} ${active ? styles.active : ""}`}
              >
                <button
                  type="button"
                  className={styles.main}
                  onClick={() => onSelect(track.id)}
                  aria-current={active ? "true" : undefined}
                >
                  <span className={styles.index}>{index + 1}</span>
                  <TrackArt src={track.artworkUrl} title={track.title} />
                  <span className={styles.meta}>
                    <span className={styles.title}>{track.title}</span>
                    <span className={styles.artist}>
                      {track.artist}
                      {track.addedBy ? ` · ${track.addedBy}` : ""}
                    </span>
                  </span>
                  <span className={styles.duration}>{formatDuration(track.duration)}</span>
                </button>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => onRemove(track.id)}
                  aria-label={`Remover ${track.title}`}
                  title="Remover"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M4 7h16" strokeLinecap="round" />
                    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    <path d="m6 7 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                    <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
