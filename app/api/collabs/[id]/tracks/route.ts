import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveStoredArtworkUrl } from "@/lib/artwork";
import {
  accessCookieName,
  addTrackToCollab,
  findMember,
  getCollab,
  hasAccess,
  memberKeyFromIp,
  removeTrackFromCollab,
  toDetail,
} from "@/lib/collabs";
import { getClientIp } from "@/lib/ip";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import type { PlaylistTrack } from "@/lib/types";
import {
  isSafeHttpsUrl,
  isValidCollabId,
  isValidYoutubeId,
  MAX_TRACK_ARTIST,
  MAX_TRACK_TITLE,
  readJsonBody,
  sanitizeText,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAccess(id: string, clientIp?: string) {
  const collab = await getCollab(id, { claimOwnerIp: clientIp });
  if (!collab) {
    return {
      error: NextResponse.json({ error: "Collab não encontrada." }, { status: 404 }),
    };
  }
  const jar = await cookies();
  const token = jar.get(accessCookieName(id))?.value;
  if (!hasAccess(collab, token)) {
    return {
      error: NextResponse.json({ error: "Acesso bloqueado." }, { status: 403 }),
    };
  }
  return { collab };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isValidCollabId(id)) {
    return NextResponse.json({ error: "Collab inválida." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const limited = rateLimit(`tracks:add:${id}:${ip}`, {
    limit: 40,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas adições. Aguarde um pouco." },
      { status: 429, headers: rateLimitHeaders(limited, 40) },
    );
  }

  const access = await requireAccess(id, ip);
  if ("error" in access && access.error) return access.error;

  try {
    const parsed = await readJsonBody<Partial<PlaylistTrack>>(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const trackId = sanitizeText(body.id ?? "", 32);
    const title = sanitizeText(body.title ?? "", MAX_TRACK_TITLE);
    const artist = sanitizeText(body.artist ?? "", MAX_TRACK_ARTIST);

    if (!trackId || !title || !artist) {
      return NextResponse.json(
        { error: "Campos obrigatórios: id, title, artist" },
        { status: 400 },
      );
    }

    const source = body.source === "audius" ? "audius" : "youtube";
    if (source === "youtube" && !isValidYoutubeId(trackId)) {
      return NextResponse.json({ error: "ID do YouTube inválido." }, { status: 400 });
    }

    const artworkRaw =
      typeof body.artworkUrl === "string" ? body.artworkUrl.trim() : null;
    const artworkUrl =
      resolveStoredArtworkUrl(trackId, source, artworkRaw) ??
      (artworkRaw && isSafeHttpsUrl(artworkRaw) ? artworkRaw : null);

    // Collabs privadas exigem perfil (nome + figurinha) antes de adicionar.
    let addedBy: string | undefined;
    let addedByAvatar: string | undefined;
    let addedByIp: string | undefined;
    if (!access.collab.isOpen) {
      const member = findMember(access.collab, ip);
      if (!member) {
        return NextResponse.json(
          {
            error: "Escolha um nome e uma figurinha antes de adicionar faixas.",
            needsProfile: true,
          },
          { status: 403 },
        );
      }
      addedBy = member.name;
      addedByAvatar = member.avatarId;
      addedByIp = memberKeyFromIp(ip);
    }

    const track: PlaylistTrack = {
      id: trackId,
      title,
      artist,
      artworkUrl,
      duration: Math.min(Math.max(Number(body.duration) || 0, 0), 86_400),
      source,
      streamUrl:
        source === "youtube"
          ? `https://www.youtube.com/watch?v=${encodeURIComponent(trackId)}`
          : `/api/stream?id=${encodeURIComponent(trackId)}`,
      addedAt: new Date().toISOString(),
      ...(addedBy ? { addedBy } : {}),
      ...(addedByAvatar ? { addedByAvatar } : {}),
      ...(addedByIp ? { addedByIp } : {}),
    };

    const updated = await addTrackToCollab(id, track);
    if (!updated) {
      return NextResponse.json({ error: "Collab não encontrada." }, { status: 404 });
    }

    return NextResponse.json(
      { collab: toDetail(updated, false, ip) },
      { status: 201, headers: rateLimitHeaders(limited, 40) },
    );
  } catch (error) {
    if ((error as Error).message === "LIMITE_FAIXAS") {
      return NextResponse.json(
        { error: "Esta collab atingiu o limite de 200 faixas." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Falha ao adicionar faixa." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isValidCollabId(id)) {
    return NextResponse.json({ error: "Collab inválida." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const limited = rateLimit(`tracks:del:${id}:${ip}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas remoções. Aguarde um pouco." },
      { status: 429, headers: rateLimitHeaders(limited, 60) },
    );
  }

  const access = await requireAccess(id, ip);
  if ("error" in access && access.error) return access.error;

  const trackId = new URL(request.url).searchParams.get("trackId")?.trim() ?? "";
  if (!trackId || trackId.length > 64) {
    return NextResponse.json(
      { error: "Parâmetro trackId é obrigatório." },
      { status: 400 },
    );
  }

  const result = await removeTrackFromCollab(id, trackId, ip);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers: rateLimitHeaders(limited, 60) },
    );
  }

  return NextResponse.json(
    {
      collab: toDetail(result.collab, false, ip),
      removed: result.removed,
      ...(result.removed
        ? { asOwner: result.asOwner }
        : {
            voteCount: result.voteCount,
            votesRequired: result.votesRequired,
            action: result.action,
          }),
    },
    { headers: rateLimitHeaders(limited, 60) },
  );
}
