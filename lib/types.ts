export type TrackSource = "youtube" | "audius";

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
  tracks: PlaylistTrack[];
  /** True when closed and the request is not unlocked yet. */
  locked: boolean;
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
