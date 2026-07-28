export type TrackSource = "youtube" | "audius";

export const REMOVAL_VOTES_REQUIRED = 2;

export interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  duration: number;
  source: TrackSource;
  streamUrl: string;
  addedAt: string;
  addedBy?: string;
}

/** Track as sent to the client (includes vote state). */
export interface PlaylistTrackView extends PlaylistTrack {
  removalVoteCount: number;
  hasVoted: boolean;
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
