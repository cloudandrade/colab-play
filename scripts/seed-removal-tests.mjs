/**
 * Seed das collabs de teste para validar remoção de faixas.
 *
 * Uso: node scripts/seed-removal-tests.mjs
 *
 * No browser local o IP costuma ser 127.0.0.1 — as faixas "suas"
 * usam o hash desse IP para você conseguir testar sem spoofar header.
 */
import { createHash, randomBytes, scryptSync } from "crypto";
import { MongoClient } from "mongodb";

const URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/colabplay";
const SECRET =
  process.env.COLLAB_ACCESS_SECRET?.trim() || "colab-play-dev-access-secret";

const LOCAL_TEST_IP = "127.0.0.1";
const OWNER_IP = "10.0.0.1";
const VOTER_A_IP = "10.0.0.2";
const OTHER_ADDER_IP = "10.0.0.3";

function memberKeyFromIp(ip) {
  return createHash("sha256")
    .update(`member:${ip}:${SECRET}`)
    .digest("hex")
    .slice(0, 40);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function track(partial) {
  const id = partial.id;
  return {
    id,
    title: partial.title,
    artist: partial.artist,
    artworkUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    duration: partial.duration ?? 180,
    source: "youtube",
    streamUrl: `https://www.youtube.com/watch?v=${id}`,
    addedAt: partial.addedAt ?? new Date().toISOString(),
    addedByIp: partial.addedByIp,
    addedBy: partial.addedBy ?? null,
    addedByAvatar: partial.addedByAvatar ?? null,
    genre: partial.genre ?? null,
  };
}

/** IDs precisam ser 16 hex (isValidCollabId). */
const COLLAB_1_ID = "aaaaaaaa00000001";
const COLLAB_2_ID = "aaaaaaaa00000002";

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  const collabs = db.collection("collabs");
  const now = new Date().toISOString();

  const localKey = memberKeyFromIp(LOCAL_TEST_IP);
  const otherKey = memberKeyFromIp(OTHER_ADDER_IP);

  const teste1 = {
    id: COLLAB_1_ID,
    name: "teste 1",
    isOpen: true,
    passwordHash: null,
    adminCodeHash: hashPassword("ADM-TEST-0001"),
    creatorIp: OWNER_IP,
    createdAt: now,
    updatedAt: now,
    members: [],
    removalVotes: [],
    tracks: [
      track({
        id: "dQw4w9WgXcQ",
        title: "Never Gonna Give You Up (sua faixa)",
        artist: "Rick Astley",
        addedByIp: localKey,
        addedBy: "Você (mock local)",
        duration: 213,
      }),
      track({
        id: "kJQP7kiw5Fk",
        title: "Despacito (faixa de outra pessoa)",
        artist: "Luis Fonsi",
        addedByIp: otherKey,
        addedBy: "Outro usuário",
        duration: 282,
      }),
    ],
  };

  const teste2 = {
    id: COLLAB_2_ID,
    name: "teste 2",
    isOpen: true,
    passwordHash: null,
    adminCodeHash: hashPassword("ADM-TEST-0002"),
    creatorIp: OWNER_IP,
    createdAt: now,
    updatedAt: now,
    members: [],
    tracks: [
      track({
        id: "9bZkp7q19f0",
        title: "Gangnam Style (alvo do 2º voto)",
        artist: "PSY",
        addedByIp: otherKey,
        addedBy: "Outro",
        duration: 252,
      }),
      track({
        id: "fJ9rUzIMcZQ",
        title: "Bohemian Rhapsody (deve permanecer)",
        artist: "Queen",
        addedByIp: otherKey,
        addedBy: "Outro",
        duration: 354,
      }),
      track({
        id: "3JZ_D3ELwOQ",
        title: "See You Again (deve permanecer)",
        artist: "Wiz Khalifa",
        addedByIp: otherKey,
        addedBy: "Outro",
        duration: 229,
      }),
    ],
    // Cada faixa já tem 1 voto de VOTER_A — seu clique em UMA delas completa 2/2
    removalVotes: [
      { trackId: "9bZkp7q19f0", voterIps: [VOTER_A_IP] },
      { trackId: "fJ9rUzIMcZQ", voterIps: [VOTER_A_IP] },
      { trackId: "3JZ_D3ELwOQ", voterIps: [VOTER_A_IP] },
    ],
  };

  await collabs.deleteMany({ id: { $in: [COLLAB_1_ID, COLLAB_2_ID] } });
  await collabs.insertMany([teste1, teste2]);

  console.log("Seed OK\n");
  console.log("Cenário 1 — dono da faixa remove sem votos");
  console.log(`  URL: http://localhost:3000/collab/${COLLAB_1_ID}`);
  console.log("  - Dono da collab: IP mock 10.0.0.1 (não é você)");
  console.log("  - 'Never Gonna…': addedByIp = hash(127.0.0.1) → você remove direto");
  console.log("  - 'Despacito': de outro IP → só por votos");
  console.log("");
  console.log("Cenário 2 — 2º voto remove só a faixa clicada");
  console.log(`  URL: http://localhost:3000/collab/${COLLAB_2_ID}`);
  console.log("  - 3 faixas com 1/2 voto cada (IP mock 10.0.0.2)");
  console.log("  - Vote em 'Gangnam Style' → só ela some; as outras ficam 1/2");
  console.log("");
  console.log(`  localKey(127.0.0.1)=${localKey}`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
