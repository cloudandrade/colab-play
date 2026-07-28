import { NextResponse } from "next/server";
import { searchTracks } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchTracks(q, 8);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Falha na busca", results: [] },
      { status: 502 },
    );
  }
}
