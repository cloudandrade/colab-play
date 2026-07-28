import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";
import { randomBytes } from "crypto";

const proposalSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: String, required: true },
    ip: { type: String, default: null },
  },
  {
    collection: "proposals",
    versionKey: false,
  },
);

export type ProposalDocument = InferSchemaType<typeof proposalSchema>;

export const ProposalModel: Model<ProposalDocument> =
  (models.Proposal as Model<ProposalDocument>) ||
  model<ProposalDocument>("Proposal", proposalSchema);

export async function createProposal(input: {
  text: string;
  ip?: string | null;
}): Promise<void> {
  const text = input.text.trim();
  if (!text) throw new Error("TEXTO_OBRIGATORIO");
  if (text.length > 2000) throw new Error("TEXTO_LONGO");

  await ProposalModel.create({
    id: randomBytes(8).toString("hex"),
    text,
    createdAt: new Date().toISOString(),
    ip: input.ip ?? null,
  });
}
