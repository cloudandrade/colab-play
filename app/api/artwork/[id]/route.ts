import { NextResponse } from "next/server";
import { youtubeArtworkUrl } from "@/lib/artwork";
import { isValidYoutubeId } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Redireciona para o CDN do YouTube — evita bufferizar JPEG no heap do Node
 * (a causa mais comum de OOM com proxy de thumbs).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isValidYoutubeId(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  return NextResponse.redirect(youtubeArtworkUrl(id), {
    status: 302,
    headers: {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
