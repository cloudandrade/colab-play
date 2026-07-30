import type { MusicGenre } from "./genre";
import { classifyGenre, isMusicGenre } from "./genre";

/** Remove ruído típico de títulos do YouTube para melhorar o match. */
export function cleanTrackQuery(title: string, artist: string): {
  title: string;
  artist: string;
  term: string;
} {
  const cleanedTitle = title
    .replace(/\([^)]*oficial[^)]*\)/gi, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\bofficial\s*(music\s*)?video\b/gi, " ")
    .replace(/\blyric\s*video\b/gi, " ")
    .replace(/\bvisualizer\b/gi, " ")
    .replace(/\báudio\s*oficial\b/gi, " ")
    .replace(/\baudio\s*oficial\b/gi, " ")
    .replace(/\bclipe\s*oficial\b/gi, " ")
    .replace(/\bhd\b/gi, " ")
    .replace(/\s*[-–|]\s*topic\s*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();

  const cleanedArtist = artist
    .replace(/\s*[-–|]\s*topic\s*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: cleanedTitle,
    artist: cleanedArtist,
    term: `${cleanedArtist} ${cleanedTitle}`.trim(),
  };
}

/** Mapeia o gênero bruto (Deezer / iTunes / etc.) para o nosso conjunto. */
export function mapExternalGenre(raw: string): MusicGenre | null {
  const text = raw.normalize("NFD").replace(/\p{M}/gu, "").trim();
  if (!text) return null;
  if (isMusicGenre(text)) return text;

  const rules: Array<{ genre: MusicGenre; pattern: RegExp }> = [
    { genre: "Gospel", pattern: /gospel|christian|worship|religious|inspirational/i },
    { genre: "Trap", pattern: /\btrap\b/i },
    { genre: "Rap", pattern: /hip[\s-]?hop|\brap\b/i },
    { genre: "Funk", pattern: /\bfunk\b/i },
    { genre: "Sertanejo", pattern: /sertanejo|country|musica sertaneja/i },
    { genre: "Pagode", pattern: /pagode|\bsamba\b/i },
    { genre: "Forró", pattern: /forr[oó]/i },
    { genre: "MPB", pattern: /\bmpb\b|bossa|musica popular brasileira/i },
    { genre: "Rock", pattern: /rock|metal|punk|grunge|alternative|indie/i },
    {
      genre: "Eletrônica",
      pattern: /electronic|electronica|dance|house|techno|edm|trance|dubstep|electro/i,
    },
    { genre: "R&B", pattern: /r&b|rnb|soul|neo[\s-]?soul/i },
    { genre: "Reggae", pattern: /reggae|dancehall|reggaeton/i },
    { genre: "Pop", pattern: /\bpop\b|k[\s-]?pop|j[\s-]?pop/i },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(text)) return rule.genre;
  }
  return null;
}

async function lookupDeezerGenre(title: string, artist: string): Promise<string | null> {
  const { term } = cleanTrackQuery(title, artist);
  if (!term) return null;

  const searchUrl = new URL("https://api.deezer.com/search");
  searchUrl.searchParams.set("q", term);
  searchUrl.searchParams.set("limit", "5");

  const searchRes = await fetch(searchUrl.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 0 },
  });
  if (!searchRes.ok) return null;

  const searchJson = (await searchRes.json()) as {
    data?: Array<{ album?: { id?: number } }>;
  };
  const albumId = searchJson.data?.find((item) => item.album?.id)?.album?.id;
  if (!albumId) return null;

  const albumRes = await fetch(`https://api.deezer.com/album/${albumId}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 0 },
  });
  if (!albumRes.ok) return null;

  const albumJson = (await albumRes.json()) as {
    genres?: { data?: Array<{ name?: string }> };
  };

  return albumJson.genres?.data?.find((g) => g.name?.trim())?.name?.trim() ?? null;
}

async function lookupItunesGenre(title: string, artist: string): Promise<string | null> {
  const { term } = cleanTrackQuery(title, artist);
  if (!term) return null;

  for (const country of ["BR", "US"] as const) {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", term);
    url.searchParams.set("media", "music");
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", "5");
    url.searchParams.set("country", country);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 0 },
    });
    if (!res.ok) continue;

    const json = (await res.json()) as {
      results?: Array<{ primaryGenreName?: string }>;
    };
    for (const item of json.results ?? []) {
      const raw = item.primaryGenreName?.trim();
      if (raw) return raw;
    }
  }
  return null;
}

/**
 * Resolve o gênero: Deezer → iTunes → heurística local.
 * Sempre retorna um MusicGenre para persistir e evitar reconsultas.
 */
export async function resolveTrackGenre(
  title: string,
  artist: string,
): Promise<MusicGenre> {
  const heuristic = classifyGenre(title, artist);

  try {
    const deezer = await lookupDeezerGenre(title, artist);
    if (deezer) {
      const mapped = mapExternalGenre(deezer);
      if (mapped) {
        // Deezer costuma marcar trap como Rap/Hip Hop
        if (mapped === "Rap" && heuristic === "Trap") return "Trap";
        return mapped;
      }
    }
  } catch {
    // tenta iTunes
  }

  try {
    const itunes = await lookupItunesGenre(title, artist);
    if (itunes) {
      const mapped = mapExternalGenre(itunes);
      if (mapped) {
        if (mapped === "Rap" && heuristic === "Trap") return "Trap";
        return mapped;
      }
    }
  } catch {
    // fallback abaixo
  }

  return heuristic;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function resolveMissingGenres(
  tracks: Array<{ id: string; title: string; artist: string; genre?: string | null }>,
): Promise<Array<{ trackId: string; genre: MusicGenre }>> {
  const missing = tracks.filter((t) => !t.genre || !isMusicGenre(t.genre));
  if (missing.length === 0) return [];

  return mapPool(missing, 3, async (track) => {
    const genre = await resolveTrackGenre(track.title, track.artist);
    return { trackId: track.id, genre };
  });
}
