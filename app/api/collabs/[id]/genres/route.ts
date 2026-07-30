import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  accessCookieName,
  getCollab,
  hasAccess,
  setTrackGenres,
  toDetail,
} from "@/lib/collabs";
import { isMusicGenre } from "@/lib/genre";
import { resolveMissingGenres } from "@/lib/genre-lookup";
import { getClientIp } from "@/lib/ip";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { isValidCollabId, readJsonBody } from "@/lib/security";

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

/**
 * Resolve e persiste o gênero das faixas que ainda não têm.
 * O agrupamento visual continua só no cliente (como o shuffle).
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!isValidCollabId(id)) {
      return NextResponse.json({ error: "Collab inválida." }, { status: 400 });
    }

    const ip = getClientIp(_request);
    const limited = rateLimit(`genres:${ip}`, { limit: 10, windowMs: 60_000 });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Muitas consultas de estilo. Aguarde um momento." },
        { status: 429, headers: rateLimitHeaders(limited, 10) },
      );
    }

    const access = await requireAccess(id, ip);
    if ("error" in access) return access.error;

    const missing = access.collab.tracks.filter(
      (track) => !track.genre || !isMusicGenre(track.genre),
    );

    if (missing.length === 0) {
      return NextResponse.json(
        {
          collab: toDetail(access.collab, false, ip),
          resolved: 0,
          cached: access.collab.tracks.length,
        },
        { headers: rateLimitHeaders(limited, 10) },
      );
    }

    const resolved = await resolveMissingGenres(missing);
    const updated = await setTrackGenres(id, resolved);
    if (!updated) {
      return NextResponse.json({ error: "Collab não encontrada." }, { status: 404 });
    }

    return NextResponse.json(
      {
        collab: toDetail(updated, false, ip),
        resolved: resolved.length,
        cached: updated.tracks.length - resolved.length,
      },
      { headers: rateLimitHeaders(limited, 10) },
    );
  } catch {
    return NextResponse.json(
      { error: "Falha ao consultar estilos das faixas." },
      { status: 500 },
    );
  }
}

/** Altera manualmente o gênero de uma faixa (persistido no banco). */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!isValidCollabId(id)) {
      return NextResponse.json({ error: "Collab inválida." }, { status: 400 });
    }

    const ip = getClientIp(request);
    const limited = rateLimit(`genre-edit:${ip}`, { limit: 40, windowMs: 60_000 });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Muitas alterações de estilo. Aguarde um momento." },
        { status: 429, headers: rateLimitHeaders(limited, 40) },
      );
    }

    const access = await requireAccess(id, ip);
    if ("error" in access) return access.error;

    const parsed = await readJsonBody<{ trackId?: string; genre?: string }>(request);
    if (!parsed.ok) return parsed.response;

    const trackId =
      typeof parsed.data.trackId === "string" ? parsed.data.trackId.trim() : "";
    const genre =
      typeof parsed.data.genre === "string" ? parsed.data.genre.trim() : "";

    if (!trackId || !isMusicGenre(genre)) {
      return NextResponse.json(
        { error: "Informe trackId e um estilo válido." },
        { status: 400 },
      );
    }

    const exists = access.collab.tracks.some((track) => track.id === trackId);
    if (!exists) {
      return NextResponse.json({ error: "Faixa não encontrada." }, { status: 404 });
    }

    const updated = await setTrackGenres(id, [{ trackId, genre }]);
    if (!updated) {
      return NextResponse.json({ error: "Collab não encontrada." }, { status: 404 });
    }

    return NextResponse.json(
      { collab: toDetail(updated, false, ip) },
      { headers: rateLimitHeaders(limited, 40) },
    );
  } catch {
    return NextResponse.json(
      { error: "Falha ao alterar o estilo da faixa." },
      { status: 500 },
    );
  }
}
