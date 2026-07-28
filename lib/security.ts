import { NextResponse } from "next/server";

export const MAX_JSON_BYTES = 32 * 1024;
export const MAX_NAME_LENGTH = 60;
export const MAX_PASSWORD_LENGTH = 128;
export const MIN_PASSWORD_LENGTH = 3;
export const MAX_TRACK_TITLE = 200;
export const MAX_TRACK_ARTIST = 120;
export const MAX_TRACKS_PER_COLLAB = 200;
export const MAX_SEARCH_QUERY = 100;
export const MAX_ADMIN_CODE = 32;
export const YOUTUBE_ID_RE = /^[\w-]{11}$/;

export async function readJsonBody<T>(
  request: Request,
  maxBytes = MAX_JSON_BYTES,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Payload muito grande." },
        { status: 413 },
      ),
    };
  }

  const raw = await request.text();
  if (raw.length > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Payload muito grande." },
        { status: 413 },
      ),
    };
  }

  if (!raw.trim()) {
    return { ok: true, data: {} as T };
  }

  try {
    return { ok: true, data: JSON.parse(raw) as T };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "JSON inválido." }, { status: 400 }),
    };
  }
}

export function sanitizeText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

export function isSafeHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      host === "i.ytimg.com" ||
      /^i\d*\.ytimg\.com$/.test(host) ||
      host === "img.youtube.com" ||
      host.endsWith(".ytimg.com") ||
      host.endsWith(".googleusercontent.com") ||
      host.endsWith(".ggpht.com")
    );
  } catch {
    return false;
  }
}

export function isValidYoutubeId(id: string): boolean {
  return YOUTUBE_ID_RE.test(id);
}

export function isValidCollabId(id: string): boolean {
  return /^[a-f0-9]{16}$/i.test(id);
}
