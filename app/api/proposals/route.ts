import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { getClientIp } from "@/lib/ip";
import { createProposal } from "@/lib/models/Proposal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await connectDb();
    const body = (await request.json()) as { text?: string };
    await createProposal({
      text: body.text ?? "",
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true }, { status: 201 });
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
