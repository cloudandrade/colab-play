"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import SearchBox from "@/components/SearchBox";
import Playlist from "@/components/Playlist";
import Player from "@/components/Player";
import UnlockModal from "@/components/UnlockModal";
import ProfileModal from "@/components/ProfileModal";
import DeleteCollabModal from "@/components/DeleteCollabModal";
import { ToastViewport, useToasts } from "@/components/Toast";
import { flattenGenreGroups, type MusicGenre } from "@/lib/genre";
import type { CollabDetail, PlaylistTrackView, SearchResult } from "@/lib/types";
import styles from "@/app/page.module.css";

interface CollabRoomProps {
  initialCollab: CollabDetail;
}

function toPreviewTrack(track: SearchResult): PlaylistTrackView {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    artworkUrl: track.artworkUrl,
    duration: track.duration,
    source: track.source,
    streamUrl:
      track.source === "youtube"
        ? `https://www.youtube.com/watch?v=${encodeURIComponent(track.id)}`
        : `/api/stream?id=${encodeURIComponent(track.id)}`,
    addedAt: new Date().toISOString(),
    removalVoteCount: 0,
    hasVoted: false,
  };
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
  source: PlaylistTrackView[],
  orderIds: string[] | null,
): PlaylistTrackView[] {
  if (!orderIds) return source;
  const byId = new Map(source.map((track) => [track.id, track]));
  const ordered: PlaylistTrackView[] = [];
  for (const id of orderIds) {
    const track = byId.get(id);
    if (track) ordered.push(track);
  }
  for (const track of source) {
    if (!orderIds.includes(track.id)) ordered.push(track);
  }
  return ordered;
}

export default function CollabRoom({ initialCollab }: CollabRoomProps) {
  const [collab, setCollab] = useState(initialCollab);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shouldPlay, setShouldPlay] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [groupByGenre, setGroupByGenre] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  /** Prévia da busca — toca sem adicionar à playlist. */
  const [previewTrack, setPreviewTrack] = useState<PlaylistTrackView | null>(
    null,
  );
  /** Ordem visual local (só no cliente). null = ordem original do servidor. */
  const [shuffledIds, setShuffledIds] = useState<string[] | null>(null);
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  const locked = collab.locked;
  const originalTracks = collab.tracks;
  const playlistIds = useMemo(
    () => originalTracks.map((track) => track.id),
    [originalTracks],
  );
  const tracks = useMemo(() => {
    if (shuffle) return orderTracks(originalTracks, shuffledIds);
    if (groupByGenre) return flattenGenreGroups(originalTracks);
    return originalTracks;
  }, [shuffle, shuffledIds, groupByGenre, originalTracks]);
  const safeIndex =
    tracks.length === 0 ? 0 : Math.min(currentIndex, tracks.length - 1);
  const canGoPrev = !previewTrack && safeIndex > 0;
  const canGoNext =
    !previewTrack && tracks.length > 0 && safeIndex < tracks.length - 1;
  const playerTracks = previewTrack ? [previewTrack] : tracks;
  const playerIndex = previewTrack ? 0 : safeIndex;

  function restoreIndexForTrack(
    currentId: string | undefined,
    nextTracks: PlaylistTrackView[],
  ) {
    if (!currentId) {
      setCurrentIndex(0);
      return;
    }
    const idx = nextTracks.findIndex((t) => t.id === currentId);
    setCurrentIndex(idx >= 0 ? idx : 0);
  }

  function handleToggleShuffle() {
    if (originalTracks.length === 0) return;
    setPreviewTrack(null);

    if (shuffle) {
      const currentId = tracks[safeIndex]?.id;
      setShuffle(false);
      setShuffledIds(null);
      restoreIndexForTrack(currentId, originalTracks);
      return;
    }

    setGroupByGenre(false);
    const nextOrder = shuffleIds(originalTracks.map((t) => t.id));
    setShuffledIds(nextOrder);
    setShuffle(true);
    setCurrentIndex(0);
    setShouldPlay(false);
  }

  async function handleToggleGroup() {
    if (originalTracks.length === 0 || groupLoading) return;

    const currentId = previewTrack?.id ?? tracks[safeIndex]?.id;
    setPreviewTrack(null);

    if (groupByGenre) {
      setGroupByGenre(false);
      restoreIndexForTrack(currentId, originalTracks);
      return;
    }

    setShuffle(false);
    setShuffledIds(null);

    const needsLookup = originalTracks.some((t) => !t.genre);
    let nextSource = originalTracks;

    if (needsLookup) {
      setGroupLoading(true);
      try {
        const res = await fetch(`/api/collabs/${collab.id}/genres`, {
          method: "POST",
        });
        if (!res.ok) {
          pushToast("Não foi possível consultar os estilos.", "error");
          return;
        }
        const data = (await res.json()) as {
          collab: CollabDetail;
          resolved?: number;
        };
        setCollab(data.collab);
        nextSource = data.collab.tracks;
        if ((data.resolved ?? 0) > 0) {
          pushToast(
            `Estilos atualizados em ${data.resolved} faixa${data.resolved === 1 ? "" : "s"}.`,
            "success",
          );
        }
      } catch {
        pushToast("Falha ao consultar estilos.", "error");
        return;
      } finally {
        setGroupLoading(false);
      }
    }

    const grouped = flattenGenreGroups(nextSource);
    setGroupByGenre(true);
    restoreIndexForTrack(currentId, grouped);
  }

  const playNext = useCallback(() => {
    if (previewTrack) {
      setShouldPlay(false);
      return;
    }
    if (tracks.length === 0) return;
    if (safeIndex < tracks.length - 1) {
      setCurrentIndex(safeIndex + 1);
      setShouldPlay(true);
    } else {
      setShouldPlay(false);
    }
  }, [previewTrack, safeIndex, tracks.length]);

  const playPrev = useCallback(() => {
    if (previewTrack) return;
    if (tracks.length === 0) return;
    if (safeIndex > 0) {
      setCurrentIndex(safeIndex - 1);
      setShouldPlay(true);
    }
  }, [previewTrack, safeIndex, tracks.length]);

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
    if (originalTracks.some((t) => t.id === track.id)) {
      pushToast("Essa faixa já está na collab.", "info");
      return;
    }

    const res = await fetch(`/api/collabs/${collab.id}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(track),
    });

    if (!res.ok) {
      pushToast("Não foi possível adicionar a faixa.", "error");
      return;
    }

    const data = (await res.json()) as { collab: CollabDetail };
    const wasEmpty = originalTracks.length === 0;
    setCollab(data.collab);
    setPreviewTrack(null);

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

    pushToast(`Adicionada: ${track.title}`, "success");
  }

  function handlePreview(track: SearchResult) {
    const existingIndex = tracks.findIndex((t) => t.id === track.id);
    if (existingIndex >= 0) {
      setPreviewTrack(null);
      setCurrentIndex(existingIndex);
      setShouldPlay(true);
      return;
    }
    setPreviewTrack(toPreviewTrack(track));
    setShouldPlay(true);
  }

  async function handleChangeGenre(id: string, genre: MusicGenre) {
    const currentId = tracks[safeIndex]?.id;
    const res = await fetch(`/api/collabs/${collab.id}/genres`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: id, genre }),
    });
    const data = (await res.json()) as {
      collab?: CollabDetail;
      error?: string;
    };

    if (!res.ok || !data.collab) {
      pushToast(data.error || "Não foi possível alterar a categoria.", "error");
      throw new Error(data.error || "genre_update_failed");
    }

    setCollab(data.collab);

    if (groupByGenre) {
      restoreIndexForTrack(currentId, flattenGenreGroups(data.collab.tracks));
    }

    pushToast(`Categoria alterada para ${genre}.`, "success");
  }

  async function handleRemove(id: string) {
    const res = await fetch(
      `/api/collabs/${collab.id}/tracks?trackId=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    const data = (await res.json()) as {
      collab?: CollabDetail;
      removed?: boolean;
      asOwner?: boolean;
      voteCount?: number;
      votesRequired?: number;
      action?: "voted" | "unvoted";
      error?: string;
    };

    if (!res.ok || !data.collab) {
      pushToast(data.error || "Não foi possível remover a faixa.", "error");
      return;
    }

    const removedFromList = Boolean(data.removed);
    const removedIndex = tracks.findIndex((t) => t.id === id);
    const wasCurrent = removedIndex === safeIndex;

    setCollab(data.collab);

    if (!removedFromList) {
      const voteCount = data.voteCount ?? 0;
      const hasVoted = data.action === "voted";
      setCollab({
        ...data.collab,
        tracks: data.collab.tracks.map((track) =>
          track.id === id
            ? {
                ...track,
                removalVoteCount: voteCount,
                hasVoted,
              }
            : track,
        ),
      });

      if (data.action === "unvoted") {
        pushToast(
          voteCount > 0
            ? `Pedido de remoção cancelado (${voteCount}/${data.votesRequired}).`
            : "Pedido de remoção cancelado.",
          "info",
        );
      } else {
        pushToast(
          `Voto registrado (${voteCount}/${data.votesRequired}). Falta mais um voto para remover.`,
          "info",
        );
      }
      return;
    }

    setShuffledIds((ids) => (ids ? ids.filter((trackId) => trackId !== id) : null));
    pushToast(
      data.asOwner
        ? "Faixa removida (dono)."
        : "Faixa removida pelos votos da galera.",
      "success",
    );

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
        Math.min(i, Math.max(0, data.collab!.tracks.length - 1)),
      );
    } else if (removedIndex < safeIndex) {
      setCurrentIndex((i) => Math.max(0, i - 1));
    }
  }

  function handleSelect(id: string) {
    const index = tracks.findIndex((t) => t.id === id);
    if (index < 0) return;
    setPreviewTrack(null);
    setCurrentIndex(index);
    setShouldPlay(true);
  }

  function handlePlaylistPlay() {
    if (previewTrack) {
      setShouldPlay((value) => !value);
      return;
    }
    if (tracks.length === 0) return;
    setShouldPlay((value) => !value);
  }

  const hasPlayer = !locked && (tracks.length > 0 || Boolean(previewTrack));

  return (
    <div
      className={`${styles.shell} ${!hasPlayer ? styles.shellNoPlayer : ""}`}
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
                {collab.isOpen ? "Pública" : "Privada"}
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

              {!locked && !collab.needsProfile && (
                <div className={styles.search}>
                  <SearchBox
                    onAdd={handleAdd}
                    onPreview={handlePreview}
                    playlistIds={playlistIds}
                  />
                </div>
              )}
            </header>

            {!locked && (
              <div className={styles.body}>
                <Playlist
                  tracks={tracks}
                  currentId={
                    previewTrack
                      ? previewTrack.id
                      : (tracks[safeIndex]?.id ?? null)
                  }
                  isPlaying={shouldPlay}
                  shuffle={shuffle}
                  groupByGenre={groupByGenre}
                  groupLoading={groupLoading}
                  showContributors={!collab.isOpen}
                  isOwner={collab.isOwner}
                  removalVotesRequired={collab.removalVotesRequired}
                  onToggleShuffle={handleToggleShuffle}
                  onToggleGroup={() => void handleToggleGroup()}
                  onSelect={handleSelect}
                  onRemove={handleRemove}
                  onChangeGenre={handleChangeGenre}
                  onPlay={handlePlaylistPlay}
                />
              </div>
            )}
          </div>

          {hasPlayer && (
            <aside className={styles.stage} aria-label="Área do player">
              <Player
                tracks={playerTracks}
                currentIndex={playerIndex}
                shouldPlay={shouldPlay}
                shuffle={shuffle}
                groupByGenre={groupByGenre}
                groupLoading={groupLoading}
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                onShouldPlayChange={setShouldPlay}
                onNext={playNext}
                onPrev={playPrev}
                onToggleShuffle={handleToggleShuffle}
                onToggleGroup={() => void handleToggleGroup()}
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

      {!locked && collab.needsProfile && (
        <ProfileModal
          collabId={collab.id}
          collabName={collab.name}
          onSaved={(next) => {
            setCollab(next);
            pushToast(`Bem-vindo(a), ${next.myProfile?.name ?? "aí"}!`, "success");
          }}
        />
      )}

      {deleteOpen && (
        <DeleteCollabModal
          collabId={collab.id}
          collabName={collab.name}
          onClose={() => setDeleteOpen(false)}
        />
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
