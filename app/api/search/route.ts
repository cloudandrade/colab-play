import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { MAX_SEARCH_QUERY, sanitizeText } from "@/lib/security";
import { searchTracks } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`search:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas buscas. Aguarde um instante.", results: [] },
      { status: 429, headers: rateLimitHeaders(limited, 30) },
    );
  }

  const { searchParams } = new URL(request.url);
  const q = sanitizeText(searchParams.get("q") ?? "", MAX_SEARCH_QUERY);

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchTracks(q, 8);
    return NextResponse.json(
      { results },
      { headers: rateLimitHeaders(limited, 30) },
    );
  } catch {
    return NextResponse.json(
      { error: "Falha na busca", results: [] },
      { status: 502 },
    );
  }
}
