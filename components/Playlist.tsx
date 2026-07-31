"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { artworkProxyPath } from "@/lib/artwork";
import { avatarSrc, isAvatarId } from "@/lib/avatars";
import {
  groupTracksByGenre,
  isMusicGenre,
  MUSIC_GENRES,
  trackGenreOf,
  type MusicGenre,
} from "@/lib/genre";
import type { PlaylistTrackView } from "@/lib/types";
import styles from "./Playlist.module.css";

interface PlaylistProps {
  tracks: PlaylistTrackView[];
  currentId: string | null;
  isPlaying: boolean;
  shuffle: boolean;
  groupByGenre: boolean;
  groupLoading: boolean;
  /** Collabs privadas: mostra figurinha de quem adicionou. */
  showContributors: boolean;
  isOwner: boolean;
  removalVotesRequired: number;
  onToggleShuffle: () => void;
  onToggleGroup: () => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onChangeGenre: (id: string, genre: MusicGenre) => Promise<void>;
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

function TrackRow({
  track,
  index,
  currentId,
  showContributors,
  isOwner,
  removalVotesRequired,
  onSelect,
  onRemove,
  onChangeGenre,
}: {
  track: PlaylistTrackView;
  index: number;
  currentId: string | null;
  showContributors: boolean;
  isOwner: boolean;
  removalVotesRequired: number;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onChangeGenre: (id: string, genre: MusicGenre) => Promise<void>;
}) {
  const active = track.id === currentId;
  const votes = track.removalVoteCount;
  const currentGenre = trackGenreOf(track);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuListRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function placeMenu() {
      setMenuPos(computeMenuPos());
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        btnRef.current?.contains(target) ||
        menuListRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
      setMenuPos(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setMenuPos(null);
      }
    }

    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const voteLabel = isOwner
    ? "Remover (dono)"
    : track.hasVoted
      ? `Cancelar pedido ${votes}/${removalVotesRequired}`
      : votes > 0
        ? `Votar remoção ${votes}/${removalVotesRequired}`
        : `Pedir remoção (0/${removalVotesRequired})`;

  function computeMenuPos() {
    const btn = btnRef.current;
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 160;
    const menuMaxH = 256;
    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    let top = rect.bottom + 4;
    if (spaceBelow < Math.min(menuMaxH, 200) && spaceAbove > spaceBelow) {
      top = Math.max(8, rect.top - Math.min(menuMaxH, spaceAbove) - 4);
    }
    return { top, left };
  }

  function toggleMenu() {
    if (menuOpen) {
      setMenuOpen(false);
      setMenuPos(null);
      return;
    }
    setMenuPos(computeMenuPos());
    setMenuOpen(true);
  }

  async function pickGenre(genre: MusicGenre) {
    if (genre === currentGenre || saving) {
      setMenuOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onChangeGenre(track.id, genre);
      setMenuOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className={`${styles.row} ${active ? styles.active : ""}`}>
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
            {!showContributors && track.addedBy ? ` · ${track.addedBy}` : ""}
            {track.genre && isMusicGenre(track.genre) ? ` · ${track.genre}` : ""}
          </span>
        </span>
        <span className={styles.tail}>
          {showContributors &&
            track.addedByAvatar &&
            isAvatarId(track.addedByAvatar) && (
              <span
                className={styles.contributor}
                title={track.addedBy || "Quem adicionou"}
                aria-label={
                  track.addedBy
                    ? `Adicionada por ${track.addedBy}`
                    : "Quem adicionou"
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarSrc(track.addedByAvatar)}
                  alt=""
                  width={28}
                  height={28}
                />
              </span>
            )}
          <span className={styles.duration}>
            {formatDuration(track.duration)}
          </span>
        </span>
      </button>

      <div className={styles.rowActions}>
        <div className={styles.genreWrap}>
          <button
            ref={btnRef}
            type="button"
            className={`${styles.genreBtn} ${menuOpen ? styles.genreBtnOpen : ""}`}
            onClick={toggleMenu}
            disabled={saving}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            aria-label={`Mudar categoria (atual: ${currentGenre})`}
            title={`Categoria: ${currentGenre}`}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              aria-hidden
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 7h7l2 2h7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
            </svg>
          </button>
          {menuOpen &&
            menuPos &&
            createPortal(
              <ul
                ref={menuListRef}
                className={styles.genreMenu}
                role="listbox"
                aria-label="Escolher categoria"
                style={{ top: menuPos.top, left: menuPos.left }}
              >
                {MUSIC_GENRES.map((genre) => (
                  <li key={genre} role="option" aria-selected={genre === currentGenre}>
                    <button
                      type="button"
                      className={`${styles.genreOption} ${
                        genre === currentGenre ? styles.genreOptionActive : ""
                      }`}
                      onClick={() => void pickGenre(genre)}
                      disabled={saving}
                    >
                      {genre}
                    </button>
                  </li>
                ))}
              </ul>,
              document.body,
            )}
        </div>

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
      </div>
    </li>
  );
}

export default function Playlist({
  tracks,
  currentId,
  isPlaying,
  shuffle,
  groupByGenre,
  groupLoading,
  showContributors,
  isOwner,
  removalVotesRequired,
  onToggleShuffle,
  onToggleGroup,
  onSelect,
  onRemove,
  onChangeGenre,
  onPlay,
}: PlaylistProps) {
  const genreGroups = useMemo(
    () => (groupByGenre ? groupTracksByGenre(tracks) : []),
    [groupByGenre, tracks],
  );

  const statusText =
    tracks.length === 0
      ? "Ainda vazia — busque e adicione a primeira faixa."
      : groupLoading
        ? `${tracks.length} faixa${tracks.length === 1 ? "" : "s"} · consultando estilos…`
        : shuffle
          ? `${tracks.length} faixa${tracks.length === 1 ? "" : "s"} · fila embaralhada (só nesta tela)`
          : groupByGenre
            ? `${tracks.length} faixa${tracks.length === 1 ? "" : "s"} · agrupadas por estilo (só nesta tela)`
            : isOwner
              ? `${tracks.length} faixa${tracks.length === 1 ? "" : "s"} · você é o dono (remoção direta)`
              : `${tracks.length} faixa${tracks.length === 1 ? "" : "s"} · remoção por ${removalVotesRequired} votos`;

  const groupedSections = useMemo(() => {
    let offset = 0;
    return genreGroups.map((group) => {
      const startIndex = offset;
      offset += group.tracks.length;
      return { ...group, startIndex };
    });
  }, [genreGroups]);

  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!groupByGenre) setClosedGroups({});
  }, [groupByGenre]);

  return (
    <section className={styles.section} aria-labelledby="playlist-heading">
      <div className={styles.headRow}>
        <div className={styles.head}>
          <h2 id="playlist-heading">Fila da collab</h2>
          <p>{statusText}</p>
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
            className={`${styles.shuffleBtn} ${groupByGenre ? styles.shuffleOn : ""}`}
            onClick={onToggleGroup}
            disabled={tracks.length === 0 || groupLoading}
            aria-pressed={groupByGenre}
            aria-busy={groupLoading}
            aria-label={
              groupLoading
                ? "Consultando estilos"
                : groupByGenre
                  ? "Desativar agrupamento por estilo"
                  : "Agrupar por estilo"
            }
            title={
              groupLoading
                ? "Consultando estilos…"
                : groupByGenre
                  ? "Agrupamento por estilo ligado (só nesta tela)"
                  : "Agrupar por estilo (só nesta tela)"
            }
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
              <path d="M4 6h16" strokeLinecap="round" />
              <path d="M4 12h10" strokeLinecap="round" />
              <path d="M4 18h7" strokeLinecap="round" />
              <path
                d="M17 14v7M14 17.5h6"
                strokeLinecap="round"
              />
            </svg>
            Group
            {groupLoading ? "…" : ""}
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

      {tracks.length > 0 && !groupByGenre && (
        <ol className={styles.list}>
          {tracks.map((track, index) => (
            <TrackRow
              key={`${track.id}-${track.addedAt}`}
              track={track}
              index={index}
              currentId={currentId}
              showContributors={showContributors}
              isOwner={isOwner}
              removalVotesRequired={removalVotesRequired}
              onSelect={onSelect}
              onRemove={onRemove}
              onChangeGenre={onChangeGenre}
            />
          ))}
        </ol>
      )}

      {tracks.length > 0 && groupByGenre && (
        <div className={styles.groups}>
          {groupedSections.map((group) => (
            <details
              key={group.genre}
              className={styles.group}
              open={!closedGroups[group.genre]}
              onToggle={(event) => {
                const isOpen = event.currentTarget.open;
                setClosedGroups((prev) => ({
                  ...prev,
                  [group.genre]: !isOpen,
                }));
              }}
            >
              <summary className={styles.groupSummary}>
                <span className={styles.groupName}>{group.genre}</span>
                <span className={styles.groupCount}>
                  {group.tracks.length} faixa
                  {group.tracks.length === 1 ? "" : "s"}
                </span>
              </summary>
              <ol className={styles.list}>
                {group.tracks.map((track, i) => (
                  <TrackRow
                    key={`${track.id}-${track.addedAt}`}
                    track={track}
                    index={group.startIndex + i}
                    currentId={currentId}
                    showContributors={showContributors}
                    isOwner={isOwner}
                    removalVotesRequired={removalVotesRequired}
                    onSelect={onSelect}
                    onRemove={onRemove}
                    onChangeGenre={onChangeGenre}
                  />
                ))}
              </ol>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
