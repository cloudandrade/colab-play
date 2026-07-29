"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaylistTrack } from "@/lib/types";
import {
  getDocumentPip,
  isMiniPlayerEnabled,
  mediaArtworkUrl,
  setMiniPlayerEnabled,
  supportsDocumentPip,
} from "@/lib/mini-player";

interface UseMiniPlayerOptions {
  current: PlaylistTrack | null;
  playing: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  volume: number;
  muted: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}

/** Tamanho da janela Document PiP (inclui chrome do browser). */
const PIP_WIDTH = 340;
const PIP_HEIGHT = 165;

/** Estilos espelhando o player principal (botões redondos + laranja no play). */
const PIP_STYLE = `
  :root {
    color-scheme: dark;
    --bg: #102018;
    --ink: #f3fff7;
    --muted: color-mix(in srgb, #f3fff7 68%, transparent);
    --accent: #ff5c00;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  body {
    font-family: Figtree, system-ui, sans-serif;
    background: color-mix(in srgb, #102018 96%, transparent);
    color: var(--ink);
  }
  .wrap {
    width: 100%;
    height: 100%;
    padding: 0.55rem 0.7rem 0.5rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.45rem;
    overflow: hidden;
  }
  .row {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    text-align: left;
    gap: 0.55rem;
    min-width: 0;
    width: 100%;
  }
  .art {
    width: 44px;
    height: 44px;
    border-radius: 0.3rem;
    object-fit: cover;
    background: #0a1410;
    flex-shrink: 0;
  }
  .meta {
    min-width: 0;
    max-width: 12rem;
  }
  .meta strong {
    display: block;
    font-size: 0.85rem;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta span {
    display: block;
    margin-top: 0.15rem;
    font-size: 0.72rem;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .transport {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 0.35rem;
  }
  .buttons {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.55rem;
    grid-column: 2;
  }
  .buttons button {
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 1.45rem;
    line-height: 1;
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 999px;
    cursor: pointer;
  }
  .buttons button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .buttons button:hover:not(:disabled) {
    background: color-mix(in srgb, #fff 12%, transparent);
  }
  .play {
    width: 3rem !important;
    height: 3rem !important;
    background: var(--accent) !important;
    color: #102018 !important;
    font-size: 1rem !important;
  }
  .play:hover:not(:disabled) {
    transform: scale(1.05);
  }
  .volume {
    grid-column: 3;
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
  }
  .volumeBtn {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    width: 2.2rem;
    height: 2.2rem;
    display: grid;
    place-items: center;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .volumeBtn:hover {
    background: color-mix(in srgb, #fff 12%, transparent);
  }
  .volumeBtn svg {
    width: 18px;
    height: 18px;
  }
  .volumeSlider {
    width: 4.5rem;
    accent-color: var(--accent);
    cursor: pointer;
  }
`;

function speakerSvg(muted: boolean): string {
  if (muted) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" stroke-linejoin="round" />
      <path d="m16 9 5 5M21 9l-5 5" stroke-linecap="round" />
    </svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4V5Z" stroke-linejoin="round" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" stroke-linecap="round" />
    <path d="M18.5 6a8.5 8.5 0 0 1 0 12" stroke-linecap="round" />
  </svg>`;
}

export function useMiniPlayer({
  current,
  playing,
  canGoPrev,
  canGoNext,
  volume,
  muted,
  onTogglePlay,
  onPrev,
  onNext,
  onVolumeChange,
  onToggleMute,
}: UseMiniPlayerOptions) {
  const [enabled, setEnabled] = useState(true);
  const [pipOpen, setPipOpen] = useState(false);
  const [supported, setSupported] = useState(false);

  const pipWindowRef = useRef<Window | null>(null);
  const currentRef = useRef(current);
  const playingRef = useRef(playing);
  const canGoPrevRef = useRef(canGoPrev);
  const canGoNextRef = useRef(canGoNext);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  const onTogglePlayRef = useRef(onTogglePlay);
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);
  const onVolumeChangeRef = useRef(onVolumeChange);
  const onToggleMuteRef = useRef(onToggleMute);
  const openingRef = useRef(false);

  useEffect(() => {
    setEnabled(isMiniPlayerEnabled());
    setSupported(supportsDocumentPip());
  }, []);

  useEffect(() => {
    currentRef.current = current;
    playingRef.current = playing;
    canGoPrevRef.current = canGoPrev;
    canGoNextRef.current = canGoNext;
    volumeRef.current = volume;
    mutedRef.current = muted;
    onTogglePlayRef.current = onTogglePlay;
    onPrevRef.current = onPrev;
    onNextRef.current = onNext;
    onVolumeChangeRef.current = onVolumeChange;
    onToggleMuteRef.current = onToggleMute;
  }, [
    current,
    playing,
    canGoPrev,
    canGoNext,
    volume,
    muted,
    onTogglePlay,
    onPrev,
    onNext,
    onVolumeChange,
    onToggleMute,
  ]);

  const closePip = useCallback(() => {
    const pip = getDocumentPip();
    const win = pipWindowRef.current ?? pip?.window ?? null;
    pipWindowRef.current = null;
    setPipOpen(false);
    try {
      win?.close();
    } catch {
      // ignore
    }
  }, []);

  const syncPip = useCallback((win: Window) => {
    const doc = win.document;
    const track = currentRef.current;
    const isPlaying = playingRef.current;
    const isMuted = mutedRef.current || volumeRef.current === 0;

    const art = doc.querySelector<HTMLImageElement>(".art");
    const title = doc.querySelector<HTMLElement>(".meta strong");
    const artist = doc.querySelector<HTMLElement>(".meta span");
    const playBtn = doc.querySelector<HTMLButtonElement>(".play");
    const buttons = doc.querySelectorAll<HTMLButtonElement>(".buttons button");
    const prevBtn = buttons[0];
    const nextBtn = buttons[2];
    const volumeBtn = doc.querySelector<HTMLButtonElement>(".volumeBtn");
    const volumeSlider = doc.querySelector<HTMLInputElement>(".volumeSlider");

    if (!art || !title || !artist || !playBtn || !prevBtn || !nextBtn) return;

    const nextArt = track ? mediaArtworkUrl(track.id) : "";
    // Compara pathname para não resetar a img a cada sync
    try {
      const currentPath = new URL(art.src).pathname;
      const nextPath = nextArt ? new URL(nextArt, window.location.origin).pathname : "";
      if (currentPath !== nextPath) art.src = nextArt;
    } catch {
      if (art.getAttribute("src") !== nextArt) art.src = nextArt;
    }

    title.textContent = track?.title ?? "Nenhuma faixa";
    artist.textContent = track?.artist ?? "CoLab Play";
    doc.title = track ? `${track.title} · CoLab Play` : "CoLab Play";

    playBtn.textContent = isPlaying ? "❚❚" : "▶";
    playBtn.setAttribute("aria-label", isPlaying ? "Pausar" : "Tocar");
    prevBtn.disabled = !canGoPrevRef.current;
    nextBtn.disabled = !canGoNextRef.current;

    if (volumeBtn) {
      const nextSvg = speakerSvg(isMuted);
      if (volumeBtn.dataset.muted !== String(isMuted)) {
        volumeBtn.dataset.muted = String(isMuted);
        volumeBtn.setAttribute("aria-label", isMuted ? "Ativar som" : "Silenciar");
        volumeBtn.innerHTML = nextSvg;
      }
    }
    if (volumeSlider && doc.activeElement !== volumeSlider) {
      volumeSlider.value = String(isMuted ? 0 : volumeRef.current);
    }
  }, []);

  const mountPip = useCallback(
    (win: Window) => {
      const doc = win.document;
      doc.head.innerHTML = "";
      doc.body.innerHTML = "";

      const style = doc.createElement("style");
      style.textContent = PIP_STYLE;
      doc.head.appendChild(style);

      const wrap = doc.createElement("div");
      wrap.className = "wrap";

      const row = doc.createElement("div");
      row.className = "row";

      const art = doc.createElement("img");
      art.className = "art";
      art.alt = "";

      const meta = doc.createElement("div");
      meta.className = "meta";
      meta.append(doc.createElement("strong"), doc.createElement("span"));
      row.append(art, meta);

      const transport = doc.createElement("div");
      transport.className = "transport";

      const buttons = doc.createElement("div");
      buttons.className = "buttons";

      const prevBtn = doc.createElement("button");
      prevBtn.type = "button";
      prevBtn.textContent = "‹";
      prevBtn.setAttribute("aria-label", "Anterior");
      prevBtn.onclick = () => onPrevRef.current();

      const playBtn = doc.createElement("button");
      playBtn.type = "button";
      playBtn.className = "play";
      playBtn.onclick = () => onTogglePlayRef.current();

      const nextBtn = doc.createElement("button");
      nextBtn.type = "button";
      nextBtn.textContent = "›";
      nextBtn.setAttribute("aria-label", "Próxima");
      nextBtn.onclick = () => onNextRef.current();

      buttons.append(prevBtn, playBtn, nextBtn);

      const volumeWrap = doc.createElement("div");
      volumeWrap.className = "volume";

      const volumeBtn = doc.createElement("button");
      volumeBtn.type = "button";
      volumeBtn.className = "volumeBtn";
      volumeBtn.onclick = () => onToggleMuteRef.current();

      const volumeSlider = doc.createElement("input");
      volumeSlider.className = "volumeSlider";
      volumeSlider.type = "range";
      volumeSlider.min = "0";
      volumeSlider.max = "100";
      volumeSlider.step = "1";
      volumeSlider.setAttribute("aria-label", "Volume");
      volumeSlider.oninput = () => {
        onVolumeChangeRef.current(Number(volumeSlider.value));
      };

      volumeWrap.append(volumeBtn, volumeSlider);
      transport.append(buttons, volumeWrap);
      wrap.append(row, transport);
      doc.body.appendChild(wrap);
      syncPip(win);
    },
    [syncPip],
  );

  const openPip = useCallback(async () => {
    if (!isMiniPlayerEnabled() || !supportsDocumentPip()) return false;
    if (openingRef.current) return false;

    const pip = getDocumentPip();
    if (!pip) return false;
    if (pip.window || pipWindowRef.current) {
      const existing = pipWindowRef.current ?? pip.window;
      if (existing) {
        try {
          existing.resizeTo(PIP_WIDTH, PIP_HEIGHT);
        } catch {
          // ignore
        }
        syncPip(existing);
      }
      return true;
    }

    openingRef.current = true;
    try {
      const win = await pip.requestWindow({
        width: PIP_WIDTH,
        height: PIP_HEIGHT,
        preferInitialWindowPlacement: true,
      });
      // Chrome costuma reusar o tamanho anterior; força o tamanho desejado.
      try {
        win.resizeTo(PIP_WIDTH, PIP_HEIGHT);
      } catch {
        // ignore
      }
      pipWindowRef.current = win;
      setPipOpen(true);
      mountPip(win);
      // Garante após o layout do conteúdo
      requestAnimationFrame(() => {
        try {
          win.resizeTo(PIP_WIDTH, PIP_HEIGHT);
        } catch {
          // ignore
        }
      });
      win.addEventListener("pagehide", () => {
        pipWindowRef.current = null;
        setPipOpen(false);
      });
      return true;
    } catch {
      return false;
    } finally {
      openingRef.current = false;
    }
  }, [mountPip, syncPip]);

  useEffect(() => {
    const win = pipWindowRef.current ?? getDocumentPip()?.window ?? null;
    if (!win || win.closed) return;
    syncPip(win);
  }, [current, playing, canGoPrev, canGoNext, volume, muted, syncPip]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    if (!current) {
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
      } catch {
        // ignore
      }
      return;
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: "CoLab Play",
        artwork: [
          {
            src: mediaArtworkUrl(current.id),
            sizes: "320x180",
            type: "image/jpeg",
          },
        ],
      });
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";

      navigator.mediaSession.setActionHandler("play", () => {
        if (!playingRef.current) onTogglePlayRef.current();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (playingRef.current) onTogglePlayRef.current();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        if (canGoPrevRef.current) onPrevRef.current();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        if (canGoNextRef.current) onNextRef.current();
      });
    } catch {
      // ignore
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
      } catch {
        // ignore
      }
    };
  }, [current, playing]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") {
        closePip();
        return;
      }
      if (document.visibilityState !== "hidden") return;
      if (!playingRef.current || !currentRef.current) return;
      if (!isMiniPlayerEnabled()) return;
      void openPip().then(() => {
        // Se o usuário já voltou enquanto o PiP abria, fecha de novo.
        if (document.visibilityState === "visible") closePip();
      });
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [openPip, closePip]);

  const enableMiniPlayer = useCallback(() => {
    setMiniPlayerEnabled(true);
    setEnabled(true);
  }, []);

  const disableMiniPlayer = useCallback(() => {
    setMiniPlayerEnabled(false);
    setEnabled(false);
    closePip();
  }, [closePip]);

  return {
    supported,
    enabled,
    pipOpen,
    openPip,
    closePip,
    enableMiniPlayer,
    disableMiniPlayer,
  };
}
