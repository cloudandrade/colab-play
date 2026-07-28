import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";
import { randomBytes } from "crypto";

const reportSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    text: { type: String, required: true, trim: true },
    page: { type: String, default: null },
    userAgent: { type: String, default: null },
    createdAt: { type: String, required: true },
    ip: { type: String, default: null },
  },
  {
    collection: "reports",
    versionKey: false,
  },
);

export type ReportDocument = InferSchemaType<typeof reportSchema>;

export const ReportModel: Model<ReportDocument> =
  (models.Report as Model<ReportDocument>) ||
  model<ReportDocument>("Report", reportSchema);

export async function createReport(input: {
  text: string;
  page?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<void> {
  const text = input.text.trim();
  if (!text) throw new Error("TEXTO_OBRIGATORIO");
  if (text.length > 2000) throw new Error("TEXTO_LONGO");

  await ReportModel.create({
    id: randomBytes(8).toString("hex"),
    text,
    page: input.page?.trim().slice(0, 500) || null,
    userAgent: input.userAgent?.trim().slice(0, 400) || null,
    createdAt: new Date().toISOString(),
    ip: input.ip ?? null,
  });
}
