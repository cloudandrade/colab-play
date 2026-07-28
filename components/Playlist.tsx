"use client";

import { useEffect, useRef, useState } from "react";
import { artworkProxyPath } from "@/lib/artwork";
import type { PlaylistTrackView } from "@/lib/types";
import styles from "./Playlist.module.css";

interface PlaylistProps {
  tracks: PlaylistTrackView[];
  currentId: string | null;
  isPlaying: boolean;
  shuffle: boolean;
  isOwner: boolean;
  removalVotesRequired: number;
  onToggleShuffle: () => void;
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

function TrackArt({
  trackId,
  title,
  source,
}: {
  trackId: string;
  title: string;
  source: PlaylistTrackView["source"];
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const src =
    source === "youtube" ? artworkProxyPath(trackId) : null;

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  if (!src || failed) {
    return <span className={styles.artFallback} aria-hidden />;
  }

  return (
    <span className={styles.artWrap}>
      {!loaded && <span className={styles.artSkeleton} aria-hidden />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt=""
        className={`${styles.art} ${loaded ? styles.artVisible : styles.artHidden}`}
        width={48}
        height={48}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          setLoaded(true);
        }}
      />
      <span className={styles.srOnly}>{title}</span>
    </span>
  );
}

export default function Playlist({
  tracks,
  currentId,
  isPlaying,
  shuffle,
  isOwner,
  removalVotesRequired,
  onToggleShuffle,
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
              : shuffle
                ? `${tracks.length} faixa${tracks.length === 1 ? "" : "s"} · fila embaralhada (só nesta tela)`
                : isOwner
                  ? `${tracks.length} faixa${tracks.length === 1 ? "" : "s"} · você é o dono (remoção direta)`
                  : `${tracks.length} faixa${tracks.length === 1 ? "" : "s"} · remoção por ${removalVotesRequired} votos`}
          </p>
        </div>

        <div className={styles.headActions}>
          <button
            type="button"
            className={`${styles.shuffleBtn} ${shuffle ? styles.shuffleOn : ""}`}
            onClick={onToggleShuffle}
            disabled={tracks.length === 0}
            aria-pressed={shuffle}
            aria-label={shuffle ? "Desativar ordem aleatória" : "Ativar ordem aleatória"}
            title={shuffle ? "Ordem aleatória ligada" : "Ordem aleatória"}
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
              <path d="M16 3h5v5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 20 21 3" strokeLinecap="round" />
              <path d="M21 16v5h-5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 15l6 6" strokeLinecap="round" />
              <path d="M4 4l5 5" strokeLinecap="round" />
            </svg>
            Shuffle
          </button>
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
      </div>

      {tracks.length > 0 && (
        <ol className={styles.list}>
          {tracks.map((track, index) => {
            const active = track.id === currentId;
            const votes = track.removalVoteCount;
            const voteLabel = isOwner
              ? "Remover (dono)"
              : track.hasVoted
                ? `Cancelar pedido ${votes}/${removalVotesRequired}`
                : votes > 0
                  ? `Votar remoção ${votes}/${removalVotesRequired}`
                  : `Pedir remoção (0/${removalVotesRequired})`;

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
                  <TrackArt
                    trackId={track.id}
                    title={track.title}
                    source={track.source}
                  />
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
                  className={`${styles.remove} ${
                    !isOwner && votes > 0 ? styles.voteRemove : ""
                  } ${track.hasVoted ? styles.voted : ""}`}
                  onClick={() => onRemove(track.id)}
                  aria-label={voteLabel}
                  title={voteLabel}
                >
                  <span
                    className={
                      !isOwner && votes > 0 ? styles.removeStack : undefined
                    }
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width={!isOwner && votes > 0 ? 14 : 18}
                      height={!isOwner && votes > 0 ? 14 : 18}
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
                    {!isOwner && votes > 0 && (
                      <span className={styles.voteBadge}>
                        {votes}/{removalVotesRequired}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
