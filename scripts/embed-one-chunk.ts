import { loadEnvConfig } from "@next/env";
import { and, eq } from "drizzle-orm";

import { documents, ruleChunks, rules } from "../src/db/schema";
import { buildEmbeddingText } from "../src/embeddings/build-embedding-text";
import { embedText } from "../src/embeddings/embed-text";

loadEnvConfig(process.cwd());

async function main() {
  const [documentId, ruleNumber, rawChunkIndex] = process.argv.slice(2);
  const chunkIndex = Number(rawChunkIndex);

  if (!documentId || !ruleNumber || !Number.isInteger(chunkIndex)) {
    throw new Error("Provide a document id, rule number, and chunk index.");
  }

  const { db } = await import("../src/db/client");

  try {
    const [chunk] = await db
      .select({
        courtName: documents.courtName,
        documentTitle: documents.title,
        versionLabel: documents.versionLabel,
        ruleNumber: rules.ruleNumber,
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
          eq(ruleChunks.ruleNumber, ruleNumber),
          eq(ruleChunks.chunkIndex, chunkIndex),
        ),
      );

    if (!chunk) {
      throw new Error(
        `Chunk ${documentId}/${ruleNumber}/${chunkIndex} was not found.`,
      );
    }

    const embeddingText = buildEmbeddingText(chunk);
    const result = await embedText(embeddingText);
    const embeddedAt = new Date();

    await db
      .update(ruleChunks)
      .set({
        embedding: result.embedding,
        embeddingModel: result.model,
        embeddedAt,
      })
      .where(
        and(
          eq(ruleChunks.documentId, documentId),
          eq(ruleChunks.ruleNumber, ruleNumber),
          eq(ruleChunks.chunkIndex, chunkIndex),
        ),
      );

    console.log({
      documentId,
      ruleNumber,
      chunkIndex,
      model: result.model,
      dimensions: result.embedding.length,
      firstFiveValues: result.embedding.slice(0, 5),
      embeddedAt,
    });
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
