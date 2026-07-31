import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { resolveStoredArtworkUrl } from "@/lib/artwork";
import { connectDb } from "@/lib/db";
import { hasCreatorIp, normalizeIp, sameIp } from "@/lib/ip";
import { CollabModel } from "@/lib/models/Collab";
import type {
  Collab,
  CollabDetail,
  CollabMember,
  CollabPublic,
  CreateCollabResult,
  DeleteCollabResult,
  MemberProfilePublic,
  PlaylistTrack,
  PlaylistTrackView,
  RemovalVote,
  RemoveTrackResult,
} from "@/lib/types";
import { REMOVAL_VOTES_REQUIRED } from "@/lib/types";
import { isAvatarId } from "@/lib/avatars";

function getAccessSecret(): string {
  const secret = process.env.COLLAB_ACCESS_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("COLLAB_ACCESS_SECRET é obrigatório em produção.");
  }
  return "colab-play-dev-access-secret";
}

export const MAX_TRACKS_PER_COLLAB = 200;
export const MAX_MEMBER_NAME = 24;
export { REMOVAL_VOTES_REQUIRED };

type CollabRecord = {
  id: string;
  name: string;
  isOpen: boolean;
  passwordHash?: string | null;
  adminCodeHash?: string | null;
  creatorIp?: string | null;
  createdAt: string;
  updatedAt: string;
  tracks?: Array<{
    id: string;
    title: string;
    artist: string;
    artworkUrl?: string | null;
    duration?: number;
    source?: string;
    streamUrl: string;
    addedAt: string;
    addedBy?: string | null;
    addedByAvatar?: string | null;
    addedByIp?: string | null;
    genre?: string | null;
  }>;
  removalVotes?: Array<{
    trackId: string;
    voterIps?: string[];
  }>;
  members?: Array<{
    ipKey: string;
    name: string;
    avatarId: string;
    createdAt: string;
  }>;
};

/** Chave estável do membro (hash do IP) — nunca enviada ao cliente. */
export function memberKeyFromIp(ip: string): string {
  return createHash("sha256")
    .update(`member:${normalizeIp(ip)}:${getAccessSecret()}`)
    .digest("hex")
    .slice(0, 40);
}

export function findMember(
  collab: Collab,
  clientIp?: string | null,
): CollabMember | null {
  if (!clientIp) return null;
  const key = memberKeyFromIp(clientIp);
  return collab.members.find((m) => m.ipKey === key) ?? null;
}

function toCollab(doc: CollabRecord): Collab {
  return {
    id: doc.id,
    name: doc.name,
    isOpen: doc.isOpen,
    passwordHash: doc.passwordHash ?? null,
    adminCodeHash: doc.adminCodeHash ?? null,
    creatorIp: doc.creatorIp ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    tracks: (doc.tracks ?? []).map((track) => {
      const source = track.source === "audius" ? "audius" : "youtube";
      return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        artworkUrl: resolveStoredArtworkUrl(
          track.id,
          source,
          track.artworkUrl ?? null,
        ),
        duration: track.duration ?? 0,
        source,
        streamUrl: track.streamUrl,
        addedAt: track.addedAt,
        ...(track.addedBy ? { addedBy: track.addedBy } : {}),
        ...(track.addedByAvatar ? { addedByAvatar: track.addedByAvatar } : {}),
        ...(track.addedByIp ? { addedByIp: track.addedByIp } : {}),
        ...(track.genre ? { genre: track.genre } : {}),
      };
    }),
    removalVotes: (doc.removalVotes ?? []).map((vote) => ({
      trackId: vote.trackId,
      voterIps: [...(vote.voterIps ?? [])],
    })),
    members: (doc.members ?? []).map((member) => ({
      ipKey: member.ipKey,
      name: member.name,
      avatarId: member.avatarId,
      createdAt: member.createdAt,
    })),
  };
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

function generateAdminCode(): string {
  const part = () => randomBytes(2).toString("hex").toUpperCase();
  return `ADM-${part()}-${part()}`;
}

export function makeAccessToken(collabId: string, passwordHash: string): string {
  return createHash("sha256")
    .update(`${collabId}:${passwordHash}:${getAccessSecret()}`)
    .digest("hex");
}

export function accessCookieName(collabId: string): string {
  return `collab_access_${collabId}`;
}

export function toPublic(collab: Collab): CollabPublic {
  return {
    id: collab.id,
    name: collab.name,
    isOpen: collab.isOpen,
    createdAt: collab.createdAt,
    updatedAt: collab.updatedAt,
    trackCount: collab.tracks.length,
  };
}

export function toDetail(
  collab: Collab,
  locked: boolean,
  clientIp?: string | null,
): CollabDetail {
  const isOwner = sameIp(collab.creatorIp, clientIp);
  const voteMap = new Map(
    (collab.removalVotes ?? []).map((vote) => [vote.trackId, vote.voterIps]),
  );
  const member = locked ? null : findMember(collab, clientIp);
  const myProfile: MemberProfilePublic | null = member
    ? { name: member.name, avatarId: member.avatarId }
    : null;
  const needsProfile = !collab.isOpen && !locked && !member;

  const tracks: PlaylistTrackView[] = locked
    ? []
    : collab.tracks.map((track) => {
        const voters = voteMap.get(track.id) ?? [];
        return {
          id: track.id,
          title: track.title,
          artist: track.artist,
          artworkUrl: track.artworkUrl,
          duration: track.duration,
          source: track.source,
          streamUrl: track.streamUrl,
          addedAt: track.addedAt,
          ...(track.addedBy ? { addedBy: track.addedBy } : {}),
          ...(track.addedByAvatar ? { addedByAvatar: track.addedByAvatar } : {}),
          ...(track.genre ? { genre: track.genre } : {}),
          removalVoteCount: voters.length,
          hasVoted: clientIp
            ? voters.some((ip) => sameIp(ip, clientIp))
            : false,
        };
      });

  return {
    id: collab.id,
    name: collab.name,
    isOpen: collab.isOpen,
    createdAt: collab.createdAt,
    updatedAt: collab.updatedAt,
    locked,
    isOwner,
    removalVotesRequired: REMOVAL_VOTES_REQUIRED,
    needsProfile,
    myProfile,
    tracks,
  };
}

export function hasAccess(
  collab: Collab,
  accessToken: string | undefined | null,
): boolean {
  if (collab.isOpen) return true;
  if (!collab.passwordHash || !accessToken) return false;
  const expected = makeAccessToken(collab.id, collab.passwordHash);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(accessToken);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function listCollabs(): Promise<CollabPublic[]> {
  await connectDb();
  const docs = await CollabModel.find({})
    .sort({ updatedAt: -1 })
    .lean()
    .exec();

  return docs.map((doc) => toPublic(toCollab(doc as CollabRecord)));
}

export async function getCollab(
  id: string,
  options?: { claimOwnerIp?: string | null },
): Promise<Collab | null> {
  await connectDb();
  const doc = await CollabModel.findOne({ id }).lean().exec();
  if (!doc) return null;
  const collab = toCollab(doc as CollabRecord);

  // Collabs antigas sem creatorIp: o primeiro acesso válido assume a posse.
  const claimIp = options?.claimOwnerIp
    ? normalizeIp(options.claimOwnerIp)
    : null;
  if (!hasCreatorIp(collab.creatorIp) && claimIp && claimIp !== "unknown") {
    const claimed = await CollabModel.collection.updateOne(
      {
        id,
        $or: [
          { creatorIp: null },
          { creatorIp: { $exists: false } },
          { creatorIp: "" },
          { creatorIp: "unknown" },
        ],
      },
      { $set: { creatorIp: claimIp } },
    );
    if (claimed.modifiedCount > 0 || claimed.upsertedCount > 0) {
      collab.creatorIp = claimIp;
    } else {
      // Outro processo pode ter reivindicado no meio tempo
      const fresh = await CollabModel.findOne({ id }).lean().exec();
      if (fresh) {
        return toCollab(fresh as CollabRecord);
      }
    }
  }

  return collab;
}

export async function createCollab(input: {
  name: string;
  isOpen: boolean;
  password?: string;
  creatorIp?: string | null;
}): Promise<CreateCollabResult> {
  const name = input.name.trim().slice(0, 60);
  if (!name) {
    throw new Error("NOME_OBRIGATORIO");
  }
  const password = input.password?.trim() ?? "";
  if (!input.isOpen) {
    if (!password) throw new Error("SENHA_OBRIGATORIA");
    if (password.length < 3) throw new Error("SENHA_CURTA");
    if (password.length > 128) throw new Error("SENHA_LONGA");
  }

  await connectDb();
  const now = new Date().toISOString();
  const adminCode = generateAdminCode();
  const collab: Collab = {
    id: randomBytes(8).toString("hex"),
    name,
    isOpen: input.isOpen,
    passwordHash: input.isOpen ? null : hashPassword(password),
    adminCodeHash: hashPassword(adminCode),
    creatorIp: input.creatorIp ? normalizeIp(input.creatorIp) : null,
    createdAt: now,
    updatedAt: now,
    tracks: [],
    removalVotes: [],
    members: [],
  };

  await CollabModel.create(collab);
  return { collab: toPublic(collab), adminCode };
}

/**
 * Define/atualiza o perfil do visitante numa collab privada e
 * faz backfill nas faixas já adicionadas por esse IP (quando houver addedByIp).
 */
export async function upsertMemberProfile(
  collabId: string,
  clientIp: string,
  input: { name: string; avatarId: string },
): Promise<Collab | null> {
  const name = input.name.trim().slice(0, MAX_MEMBER_NAME);
  if (!name) throw new Error("NOME_OBRIGATORIO");
  if (!isAvatarId(input.avatarId)) throw new Error("AVATAR_INVALIDO");

  await connectDb();
  const existing = await CollabModel.findOne({ id: collabId }).lean().exec();
  if (!existing) return null;

  const collab = toCollab(existing as CollabRecord);
  if (collab.isOpen) throw new Error("COLLAB_PUBLICA");

  const ipKey = memberKeyFromIp(clientIp);
  const now = new Date().toISOString();
  const nextMember: CollabMember = {
    ipKey,
    name,
    avatarId: input.avatarId,
    createdAt:
      collab.members.find((m) => m.ipKey === ipKey)?.createdAt ?? now,
  };

  const members = [
    ...collab.members.filter((m) => m.ipKey !== ipKey),
    nextMember,
  ];

  const tracks = collab.tracks.map((track) => {
    if (track.addedByIp !== ipKey) return track;
    return {
      ...track,
      addedBy: name,
      addedByAvatar: input.avatarId,
    };
  });

  // collection.updateOne evita strip de campos novos se o schema estiver cacheado no HMR
  await CollabModel.collection.updateOne(
    { id: collabId },
    {
      $set: {
        members,
        tracks,
        updatedAt: now,
      },
    },
  );

  return getCollab(collabId);
}

export async function unlockCollab(
  id: string,
  password: string,
): Promise<string | null> {
  const collab = await getCollab(id);
  if (!collab) return null;
  if (collab.isOpen) return "open";
  if (!collab.passwordHash) return null;
  if (!verifyPassword(password, collab.passwordHash)) return null;
  return makeAccessToken(id, collab.passwordHash);
}

export async function addTrackToCollab(
  collabId: string,
  track: PlaylistTrack,
): Promise<Collab | null> {
  await connectDb();
  const existing = await CollabModel.findOne({ id: collabId }).lean().exec();
  if (!existing) return null;

  const trackCount = (existing.tracks ?? []).length;
  const alreadyThere = (existing.tracks ?? []).some((item) => item.id === track.id);

  if (!alreadyThere && trackCount >= MAX_TRACKS_PER_COLLAB) {
    throw new Error("LIMITE_FAIXAS");
  }

  if (!alreadyThere) {
    await CollabModel.collection.updateOne(
      { id: collabId },
      {
        $push: { tracks: track },
        $set: { updatedAt: new Date().toISOString() },
      } as Record<string, unknown>,
    );
  } else {
    await CollabModel.collection.updateOne(
      { id: collabId },
      { $set: { updatedAt: new Date().toISOString() } },
    );
  }

  return getCollab(collabId);
}

export async function removeTrackFromCollab(
  collabId: string,
  trackId: string,
  clientIp: string,
): Promise<RemoveTrackResult> {
  const collab = await getCollab(collabId, { claimOwnerIp: clientIp });
  if (!collab) {
    return { error: "Collab não encontrada.", status: 404 };
  }

  const exists = collab.tracks.some((track) => track.id === trackId);
  if (!exists) {
    return { error: "Faixa não encontrada.", status: 404 };
  }

  const owner = sameIp(collab.creatorIp, clientIp);

  if (owner) {
    await connectDb();
    await CollabModel.updateOne(
      { id: collabId },
      {
        $pull: {
          tracks: { id: trackId },
          removalVotes: { trackId },
        },
        $set: { updatedAt: new Date().toISOString() },
      },
    ).exec();
    const updated = await getCollab(collabId);
    if (!updated) {
      return { error: "Collab não encontrada.", status: 404 };
    }
    return { collab: updated, removed: true, asOwner: true };
  }

  if (!clientIp || clientIp === "unknown") {
    return {
      error: "Não foi possível identificar seu IP para votar.",
      status: 400,
    };
  }

  const votes: RemovalVote[] = (collab.removalVotes ?? []).map((vote) => ({
    trackId: vote.trackId,
    voterIps: [...vote.voterIps],
  }));
  let entry = votes.find((vote) => vote.trackId === trackId);
  if (!entry) {
    entry = { trackId, voterIps: [] };
    votes.push(entry);
  }

  const alreadyVoted = entry.voterIps.some((ip) => sameIp(ip, clientIp));
  let action: "voted" | "unvoted";

  if (alreadyVoted) {
    entry.voterIps = entry.voterIps.filter((ip) => !sameIp(ip, clientIp));
    action = "unvoted";
  } else {
    entry.voterIps.push(clientIp);
    action = "voted";
  }

  const voteCount = entry.voterIps.length;
  const now = new Date().toISOString();
  const nextVotes =
    voteCount === 0
      ? votes.filter((vote) => vote.trackId !== trackId)
      : votes;

  if (voteCount >= REMOVAL_VOTES_REQUIRED) {
    await connectDb();
    await CollabModel.collection.updateOne(
      { id: collabId },
      {
        $pull: {
          tracks: { id: trackId },
          removalVotes: { trackId },
        },
        $set: { updatedAt: now },
      } as Record<string, unknown>,
    );
    const updated = await getCollab(collabId);
    if (!updated) {
      return { error: "Collab não encontrada.", status: 404 };
    }
    return { collab: updated, removed: true, asOwner: false };
  }

  await connectDb();
  // updateOne via collection evita strip de campos por schema cacheado no HMR
  await CollabModel.collection.updateOne(
    { id: collabId },
    {
      $set: {
        removalVotes: nextVotes,
        updatedAt: now,
      },
    },
  );

  const updated = await getCollab(collabId);
  if (!updated) {
    return { error: "Collab não encontrada.", status: 404 };
  }

  // Garante contagem correta na resposta mesmo se a leitura vier defasada
  const withVotes: Collab = {
    ...updated,
    removalVotes: nextVotes,
  };

  return {
    collab: withVotes,
    removed: false,
    voteCount,
    votesRequired: REMOVAL_VOTES_REQUIRED,
    action,
  };
}

export async function deleteCollab(
  id: string,
  options: {
    clientIp: string;
    adminCode?: string;
    confirmOwner?: boolean;
  },
): Promise<DeleteCollabResult> {
  const collab = await getCollab(id);
  if (!collab) {
    return { error: "Collab não encontrada.", status: 404 };
  }

  const isOwner = sameIp(collab.creatorIp, options.clientIp);

  if (isOwner) {
    if (!options.confirmOwner) {
      return { needsOwnerConfirm: true };
    }
    await connectDb();
    await CollabModel.deleteOne({ id }).exec();
    return { deleted: true };
  }

  const code = options.adminCode?.trim() ?? "";
  if (!code) {
    return { needsAdminCode: true };
  }

  if (!collab.adminCodeHash || !verifyPassword(code, collab.adminCodeHash)) {
    return { error: "Código de administrador inválido.", status: 401 };
  }

  await connectDb();
  await CollabModel.deleteOne({ id }).exec();
  return { deleted: true };
}

/**
 * Persiste gêneros resolvidos nas faixas (metadado compartilhado).
 * Não altera a ordem da playlist — o agrupamento visual continua só no cliente.
 */
export async function setTrackGenres(
  collabId: string,
  updates: Array<{ trackId: string; genre: string }>,
): Promise<Collab | null> {
  if (updates.length === 0) return getCollab(collabId);

  await connectDb();
  const existing = await CollabModel.findOne({ id: collabId }).lean().exec();
  if (!existing) return null;

  const byId = new Map(updates.map((u) => [u.trackId, u.genre]));
  const tracks = (existing.tracks ?? []).map((track) => {
    const genre = byId.get(track.id);
    if (!genre) return track;
    return { ...track, genre };
  });

  await CollabModel.updateOne(
    { id: collabId },
    {
      $set: {
        tracks,
        updatedAt: new Date().toISOString(),
      },
    },
  ).exec();

  return getCollab(collabId);
}
