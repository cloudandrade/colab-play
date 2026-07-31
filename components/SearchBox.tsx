"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { artworkProxyPath } from "@/lib/artwork";
import type { SearchResult } from "@/lib/types";
import styles from "./SearchBox.module.css";

interface SearchBoxProps {
  onAdd: (track: SearchResult) => Promise<void> | void;
  /** Clique na faixa: só ouve (não adiciona). */
  onPreview: (track: SearchResult) => void;
  /** IDs já presentes na playlist da collab. */
  playlistIds?: string[];
  disabled?: boolean;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SearchBox({
  onAdd,
  onPreview,
  playlistIds = [],
  disabled,
}: SearchBoxProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const inPlaylist = useMemo(() => new Set(playlistIds), [playlistIds]);

  const trimmed = query.trim();
  const canSearch = trimmed.length >= 2;
  const visibleResults = canSearch ? results : [];

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!canSearch) {
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { results?: SearchResult[]; error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Busca falhou");
        }
        startTransition(() => {
          setResults(data.results ?? []);
          setOpen(true);
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Não foi possível buscar agora.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [canSearch, trimmed]);

  async function handleAdd(track: SearchResult) {
    if (inPlaylist.has(track.id)) return;
    setAddingId(track.id);
    try {
      await onAdd(track);
      setQuery("");
      setResults([]);
      setOpen(false);
    } finally {
      setAddingId(null);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <label className={styles.label} htmlFor={`${listId}-input`}>
        Buscar músicas
      </label>
      <div className={styles.field}>
        <input
          id={`${listId}-input`}
          className={styles.input}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Digite artista ou título…"
          value={query}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => {
            if (visibleResults.length) setOpen(true);
          }}
        />
        {loading && <span className={styles.hint}>Buscando…</span>}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {open && visibleResults.length > 0 && (
        <ul id={listId} className={styles.list} role="listbox">
          {visibleResults.map((track) => {
            const alreadyIn = inPlaylist.has(track.id);
            const adding = addingId === track.id;

            return (
              <li
                key={track.id}
                className={`${styles.row} ${alreadyIn ? styles.rowInPlaylist : ""}`}
                role="option"
                aria-selected={false}
              >
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => onPreview(track)}
                  aria-label={`Ouvir ${track.title}`}
                  title="Clique para ouvir"
                >
                  {track.source === "youtube" || track.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={
                        track.source === "youtube"
                          ? artworkProxyPath(track.id)
                          : (track.artworkUrl as string)
                      }
                      alt=""
                      className={styles.art}
                      width={44}
                      height={44}
                    />
                  ) : (
                    <span className={styles.artFallback} aria-hidden />
                  )}
                  <span className={styles.meta}>
                    <span className={styles.title}>{track.title}</span>
                    <span className={styles.artist}>{track.artist}</span>
                    {alreadyIn && (
                      <span className={styles.badge}>já nessa collab</span>
                    )}
                  </span>
                  <span className={styles.duration}>
                    {formatDuration(track.duration)}
                  </span>
                </button>
                <button
                  type="button"
                  className={`${styles.addBtn} ${alreadyIn ? styles.addBtnDone : ""}`}
                  onClick={() => void handleAdd(track)}
                  disabled={disabled || adding || alreadyIn}
                  aria-label={
                    alreadyIn
                      ? `${track.title} já está na collab`
                      : `Adicionar ${track.title}`
                  }
                  title={
                    alreadyIn ? "Já está nessa collab" : "Adicionar à collab"
                  }
                >
                  {adding ? "…" : alreadyIn ? "✓" : "+"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open &&
        !loading &&
        canSearch &&
        visibleResults.length === 0 &&
        !error && <p className={styles.empty}>Nenhuma faixa encontrada.</p>}
    </div>
  );
}
