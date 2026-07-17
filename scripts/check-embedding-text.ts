import { loadEnvConfig } from "@next/env";
import { and, eq, inArray } from "drizzle-orm";

import { documents, ruleChunks, rules } from "../src/db/schema";
import { activeCourtRules } from "../src/config/court-rules";
import { buildEmbeddingText } from "../src/embeddings/build-embedding-text";

loadEnvConfig(process.cwd());

async function main() {
  const documentId = activeCourtRules.documentId;
  const { db } = await import("../src/db/client");

  try {
    const examples = await db
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
          inArray(ruleChunks.ruleNumber, ["3-7", "5-1", "5-2"]),
          eq(ruleChunks.chunkIndex, 1),
        ),
      );

    examples.forEach((example) => {
      console.log(`\n--- Rule ${example.ruleNumber} ---\n`);
      console.log(buildEmbeddingText(example));
    });
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
