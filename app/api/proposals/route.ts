import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { getClientIp } from "@/lib/ip";
import { createProposal } from "@/lib/models/Proposal";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { readJsonBody, sanitizeText } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`proposals:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Limite de propostas atingido. Tente mais tarde." },
      { status: 429, headers: rateLimitHeaders(limited, 5) },
    );
  }

  try {
    await connectDb();
    const parsed = await readJsonBody<{ text?: string }>(request);
    if (!parsed.ok) return parsed.response;

    await createProposal({
      text: sanitizeText(parsed.data.text ?? "", 2000),
      ip,
    });
    return NextResponse.json(
      { ok: true },
      { status: 201, headers: rateLimitHeaders(limited, 5) },
    );
  } catch (error) {
    const message = (error as Error).message;
    if (message === "TEXTO_OBRIGATORIO") {
      return NextResponse.json({ error: "Escreva sua proposta." }, { status: 400 });
    }
    if (message === "TEXTO_LONGO") {
      return NextResponse.json(
        { error: "A proposta deve ter no máximo 2000 caracteres." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Falha ao enviar proposta." }, { status: 500 });
  }
}
