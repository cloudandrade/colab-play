"use client";

import { useEffect, useRef, useState } from "react";
import { useMiniPlayer } from "@/hooks/useMiniPlayer";
import type { PlaylistTrack } from "@/lib/types";
import styles from "./Player.module.css";

interface PlayerProps {
  tracks: PlaylistTrack[];
  currentIndex: number;
  shouldPlay: boolean;
  shuffle: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onShouldPlayChange: (playing: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleShuffle: () => void;
}

interface YtPlayer {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
}

interface YtNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: { target: YtPlayer }) => void;
        onStateChange?: (event: { data: number; target: YtPlayer }) => void;
      };
    },
  ) => YtPlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    CUED: number;
    BUFFERING: number;
  };
}

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
        <path d="m16 9 5 5M21 9l-5 5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" strokeLinecap="round" />
      <path d="M18.5 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 3h5v5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20 21 3" strokeLinecap="round" />
      <path d="M21 16v5h-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 15l6 6" strokeLinecap="round" />
      <path d="M4 4l5 5" strokeLinecap="round" />
    </svg>
  );
}

function MiniPlayerIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="12" rx="1.5" />
      <rect
        x={active ? "13" : "12"}
        y={active ? "12" : "11"}
        width={active ? "7" : "6"}
        height={active ? "5" : "4"}
        rx="0.8"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

function loadYouTubeApi(): Promise<YtNamespace> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  return new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };

    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  });
}

export default function Player({
  tracks,
  currentIndex,
  shouldPlay,
  shuffle,
  canGoPrev,
  canGoNext,
  onShouldPlayChange,
  onNext,
  onPrev,
  onToggleShuffle,
}: PlayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const readyRef = useRef(false);
  const tracksRef = useRef(tracks);
  const shouldPlayRef = useRef(shouldPlay);
  const onShouldPlayChangeRef = useRef(onShouldPlayChange);
  const onNextRef = useRef(onNext);
  const lastCuedIdRef = useRef<string | null>(null);
  const volumeRef = useRef(80);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [apiReady, setApiReady] = useState(false);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(true);
  const volumeWrapRef = useRef<HTMLDivElement | null>(null);

  const current = tracks[currentIndex] ?? null;
  const currentId = current?.id ?? null;
  const trackDuration = current?.duration ?? 0;

  useEffect(() => {
    tracksRef.current = tracks;
    shouldPlayRef.current = shouldPlay;
    onShouldPlayChangeRef.current = onShouldPlayChange;
    onNextRef.current = onNext;
  }, [tracks, shouldPlay, onShouldPlayChange, onNext]);

  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current || playerRef.current) return;

      playerRef.current = new YT.Player(hostRef.current, {
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            readyRef.current = true;
            try {
              event.target.setVolume(volumeRef.current);
            } catch {
              // ignore
            }
            setApiReady(true);
          },
          onStateChange: (event) => {
            const YTns = window.YT;
            if (!YTns) return;
            if (event.data === YTns.PlayerState.ENDED) {
              onNextRef.current();
            } else if (event.data === YTns.PlayerState.PLAYING) {
              setPlaying(true);
              setMediaLoading(false);
              onShouldPlayChangeRef.current(true);
              setDuration(event.target.getDuration() || 0);
            } else if (event.data === YTns.PlayerState.PAUSED) {
              setPlaying(false);
              setMediaLoading(false);
            } else if (event.data === YTns.PlayerState.CUED) {
              setMediaLoading(false);
            } else if (event.data === YTns.PlayerState.BUFFERING) {
              setMediaLoading(true);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
      readyRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!apiReady || !readyRef.current || !playerRef.current || !currentId) return;

    const player = playerRef.current;
    const shouldStart = shouldPlay;

    if (lastCuedIdRef.current !== currentId) {
      lastCuedIdRef.current = currentId;
      setProgress(0);
      setDuration(trackDuration);
      setMediaLoading(true);
      if (shouldStart) {
        player.loadVideoById(currentId);
      } else {
        player.cueVideoById(currentId);
      }
      return;
    }

    try {
      if (shouldStart) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    } catch {
      // ignore
    }
  }, [apiReady, currentId, trackDuration, shouldPlay]);

  useEffect(() => {
    volumeRef.current = volume;
    const player = playerRef.current;
    if (!apiReady || !player) return;
    try {
      player.setVolume(volume);
      if (volume === 0 || muted) {
        player.mute();
      } else {
        player.unMute();
      }
    } catch {
      // ignore
    }
  }, [volume, muted, apiReady]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        setProgress(player.getCurrentTime() || 0);
        const d = player.getDuration();
        if (d) setDuration(d);
      } catch {
        // ignore
      }
    }, 400);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (!volumeOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!volumeWrapRef.current?.contains(event.target as Node)) {
        setVolumeOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [volumeOpen]);

  function togglePlay() {
    const player = playerRef.current;
    if (!player || !current) return;
    try {
      if (playing) {
        player.pauseVideo();
        onShouldPlayChange(false);
      } else {
        onShouldPlayChange(true);
        player.playVideo();
      }
    } catch {
      setPlaying(false);
    }
  }

  const {
    supported: miniSupported,
    enabled: miniEnabled,
    pipOpen,
    openPip,
    closePip,
    enableMiniPlayer,
    disableMiniPlayer,
  } = useMiniPlayer({
    current,
    playing,
    canGoPrev,
    canGoNext,
    volume,
    muted,
    onTogglePlay: togglePlay,
    onPrev,
    onNext,
    onVolumeChange: (next) => {
      setVolume(next);
      setMuted(false);
    },
    onToggleMute: () => {
      setMuted((prev) => {
        if (prev) return false;
        if (volume === 0) {
          setVolume(80);
          return false;
        }
        return true;
      });
    },
  });

  function onSeek(value: number) {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.seekTo(value, true);
      setProgress(value);
    } catch {
      // ignore
    }
  }

  async function handleMiniPlayerClick() {
    if (!miniSupported) return;
    if (!miniEnabled) {
      enableMiniPlayer();
    }
    if (pipOpen) {
      closePip();
      return;
    }
    const opened = await openPip();
    if (!opened && !miniEnabled) {
      enableMiniPlayer();
      await openPip();
    }
  }

  const max = duration || trackDuration || 0;
  const volumeValue = muted ? 0 : volume;
  const miniLabel = !miniSupported
    ? "Mini-player não suportado neste browser"
    : !miniEnabled
      ? "Reativar mini-player"
      : pipOpen
        ? "Fechar mini-player"
        : "Abrir mini-player";

  return (
    <div className={styles.panel} role="region" aria-label="Player">
      <div className={`${styles.videoSlot} ${!current ? styles.videoSlotMuted : ""}`}>
        <div ref={hostRef} className={styles.videoHost} />
        {mediaLoading && current && <div className={styles.skeletonMedia} aria-hidden />}
        {!current && (
          <p className={styles.videoPlaceholder}>Adicione faixas para começar</p>
        )}
      </div>

      <div className={styles.info}>
        {mediaLoading && current ? (
          <div className={styles.metaSkeleton} aria-hidden>
            <span className={styles.skelLine} />
            <span className={`${styles.skelLine} ${styles.skelLineShort}`} />
          </div>
        ) : current ? (
          <div className={styles.meta}>
            <strong>{current.title}</strong>
            <span>{current.artist}</span>
          </div>
        ) : (
          <p className={styles.idleInline}>Nenhuma faixa selecionada</p>
        )}
      </div>

      <div className={`${styles.controls} ${!current ? styles.controlsDisabled : ""}`}>
        <div className={styles.transport}>
          <button
            type="button"
            className={`${styles.shuffleBtn} ${shuffle ? styles.shuffleOn : ""}`}
            onClick={onToggleShuffle}
            disabled={!current}
            aria-pressed={shuffle}
            aria-label={shuffle ? "Desativar ordem aleatória" : "Ativar ordem aleatória"}
            title={shuffle ? "Ordem aleatória ligada" : "Ordem aleatória"}
          >
            <ShuffleIcon />
          </button>

          <div className={styles.buttons}>
            <button
              type="button"
              onClick={onPrev}
              disabled={!current || !canGoPrev}
              aria-label="Anterior"
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.play}
              onClick={togglePlay}
              disabled={!current}
              aria-label={playing ? "Pausar" : "Tocar"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!current || !canGoNext}
              aria-label="Próxima"
            >
              ›
            </button>
          </div>

          <div className={styles.sideActions}>
            {miniSupported && (
              <button
                type="button"
                className={`${styles.miniBtn} ${
                  miniEnabled && (pipOpen || playing) ? styles.miniBtnOn : ""
                } ${!miniEnabled ? styles.miniBtnOff : ""}`}
                onClick={() => void handleMiniPlayerClick()}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (miniEnabled) disableMiniPlayer();
                  else enableMiniPlayer();
                }}
                disabled={!current}
                aria-pressed={pipOpen}
                aria-label={miniLabel}
                title={`${miniLabel} (botão direito: ${miniEnabled ? "desativar" : "ativar"})`}
              >
                <MiniPlayerIcon active={pipOpen || (miniEnabled && playing)} />
              </button>
            )}

            <div className={styles.volume} ref={volumeWrapRef}>
              <button
                type="button"
                className={styles.volumeBtn}
                onClick={() => setVolumeOpen((open) => !open)}
                aria-expanded={volumeOpen}
                aria-label="Volume"
              >
                <SpeakerIcon muted={muted || volume === 0} />
              </button>
              {volumeOpen && (
                <div className={styles.volumePopover}>
                  <input
                    className={styles.volumeSlider}
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={volumeValue}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setVolume(next);
                      setMuted(false);
                    }}
                    aria-label="Nível do volume"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.seek}>
          <input
            type="range"
            min={0}
            max={max || 1}
            step={0.1}
            value={current ? Math.min(progress, max || 0) : 0}
            onChange={(e) => onSeek(Number(e.target.value))}
            disabled={!current}
            aria-label="Progresso"
          />
          <div className={styles.times}>
            <span>{formatTime(current ? progress : 0)}</span>
            <span>{formatTime(current ? max : 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
