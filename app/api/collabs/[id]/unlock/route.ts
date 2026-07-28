import { NextResponse } from "next/server";
import { accessCookieName, unlockCollab } from "@/lib/collabs";
import { getClientIp } from "@/lib/ip";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import {
  isValidCollabId,
  MAX_PASSWORD_LENGTH,
  readJsonBody,
  sanitizeText,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isValidCollabId(id)) {
    return NextResponse.json({ error: "Collab inválida." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const limited = rateLimit(`unlock:${id}:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde e tente de novo." },
      { status: 429, headers: rateLimitHeaders(limited, 10) },
    );
  }

  try {
    const parsed = await readJsonBody<{ password?: string }>(request);
    if (!parsed.ok) return parsed.response;

    const password = sanitizeText(parsed.data.password ?? "", MAX_PASSWORD_LENGTH);
    if (!password) {
      return NextResponse.json({ error: "Informe a senha." }, { status: 400 });
    }

    const token = await unlockCollab(id, password);
    if (!token) {
      return NextResponse.json(
        { error: "Senha incorreta." },
        { status: 401, headers: rateLimitHeaders(limited, 10) },
      );
    }

    if (token === "open") {
      return NextResponse.json({ ok: true, open: true });
    }

    const response = NextResponse.json(
      { ok: true },
      { headers: rateLimitHeaders(limited, 10) },
    );
    response.cookies.set(accessCookieName(id), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Falha ao desbloquear." }, { status: 500 });
  }
}
