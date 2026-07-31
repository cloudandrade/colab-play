import mongoose, {
  Schema,
  type InferSchemaType,
  type Model,
} from "mongoose";

const trackSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    artist: { type: String, required: true },
    artworkUrl: { type: String, default: null },
    duration: { type: Number, default: 0 },
    source: { type: String, enum: ["youtube", "audius"], default: "youtube" },
    streamUrl: { type: String, required: true },
    addedAt: { type: String, required: true },
    addedBy: { type: String, required: false },
    addedByAvatar: { type: String, default: null },
    addedByIp: { type: String, default: null },
    genre: { type: String, default: null },
  },
  { _id: false },
);

const removalVoteSchema = new Schema(
  {
    trackId: { type: String, required: true },
    voterIps: { type: [String], default: [] },
  },
  { _id: false },
);

const memberSchema = new Schema(
  {
    ipKey: { type: String, required: true },
    name: { type: String, required: true },
    avatarId: { type: String, required: true },
    createdAt: { type: String, required: true },
  },
  { _id: false },
);

const collabSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    isOpen: { type: Boolean, required: true, default: true },
    passwordHash: { type: String, default: null },
    adminCodeHash: { type: String, default: null },
    creatorIp: { type: String, default: null },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    tracks: { type: [trackSchema], default: [] },
    removalVotes: { type: [removalVoteSchema], default: [] },
    members: { type: [memberSchema], default: [] },
  },
  {
    collection: "collabs",
    versionKey: false,
    strict: true,
  },
);

export type CollabDocument = InferSchemaType<typeof collabSchema>;

export const CollabModel: Model<CollabDocument> =
  (mongoose.models.Collab as Model<CollabDocument>) ||
  mongoose.model<CollabDocument>("Collab", collabSchema);
