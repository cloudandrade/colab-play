import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { getClientIp } from "@/lib/ip";
import { createReport } from "@/lib/models/Report";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { readJsonBody, sanitizeText } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`reports:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Limite de reports atingido. Tente mais tarde." },
      { status: 429, headers: rateLimitHeaders(limited, 5) },
    );
  }

  try {
    await connectDb();
    const parsed = await readJsonBody<{ text?: string; page?: string }>(request);
    if (!parsed.ok) return parsed.response;

    await createReport({
      text: sanitizeText(parsed.data.text ?? "", 2000),
      page: sanitizeText(parsed.data.page ?? "", 500) || null,
      userAgent: sanitizeText(request.headers.get("user-agent") ?? "", 400) || null,
      ip,
    });
    return NextResponse.json(
      { ok: true },
      { status: 201, headers: rateLimitHeaders(limited, 5) },
    );
  } catch (error) {
    const message = (error as Error).message;
    if (message === "TEXTO_OBRIGATORIO") {
      return NextResponse.json(
        { error: "Descreva o problema encontrado." },
        { status: 400 },
      );
    }
    if (message === "TEXTO_LONGO") {
      return NextResponse.json(
        { error: "O report deve ter no máximo 2000 caracteres." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Falha ao enviar report." }, { status: 500 });
  }
}
