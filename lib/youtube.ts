import type { SearchResult } from "./types";

const PIPED_INSTANCES = (
  process.env.PIPED_API_BASES ??
  "https://api.piped.private.coffee,https://pipedapi.reallyaweso.me"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY?.trim();

interface PipedItem {
  type?: string;
  title?: string;
  url?: string;
  uploaderName?: string;
  duration?: number;
  thumbnail?: string;
}

interface PipedSearchResponse {
  items?: PipedItem[];
}

function extractVideoId(urlOrId: string): string | null {
  const raw = urlOrId.trim();
  if (/^[\w-]{11}$/.test(raw)) return raw;
  const match = raw.match(/[?&]v=([\w-]{11})/) || raw.match(/\/watch\?v=([\w-]{11})/);
  return match?.[1] ?? null;
}

function artworkFor(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function searchViaYouTubeDataApi(query: string, limit: number): Promise<SearchResult[]> {
  if (!YOUTUBE_API_KEY) return [];

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoCategoryId", "10");
  url.searchParams.set("maxResults", String(limit));
  url.searchParams.set("q", query);
  url.searchParams.set("key", YOUTUBE_API_KEY);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`YouTube Data API failed (${res.status})`);
  }

  const json = (await res.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
      };
    }>;
  };

  const results: SearchResult[] = [];
  for (const item of json.items ?? []) {
    const id = item.id?.videoId;
    if (!id) continue;
    results.push({
      id,
      title: item.snippet?.title?.trim() || "Sem título",
      artist: item.snippet?.channelTitle?.trim() || "YouTube",
      artworkUrl:
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        artworkFor(id),
      duration: 0,
      source: "youtube",
    });
    if (results.length >= limit) break;
  }
  return results;
}

async function searchViaPiped(query: string, limit: number): Promise<SearchResult[]> {
  let lastError: Error | null = null;

  for (const base of PIPED_INSTANCES) {
    try {
      const url = new URL("/search", base.endsWith("/") ? base : `${base}/`);
      url.searchParams.set("q", query);
      url.searchParams.set("filter", "music_songs");

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
        next: { revalidate: 0 },
      });

      if (!res.ok) {
        lastError = new Error(`Piped ${base} failed (${res.status})`);
        continue;
      }

      const json = (await res.json()) as PipedSearchResponse;
      const items = (json.items ?? []).filter((item) => item.type === "stream");

      const mapped: SearchResult[] = [];
      for (const item of items) {
        const id = extractVideoId(item.url ?? "");
        if (!id) continue;
        mapped.push({
          id,
          title: item.title?.trim() || "Sem título",
          artist: item.uploaderName?.trim() || "YouTube",
          artworkUrl: artworkFor(id),
          duration: Number(item.duration) || 0,
          source: "youtube",
        });
        if (mapped.length >= limit) break;
      }

      if (mapped.length > 0) return mapped;
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError ?? new Error("Nenhuma instância Piped respondeu");
}

export async function searchTracks(query: string, limit = 8): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (YOUTUBE_API_KEY) {
    try {
      const official = await searchViaYouTubeDataApi(trimmed, limit);
      if (official.length > 0) return official;
    } catch {
      // cai no Piped
    }
  }

  return searchViaPiped(trimmed, limit);
}
