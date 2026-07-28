/**
 * Seed local: collab pública com IP de dono diferente do seu.
 * Uso: npm run db:seed:votes
 */
import { connectDb } from "../lib/db";
import { CollabModel } from "../lib/models/Collab";
import { hashPassword } from "../lib/collabs";

const DEMO_ID = "cafebabe00000001";
const OWNER_IP = "203.0.113.77"; // TEST-NET (RFC 5737) — diferente do seu localhost

const tracks = [
  {
    id: "dQw4w9WgXcQ",
    title: "Never Gonna Give You Up",
    artist: "Rick Astley",
    artworkUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    duration: 213,
    source: "youtube" as const,
    streamUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    addedAt: new Date().toISOString(),
    addedBy: "demo",
  },
  {
    id: "kJQP7kiw5Fk",
    title: "Despacito",
    artist: "Luis Fonsi",
    artworkUrl: "https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg",
    duration: 282,
    source: "youtube" as const,
    streamUrl: "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
    addedAt: new Date().toISOString(),
    addedBy: "demo",
  },
  {
    id: "9bZkp7q19f0",
    title: "Gangnam Style",
    artist: "PSY",
    artworkUrl: "https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg",
    duration: 252,
    source: "youtube" as const,
    streamUrl: "https://www.youtube.com/watch?v=9bZkp7q19f0",
    addedAt: new Date().toISOString(),
    addedBy: "demo",
  },
];

async function main() {
  await connectDb();
  const now = new Date().toISOString();
  const adminCode = "ADM-DEMO-VOTE";

  await CollabModel.findOneAndUpdate(
    { id: DEMO_ID },
    {
      id: DEMO_ID,
      name: "Vote to Exclude Demo",
      isOpen: true,
      passwordHash: null,
      adminCodeHash: hashPassword(adminCode),
      creatorIp: OWNER_IP,
      createdAt: now,
      updatedAt: now,
      tracks,
      removalVotes: [],
    },
    { upsert: true, new: true },
  ).exec();

  console.log("Collab demo criada/atualizada:");
  console.log(`  id:        ${DEMO_ID}`);
  console.log(`  nome:      Vote to Exclude Demo`);
  console.log(`  dono IP:   ${OWNER_IP} (não é o seu)`);
  console.log(`  URL local: http://localhost:3000/collab/${DEMO_ID}`);
  console.log(`  admin:     ${adminCode}`);
  console.log("");
  console.log("Como testar:");
  console.log("  1. Abra a URL local acima");
  console.log("  2. Clique no badge de votos ao lado de uma faixa");
  console.log("  3. Deve registrar 1/2 — a faixa só sai com o 2º voto de outro IP");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
