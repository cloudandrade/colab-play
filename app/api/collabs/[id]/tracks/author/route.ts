import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  accessCookieName,
  assignTrackAuthor,
  getCollab,
  hasAccess,
  toDetail,
} from "@/lib/collabs";
import { getClientIp } from "@/lib/ip";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import {
  isValidCollabId,
  readJsonBody,
  sanitizeText,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Atribui autor (membro) a uma faixa sem figurinha — collabs privadas. */
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
    const limited = rateLimit(`track-author:${id}:${ip}`, {
      limit: 40,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Muitas atribuições. Aguarde um momento." },
        { status: 429, headers: rateLimitHeaders(limited, 40) },
      );
    }

    const collab = await getCollab(id, { claimOwnerIp: ip });
    if (!collab) {
      return NextResponse.json({ error: "Collab não encontrada." }, { status: 404 });
    }

    const jar = await cookies();
    const token = jar.get(accessCookieName(id))?.value;
    if (!hasAccess(collab, token)) {
      return NextResponse.json({ error: "Acesso bloqueado." }, { status: 403 });
    }

    if (collab.isOpen) {
      return NextResponse.json(
        { error: "Só collabs privadas usam autores." },
        { status: 400 },
      );
    }

    const parsed = await readJsonBody<{ trackId?: string; memberId?: string }>(
      request,
    );
    if (!parsed.ok) return parsed.response;

    const trackId = sanitizeText(parsed.data.trackId ?? "", 64);
    const memberId = sanitizeText(parsed.data.memberId ?? "", 64);
    if (!trackId || !memberId) {
      return NextResponse.json(
        { error: "Informe trackId e memberId." },
        { status: 400 },
      );
    }

    const updated = await assignTrackAuthor(id, trackId, memberId);
    if (!updated) {
      return NextResponse.json({ error: "Collab não encontrada." }, { status: 404 });
    }

    return NextResponse.json(
      { collab: toDetail(updated, false, ip) },
      { headers: rateLimitHeaders(limited, 40) },
    );
  } catch (error) {
    const message = (error as Error).message;
    if (message === "COLLAB_PUBLICA") {
      return NextResponse.json(
        { error: "Só collabs privadas usam autores." },
        { status: 400 },
      );
    }
    if (message === "MEMBRO_INVALIDO") {
      return NextResponse.json({ error: "Membro inválido." }, { status: 400 });
    }
    if (message === "FAIXA_NAO_ENCONTRADA") {
      return NextResponse.json({ error: "Faixa não encontrada." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Falha ao atribuir autor." },
      { status: 500 },
    );
  }
}
