"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { SearchResult } from "@/lib/types";
import styles from "./SearchBox.module.css";

interface SearchBoxProps {
  onAdd: (track: SearchResult) => Promise<void> | void;
  disabled?: boolean;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SearchBox({ onAdd, disabled }: SearchBoxProps) {
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
          {visibleResults.map((track) => (
            <li key={track.id} role="option" aria-selected={false}>
              <button
                type="button"
                className={styles.item}
                disabled={addingId === track.id}
                onClick={() => handleAdd(track)}
              >
                {track.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={track.artworkUrl}
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
                </span>
                <span className={styles.duration}>{formatDuration(track.duration)}</span>
                <span className={styles.add}>
                  {addingId === track.id ? "…" : "+"}
                </span>
              </button>
            </li>
          ))}
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
