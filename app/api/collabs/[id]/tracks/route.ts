import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  accessCookieName,
  addTrackToCollab,
  getCollab,
  hasAccess,
  removeTrackFromCollab,
  toDetail,
} from "@/lib/collabs";
import type { PlaylistTrack } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAccess(id: string) {
  const collab = await getCollab(id);
  if (!collab) return { error: NextResponse.json({ error: "Collab não encontrada." }, { status: 404 }) };
  const jar = await cookies();
  const token = jar.get(accessCookieName(id))?.value;
  if (!hasAccess(collab, token)) {
    return { error: NextResponse.json({ error: "Acesso bloqueado." }, { status: 403 }) };
  }
  return { collab };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireAccess(id);
  if ("error" in access && access.error) return access.error;

  try {
    const body = (await request.json()) as Partial<PlaylistTrack>;
    if (!body.id || !body.title || !body.artist) {
      return NextResponse.json(
        { error: "Campos obrigatórios: id, title, artist" },
        { status: 400 },
      );
    }

    const source = body.source === "audius" ? "audius" : "youtube";
    const track: PlaylistTrack = {
      id: String(body.id),
      title: String(body.title),
      artist: String(body.artist),
      artworkUrl: body.artworkUrl ?? null,
      duration: Number(body.duration) || 0,
      source,
      streamUrl:
        source === "youtube"
          ? `https://www.youtube.com/watch?v=${encodeURIComponent(String(body.id))}`
          : `/api/stream?id=${encodeURIComponent(String(body.id))}`,
      addedAt: new Date().toISOString(),
      ...(body.addedBy ? { addedBy: String(body.addedBy) } : {}),
    };

    const updated = await addTrackToCollab(id, track);
    if (!updated) {
      return NextResponse.json({ error: "Collab não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ collab: toDetail(updated, false) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Falha ao adicionar faixa." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireAccess(id);
  if ("error" in access && access.error) return access.error;

  const trackId = new URL(request.url).searchParams.get("trackId");
  if (!trackId) {
    return NextResponse.json({ error: "Parâmetro trackId é obrigatório." }, { status: 400 });
  }

  const updated = await removeTrackFromCollab(id, trackId);
  if (!updated) {
    return NextResponse.json({ error: "Collab não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ collab: toDetail(updated, false) });
}
