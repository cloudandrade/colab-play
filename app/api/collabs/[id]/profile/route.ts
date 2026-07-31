import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  accessCookieName,
  getCollab,
  hasAccess,
  MAX_MEMBER_NAME,
  toDetail,
  upsertMemberProfile,
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!isValidCollabId(id)) {
      return NextResponse.json({ error: "Collab inválida." }, { status: 400 });
    }

    const ip = getClientIp(request);
    const limited = rateLimit(`profile:${id}:${ip}`, {
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde um momento." },
        { status: 429, headers: rateLimitHeaders(limited, 20) },
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
        { error: "Perfil só é usado em collabs privadas." },
        { status: 400 },
      );
    }

    const parsed = await readJsonBody<{ name?: string; avatarId?: string }>(
      request,
    );
    if (!parsed.ok) return parsed.response;

    const name = sanitizeText(parsed.data.name ?? "", MAX_MEMBER_NAME);
    const avatarId = sanitizeText(parsed.data.avatarId ?? "", 32);

    const updated = await upsertMemberProfile(id, ip, { name, avatarId });
    if (!updated) {
      return NextResponse.json({ error: "Collab não encontrada." }, { status: 404 });
    }

    return NextResponse.json(
      { collab: toDetail(updated, false, ip) },
      { headers: rateLimitHeaders(limited, 20) },
    );
  } catch (error) {
    const message = (error as Error).message;
    if (message === "NOME_OBRIGATORIO") {
      return NextResponse.json({ error: "Informe um nome." }, { status: 400 });
    }
    if (message === "AVATAR_INVALIDO") {
      return NextResponse.json({ error: "Escolha uma figurinha válida." }, { status: 400 });
    }
    if (message === "COLLAB_PUBLICA") {
      return NextResponse.json(
        { error: "Perfil só é usado em collabs privadas." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Falha ao salvar o perfil." },
      { status: 500 },
    );
  }
}
