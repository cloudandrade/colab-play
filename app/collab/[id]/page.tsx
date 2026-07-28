import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import CollabRoom from "@/components/CollabRoom";
import {
  accessCookieName,
  getCollab,
  hasAccess,
  toDetail,
} from "@/lib/collabs";

export const dynamic = "force-dynamic";

export default async function CollabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const collab = await getCollab(id);
  if (!collab) notFound();

  const jar = await cookies();
  const token = jar.get(accessCookieName(id))?.value;
  const allowed = hasAccess(collab, token);

  return <CollabRoom initialCollab={toDetail(collab, !allowed)} />;
}
