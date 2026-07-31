export type TrackSource = "youtube" | "audius";

export const REMOVAL_VOTES_REQUIRED = 2;

export interface CollabMember {
  /** Hash do IP — só no servidor. */
  ipKey: string;
  name: string;
  avatarId: string;
  createdAt: string;
}

export interface MemberProfilePublic {
  /** Id público do membro (não é o IP). */
  id: string;
  name: string;
  avatarId: string;
}

export interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  duration: number;
  source: TrackSource;
  streamUrl: string;
  addedAt: string;
  /** Nome de quem adicionou (collabs privadas). */
  addedBy?: string;
  /** Id da figurinha de quem adicionou. */
  addedByAvatar?: string | null;
  /**
   * Hash do IP de quem adicionou — só no servidor.
   * Usado para backfill quando o membro define o perfil.
   */
  addedByIp?: string | null;
  /** Estilo resolvido (Deezer/iTunes/heurística). */
  genre?: string | null;
}

/** Track as sent to the client (includes vote state). */
export interface PlaylistTrackView extends PlaylistTrack {
  removalVoteCount: number;
  hasVoted: boolean;
  /** Pode remover na hora (dono da collab ou quem adicionou a faixa). */
  canRemoveDirectly: boolean;
}

export interface RemovalVote {
  trackId: string;
  voterIps: string[];
}

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  duration: number;
  source: TrackSource;
}

export interface Collab {
  id: string;
  name: string;
  isOpen: boolean;
  /** Present only in storage; never sent to the client. */
  passwordHash?: string | null;
  /** Present only in storage; never sent to the client. */
  adminCodeHash?: string | null;
  creatorIp?: string | null;
  createdAt: string;
  updatedAt: string;
  tracks: PlaylistTrack[];
  removalVotes: RemovalVote[];
  /** Membros de collabs privadas (ipKey nunca vai ao cliente). */
  members: CollabMember[];
}

export interface CollabPublic {
  id: string;
  name: string;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
  trackCount: number;
}

export interface CollabDetail {
  id: string;
  name: string;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
  tracks: PlaylistTrackView[];
  /** True when closed and the request is not unlocked yet. */
  locked: boolean;
  /** True when the request IP matches the collab creator. */
  isOwner: boolean;
  /** Votes needed for non-owners to remove a track. */
  removalVotesRequired: number;
  /** Privada desbloqueada sem perfil ainda — mostrar modal. */
  needsProfile: boolean;
  /** Perfil do visitante atual (se já escolheu). */
  myProfile: MemberProfilePublic | null;
  /** Membros da collab privada (sem dados sensíveis). */
  members: MemberProfilePublic[];
}

export interface CollabsStore {
  collabs: Collab[];
}

export interface CreateCollabResult {
  collab: CollabPublic;
  adminCode: string;
}

export type DeleteCollabResult =
  | { deleted: true }
  | { needsOwnerConfirm: true }
  | { needsAdminCode: true }
  | { error: string; status: number };

export type RemoveTrackResult =
  | {
      collab: Collab;
      removed: true;
      asOwner: boolean;
    }
  | {
      collab: Collab;
      removed: false;
      voteCount: number;
      votesRequired: number;
      /** voted = novo pedido; unvoted = cancelou o próprio voto */
      action: "voted" | "unvoted";
    }
  | { error: string; status: number };
