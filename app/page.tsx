import { listCollabs } from "@/lib/collabs";
import HomeLobby from "@/components/HomeLobby";

export const dynamic = "force-dynamic";

export default async function Home() {
  const collabs = await listCollabs();
  return <HomeLobby initialCollabs={collabs} />;
}
