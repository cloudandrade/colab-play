import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

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
  },
  {
    collection: "collabs",
    versionKey: false,
  },
);

export type CollabDocument = InferSchemaType<typeof collabSchema>;

export const CollabModel: Model<CollabDocument> =
  (models.Collab as Model<CollabDocument>) ||
  model<CollabDocument>("Collab", collabSchema);
