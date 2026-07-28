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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const collab = await getCollab(id);
  if (!collab) {
    return NextResponse.json({ error: "Collab não encontrada." }, { status: 404 });
  }

  const jar = await cookies();
  const token = jar.get(accessCookieName(id))?.value;
  const allowed = hasAccess(collab, token);

  return NextResponse.json({
    collab: toDetail(collab, !allowed),
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      adminCode?: string;
      confirmOwner?: boolean;
    };

    const result = await deleteCollab(id, {
      clientIp: getClientIp(request),
      adminCode: body.adminCode,
      confirmOwner: Boolean(body.confirmOwner),
    });

    if ("deleted" in result) {
      return NextResponse.json({ ok: true });
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
