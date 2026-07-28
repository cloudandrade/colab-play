/**
 * URL canônica no CDN do YouTube (~60 bytes no banco).
 * mqdefault (320×180) é suficiente para thumbs da fila — bem menor que hq/base64.
 */
export function youtubeArtworkUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function youtubeArtworkCandidates(videoId: string): string[] {
  return [
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/default.jpg`,
  ];
}

/** Path same-origin — evita CSP/referrer do browser ao carregar ytimg. */
export function artworkProxyPath(videoId: string): string {
  return `/api/artwork/${encodeURIComponent(videoId)}`;
}

const YOUTUBE_ID_RE = /^[\w-]{11}$/;

/** Sempre prefere URL derivada do ID YouTube (não depende do client). */
export function resolveStoredArtworkUrl(
  trackId: string,
  source: "youtube" | "audius",
  artworkUrl?: string | null,
): string | null {
  if (source === "youtube" && YOUTUBE_ID_RE.test(trackId)) {
    return youtubeArtworkUrl(trackId);
  }
  return artworkUrl?.trim() || null;
}
