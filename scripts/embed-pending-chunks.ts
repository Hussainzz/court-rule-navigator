import { loadEnvConfig } from "@next/env";
import { and, asc, eq, isNull } from "drizzle-orm";

import { documents, ruleChunks, rules } from "../src/db/schema";
import { buildEmbeddingText } from "../src/embeddings/build-embedding-text";
import { embedTexts } from "../src/embeddings/embed-text";

loadEnvConfig(process.cwd());

const defaultBatchSize = 8;

async function main() {
  const [documentId, rawBatchSize] = process.argv.slice(2);
  const batchSize = rawBatchSize
    ? Number(rawBatchSize)
    : defaultBatchSize;

  if (!documentId) {
    throw new Error("Provide a document id.");
  }

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 32) {
    throw new Error("Batch size must be a whole number from 1 to 32.");
  }

  const { db } = await import("../src/db/client");

  try {
    const pendingChunks = await db
      .select({
        documentId: ruleChunks.documentId,
        ruleNumber: ruleChunks.ruleNumber,
        chunkIndex: ruleChunks.chunkIndex,
        courtName: documents.courtName,
        documentTitle: documents.title,
        versionLabel: documents.versionLabel,
        sectionNumber: rules.sectionNumber,
        sectionTitle: rules.sectionTitle,
        ruleTitle: rules.title,
        ruleStatus: rules.status,
        movedTo: rules.movedTo,
        subsectionLabel: ruleChunks.subsectionLabel,
        content: ruleChunks.content,
      })
      .from(ruleChunks)
      .innerJoin(
        rules,
        and(
          eq(rules.documentId, ruleChunks.documentId),
          eq(rules.ruleNumber, ruleChunks.ruleNumber),
        ),
      )
      .innerJoin(documents, eq(documents.id, ruleChunks.documentId))
      .where(
        and(
          eq(ruleChunks.documentId, documentId),
          isNull(ruleChunks.embedding),
        ),
      )
      .orderBy(asc(ruleChunks.ruleNumber), asc(ruleChunks.chunkIndex));

    if (pendingChunks.length === 0) {
      console.log(`No pending chunks for ${documentId}.`);
      return;
    }

    console.log(
      `Embedding ${pendingChunks.length} pending chunks in batches of ${batchSize}...`,
    );

    let model = "";

    for (let offset = 0; offset < pendingChunks.length; offset += batchSize) {
      const batch = pendingChunks.slice(offset, offset + batchSize);
      const embeddingTexts = batch.map(buildEmbeddingText);
      const result = await embedTexts(embeddingTexts);
      const embeddedAt = new Date();
      model = result.model;

      await db.transaction(async (transaction) => {
        for (const [index, chunk] of batch.entries()) {
          const embedding = result.embeddings[index];

          if (!embedding) {
            throw new Error(
              `Missing embedding for ${chunk.ruleNumber}/${chunk.chunkIndex}.`,
            );
          }

          await transaction
            .update(ruleChunks)
            .set({
              embedding,
              embeddingModel: result.model,
              embeddedAt,
            })
            .where(
              and(
                eq(ruleChunks.documentId, chunk.documentId),
                eq(ruleChunks.ruleNumber, chunk.ruleNumber),
                eq(ruleChunks.chunkIndex, chunk.chunkIndex),
                isNull(ruleChunks.embedding),
              ),
            );
        }
      });

      const completed = Math.min(offset + batch.length, pendingChunks.length);
      console.log(`Embedded ${completed}/${pendingChunks.length} pending chunks.`);
    }

    console.log({
      documentId,
      embedded: pendingChunks.length,
      model,
    });
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
