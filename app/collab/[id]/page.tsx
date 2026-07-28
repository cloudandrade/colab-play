import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import CollabRoom from "@/components/CollabRoom";
import {
  accessCookieName,
  getCollab,
  hasAccess,
  toDetail,
} from "@/lib/collabs";
import { normalizeIp } from "@/lib/ip";

export const dynamic = "force-dynamic";

function clientIpFromHeaders(headerList: Headers): string {
  const vercel = headerList.get("x-vercel-forwarded-for")?.trim();
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }
  const realIp = headerList.get("x-real-ip")?.trim();
  if (realIp) return normalizeIp(realIp);
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return normalizeIp(parts[parts.length - 1]);
  }
  return "127.0.0.1";
}

export default async function CollabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clientIp = clientIpFromHeaders(await headers());
  const collab = await getCollab(id, { claimOwnerIp: clientIp });
  if (!collab) notFound();

  const jar = await cookies();
  const token = jar.get(accessCookieName(id))?.value;
  const allowed = hasAccess(collab, token);

  return (
    <CollabRoom initialCollab={toDetail(collab, !allowed, clientIp)} />
  );
}
