import { NextResponse } from "next/server";
import { createCollab, listCollabs } from "@/lib/collabs";
import { getClientIp } from "@/lib/ip";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { readJsonBody, sanitizeText, MAX_NAME_LENGTH } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`collabs:list:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: rateLimitHeaders(limited, 60) },
    );
  }

  const collabs = await listCollabs();
  return NextResponse.json(
    { collabs },
    { headers: rateLimitHeaders(limited, 60) },
  );
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`collabs:create:${ip}`, { limit: 8, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Limite de criação atingido. Aguarde um minuto." },
      { status: 429, headers: rateLimitHeaders(limited, 8) },
    );
  }

  try {
    const parsed = await readJsonBody<{
      name?: string;
      isOpen?: boolean;
      password?: string;
    }>(request);
    if (!parsed.ok) return parsed.response;

    const result = await createCollab({
      name: sanitizeText(parsed.data.name ?? "", MAX_NAME_LENGTH),
      isOpen: parsed.data.isOpen !== false,
      password: parsed.data.password,
      creatorIp: ip,
    });

    return NextResponse.json(result, {
      status: 201,
      headers: rateLimitHeaders(limited, 8),
    });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "NOME_OBRIGATORIO") {
      return NextResponse.json({ error: "Informe o nome da collab." }, { status: 400 });
    }
    if (message === "SENHA_OBRIGATORIA") {
      return NextResponse.json(
        { error: "Collabs fechadas precisam de senha." },
        { status: 400 },
      );
    }
    if (message === "SENHA_CURTA") {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 3 caracteres." },
        { status: 400 },
      );
    }
    if (message === "SENHA_LONGA") {
      return NextResponse.json(
        { error: "A senha deve ter no máximo 128 caracteres." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Falha ao criar collab." }, { status: 500 });
  }
}
