import { NextResponse } from "next/server";
import { createCollab, listCollabs } from "@/lib/collabs";
import { getClientIp } from "@/lib/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const collabs = await listCollabs();
  return NextResponse.json({ collabs });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      isOpen?: boolean;
      password?: string;
    };

    const result = await createCollab({
      name: body.name ?? "",
      isOpen: body.isOpen !== false,
      password: body.password,
      creatorIp: getClientIp(request),
    });

    return NextResponse.json(result, { status: 201 });
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
    return NextResponse.json({ error: "Falha ao criar collab." }, { status: 500 });
  }
}
