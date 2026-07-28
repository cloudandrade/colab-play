"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import SearchBox from "@/components/SearchBox";
import Playlist from "@/components/Playlist";
import Player from "@/components/Player";
import UnlockModal from "@/components/UnlockModal";
import DeleteCollabModal from "@/components/DeleteCollabModal";
import type { CollabDetail, PlaylistTrack, SearchResult } from "@/lib/types";
import styles from "@/app/page.module.css";

interface CollabRoomProps {
  initialCollab: CollabDetail;
}

function shuffleIds(ids: string[]): string[] {
  const next = [...ids];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
  }
  return next;
}

function orderTracks(
  source: PlaylistTrack[],
  orderIds: string[] | null,
): PlaylistTrack[] {
  if (!orderIds) return source;
  const byId = new Map(source.map((track) => [track.id, track]));
  const ordered: PlaylistTrack[] = [];
  for (const id of orderIds) {
    const track = byId.get(id);
    if (track) ordered.push(track);
  }
  // Faixas novas (ainda não no order) ficam no fim
  for (const track of source) {
    if (!orderIds.includes(track.id)) ordered.push(track);
  }
  return ordered;
}

export default function CollabRoom({ initialCollab }: CollabRoomProps) {
  const [collab, setCollab] = useState(initialCollab);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shouldPlay, setShouldPlay] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  /** Ordem visual local (só no cliente). null = ordem original do servidor. */
  const [shuffledIds, setShuffledIds] = useState<string[] | null>(null);

  const locked = collab.locked;
  const originalTracks = collab.tracks;
  const tracks = useMemo(
    () => (shuffle ? orderTracks(originalTracks, shuffledIds) : originalTracks),
    [shuffle, shuffledIds, originalTracks],
  );
  const safeIndex =
    tracks.length === 0 ? 0 : Math.min(currentIndex, tracks.length - 1);
  const canGoPrev = safeIndex > 0;
  const canGoNext = tracks.length > 0 && safeIndex < tracks.length - 1;

  function handleToggleShuffle() {
    if (tracks.length === 0) return;

    if (shuffle) {
      const currentId = tracks[safeIndex]?.id;
      setShuffle(false);
      setShuffledIds(null);
      if (currentId) {
        const originalIndex = originalTracks.findIndex((t) => t.id === currentId);
        setCurrentIndex(originalIndex >= 0 ? originalIndex : 0);
      } else {
        setCurrentIndex(0);
      }
      return;
    }

    const nextOrder = shuffleIds(originalTracks.map((t) => t.id));
    setShuffledIds(nextOrder);
    setShuffle(true);
    setCurrentIndex(0);
    setShouldPlay(false);
  }

  const playNext = useCallback(() => {
    if (tracks.length === 0) return;
    if (safeIndex < tracks.length - 1) {
      setCurrentIndex(safeIndex + 1);
      setShouldPlay(true);
    } else {
      setShouldPlay(false);
    }
  }, [safeIndex, tracks.length]);

  const playPrev = useCallback(() => {
    if (tracks.length === 0) return;
    if (safeIndex > 0) {
      setCurrentIndex(safeIndex - 1);
      setShouldPlay(true);
    }
  }, [safeIndex, tracks.length]);

  async function handleShare() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/collab/${collab.id}`
        : `/collab/${collab.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `CoLab Play — ${collab.name}`,
          text: `Entra na collab ${collab.name}`,
          url,
        });
        return;
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareHint("Link copiado!");
      window.setTimeout(() => setShareHint(null), 2000);
    } catch {
      setShareHint(url);
      window.setTimeout(() => setShareHint(null), 4000);
    }
  }

  async function reloadCollab() {
    const res = await fetch(`/api/collabs/${collab.id}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { collab: CollabDetail };
    setCollab(data.collab);
  }

  async function handleAdd(track: SearchResult) {
    setStatus(null);
    const res = await fetch(`/api/collabs/${collab.id}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(track),
    });

    if (!res.ok) {
      setStatus("Não foi possível adicionar a faixa.");
      return;
    }

    const data = (await res.json()) as { collab: CollabDetail };
    const wasEmpty = originalTracks.length === 0;
    setCollab(data.collab);

    if (wasEmpty) {
      setCurrentIndex(0);
      if (shuffle) {
        setShuffledIds(data.collab.tracks.map((t) => t.id));
      }
    } else if (shuffle) {
      const newTrack = data.collab.tracks.find(
        (t) => !originalTracks.some((o) => o.id === t.id),
      );
      if (newTrack) {
        setShuffledIds((ids) => [...(ids ?? originalTracks.map((t) => t.id)), newTrack.id]);
      }
    }

    setStatus(`Adicionada: ${track.title}`);
  }

  async function handleRemove(id: string) {
    setStatus(null);
    const res = await fetch(
      `/api/collabs/${collab.id}/tracks?trackId=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      setStatus("Não foi possível remover a faixa.");
      return;
    }
    const data = (await res.json()) as { collab: CollabDetail };
    const removedIndex = tracks.findIndex((t) => t.id === id);
    const wasCurrent = removedIndex === safeIndex;

    setCollab(data.collab);
    setShuffledIds((ids) => (ids ? ids.filter((trackId) => trackId !== id) : null));

    if (data.collab.tracks.length === 0) {
      setShouldPlay(false);
      setCurrentIndex(0);
      setShuffle(false);
      setShuffledIds(null);
      return;
    }

    if (removedIndex < 0) return;

    if (wasCurrent) {
      setCurrentIndex((i) =>
        Math.min(i, Math.max(0, data.collab.tracks.length - 1)),
      );
    } else if (removedIndex < safeIndex) {
      setCurrentIndex((i) => Math.max(0, i - 1));
    }
  }

  function handleSelect(id: string) {
    const index = tracks.findIndex((t: PlaylistTrack) => t.id === id);
    if (index < 0) return;
    setCurrentIndex(index);
    setShouldPlay(true);
  }

  function handlePlaylistPlay() {
    if (tracks.length === 0) return;
    setShouldPlay((value) => !value);
  }

  return (
    <div
      className={`${styles.shell} ${tracks.length === 0 || locked ? styles.shellNoPlayer : ""}`}
    >
      <div className={styles.atmosphere} aria-hidden />

      <main className={styles.main}>
        <div className={styles.layout}>
          <div className={styles.content}>
            <header className={styles.hero}>
              <p className={styles.kicker}>
                <Link href="/" className={styles.backLink}>
                  ← Collabs
                </Link>
                <span aria-hidden> · </span>
                {collab.isOpen ? "Aberta" : "Fechada"}
              </p>
              <div className={styles.titleRow}>
                <h1 className={styles.brandRoom}>{collab.name}</h1>
                <div className={styles.titleActions}>
                  <button
                    type="button"
                    className={styles.shareBtn}
                    onClick={handleShare}
                    aria-label="Compartilhar collab"
                    title="Compartilhar link"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      aria-hidden
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                    >
                      <circle cx="18" cy="5" r="2.5" />
                      <circle cx="6" cy="12" r="2.5" />
                      <circle cx="18" cy="19" r="2.5" />
                      <path
                        d="M8.2 13.2 15.8 17.3M15.8 6.7 8.2 10.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => setDeleteOpen(true)}
                    aria-label="Excluir collab"
                    title="Excluir collab"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
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
                </div>
              </div>
              {shareHint && <p className={styles.shareHint}>{shareHint}</p>}
              <p className={styles.lead}>
                Busque uma faixa, adicione à fila e ouça junto nesta collab.
              </p>

              {!locked && (
                <div className={styles.search}>
                  <SearchBox onAdd={handleAdd} />
                  {status && <p className={styles.status}>{status}</p>}
                </div>
              )}
            </header>

            {!locked && (
              <div className={styles.body}>
                <Playlist
                  tracks={tracks}
                  currentId={tracks[safeIndex]?.id ?? null}
                  isPlaying={shouldPlay}
                  shuffle={shuffle}
                  onToggleShuffle={handleToggleShuffle}
                  onSelect={handleSelect}
                  onRemove={handleRemove}
                  onPlay={handlePlaylistPlay}
                />
              </div>
            )}
          </div>

          {!locked && tracks.length > 0 && (
            <aside className={styles.stage} aria-label="Área do player">
              <Player
                tracks={tracks}
                currentIndex={safeIndex}
                shouldPlay={shouldPlay}
                shuffle={shuffle}
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                onShouldPlayChange={setShouldPlay}
                onNext={playNext}
                onPrev={playPrev}
                onToggleShuffle={handleToggleShuffle}
              />
            </aside>
          )}
        </div>
      </main>

      {locked && (
        <UnlockModal
          collabId={collab.id}
          collabName={collab.name}
          onUnlocked={reloadCollab}
        />
      )}

      {deleteOpen && (
        <DeleteCollabModal
          collabId={collab.id}
          collabName={collab.name}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}
