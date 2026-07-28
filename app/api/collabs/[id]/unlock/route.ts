import { NextResponse } from "next/server";
import { accessCookieName, unlockCollab } from "@/lib/collabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const body = (await request.json()) as { password?: string };
    const password = body.password?.trim() ?? "";
    if (!password) {
      return NextResponse.json({ error: "Informe a senha." }, { status: 400 });
    }

    const token = await unlockCollab(id, password);
    if (!token) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }

    if (token === "open") {
      return NextResponse.json({ ok: true, open: true });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(accessCookieName(id), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Falha ao desbloquear." }, { status: 500 });
  }
}
