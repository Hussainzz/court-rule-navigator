import { z } from "zod";

import sourceDocuments from "../../sources/documents.json";

const sourceDocumentSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    courtCode: z.string().min(1),
    courtName: z.string().min(1),
    title: z.string().min(1),
    documentType: z.string().min(1),
    versionLabel: z.string().min(1),
    status: z.enum(["current", "proposed", "superseded"]),
    sourcePageUrl: z.string().url(),
    downloadUrl: z.string().url(),
    format: z.literal("pdf"),
  })
  .strict();

const sourceManifestSchema = z
  .array(sourceDocumentSchema)
  .min(1)
  .superRefine((documents, context) => {
    const seenIds = new Set<string>();

    documents.forEach((document, index) => {
      if (seenIds.has(document.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate document id: ${document.id}`,
          path: [index, "id"],
        });
      }

      seenIds.add(document.id);
    });
  });

export type SourceDocument = z.infer<typeof sourceDocumentSchema>;

export function loadSourceManifest(): SourceDocument[] {
  return sourceManifestSchema.parse(sourceDocuments);
}
