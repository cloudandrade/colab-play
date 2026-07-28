import { NextResponse } from "next/server";
import { youtubeArtworkCandidates } from "@/lib/artwork";
import { isValidYoutubeId } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isValidYoutubeId(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  for (const url of youtubeArtworkCandidates(id)) {
    try {
      const upstream = await fetch(url, {
        headers: { Accept: "image/*" },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 86_400 },
      });
      if (!upstream.ok) continue;

      const bytes = await upstream.arrayBuffer();
      if (bytes.byteLength < 100) continue;

      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") || "image/jpeg",
          "Cache-Control":
            "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    } catch {
      // tenta próximo candidato
    }
  }

  return new NextResponse(null, { status: 404 });
}
