import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { connectDb } from "@/lib/db";
import { sameIp } from "@/lib/ip";
import { CollabModel } from "@/lib/models/Collab";
import type {
  Collab,
  CollabDetail,
  CollabPublic,
  CreateCollabResult,
  DeleteCollabResult,
  PlaylistTrack,
} from "@/lib/types";

function getAccessSecret(): string {
  const secret = process.env.COLLAB_ACCESS_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("COLLAB_ACCESS_SECRET é obrigatório em produção.");
  }
  return "colab-play-dev-access-secret";
}

export const MAX_TRACKS_PER_COLLAB = 200;

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
  }>;
};

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
    tracks: (doc.tracks ?? []).map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      artworkUrl: track.artworkUrl ?? null,
      duration: track.duration ?? 0,
      source: track.source === "audius" ? "audius" : "youtube",
      streamUrl: track.streamUrl,
      addedAt: track.addedAt,
      ...(track.addedBy ? { addedBy: track.addedBy } : {}),
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

export function toDetail(collab: Collab, locked: boolean): CollabDetail {
  return {
    id: collab.id,
    name: collab.name,
    isOpen: collab.isOpen,
    createdAt: collab.createdAt,
    updatedAt: collab.updatedAt,
    locked,
    tracks: locked ? [] : collab.tracks,
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

export async function getCollab(id: string): Promise<Collab | null> {
  await connectDb();
  const doc = await CollabModel.findOne({ id }).lean().exec();
  if (!doc) return null;
  return toCollab(doc as CollabRecord);
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
    creatorIp: input.creatorIp ?? null,
    createdAt: now,
    updatedAt: now,
    tracks: [],
  };

  await CollabModel.create(collab);
  return { collab: toPublic(collab), adminCode };
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
    await CollabModel.updateOne(
      { id: collabId },
      {
        $push: { tracks: track },
        $set: { updatedAt: new Date().toISOString() },
      },
    ).exec();
  } else {
    await CollabModel.updateOne(
      { id: collabId },
      { $set: { updatedAt: new Date().toISOString() } },
    ).exec();
  }

  return getCollab(collabId);
}

export async function removeTrackFromCollab(
  collabId: string,
  trackId: string,
): Promise<Collab | null> {
  await connectDb();
  const result = await CollabModel.updateOne(
    { id: collabId },
    {
      $pull: { tracks: { id: trackId } },
      $set: { updatedAt: new Date().toISOString() },
    },
  ).exec();

  if (result.matchedCount === 0) return null;
  return getCollab(collabId);
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
