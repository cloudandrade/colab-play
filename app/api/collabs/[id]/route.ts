import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  accessCookieName,
  deleteCollab,
  getCollab,
  hasAccess,
  toDetail,
} from "@/lib/collabs";
import { getClientIp } from "@/lib/ip";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import {
  isValidCollabId,
  MAX_ADMIN_CODE,
  readJsonBody,
  sanitizeText,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isValidCollabId(id)) {
    return NextResponse.json({ error: "Collab inválida." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const limited = rateLimit(`collab:get:${ip}`, { limit: 120, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas requisições." },
      { status: 429, headers: rateLimitHeaders(limited, 120) },
    );
  }

  const collab = await getCollab(id, { claimOwnerIp: ip });
  if (!collab) {
    return NextResponse.json({ error: "Collab não encontrada." }, { status: 404 });
  }

  const jar = await cookies();
  const token = jar.get(accessCookieName(id))?.value;
  const allowed = hasAccess(collab, token);

  return NextResponse.json(
    { collab: toDetail(collab, !allowed, ip) },
    { headers: rateLimitHeaders(limited, 120) },
  );
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
  const limited = rateLimit(`collab:delete:${id}:${ip}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas de exclusão." },
      { status: 429, headers: rateLimitHeaders(limited, 10) },
    );
  }

  try {
    const parsed = await readJsonBody<{
      adminCode?: string;
      confirmOwner?: boolean;
    }>(request);
    if (!parsed.ok) return parsed.response;

    const result = await deleteCollab(id, {
      clientIp: ip,
      adminCode: sanitizeText(parsed.data.adminCode ?? "", MAX_ADMIN_CODE),
      confirmOwner: Boolean(parsed.data.confirmOwner),
    });

    if ("deleted" in result) {
      return NextResponse.json(
        { ok: true },
        { headers: rateLimitHeaders(limited, 10) },
      );
    }
    if ("needsOwnerConfirm" in result) {
      return NextResponse.json({ needsOwnerConfirm: true }, { status: 409 });
    }
    if ("needsAdminCode" in result) {
      return NextResponse.json({ needsAdminCode: true }, { status: 403 });
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Falha ao excluir collab." }, { status: 500 });
  }
}
