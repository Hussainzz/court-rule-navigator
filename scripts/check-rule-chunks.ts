import { loadEnvConfig } from "@next/env";
import { asc, eq } from "drizzle-orm";

import { pages } from "../src/db/schema";
import { createRuleChunks } from "../src/chunks/create-rule-chunks";
import { parseRules } from "../src/rules/parse-rules";

loadEnvConfig(process.cwd());

async function main() {
  const documentId = process.argv[2];

  if (!documentId) {
    throw new Error("Provide a document id to chunk.");
  }

  const { db } = await import("../src/db/client");

  try {
    const sourcePages = await db
      .select({
        pageNumber: pages.pageNumber,
        printedPageLabel: pages.printedPageLabel,
        rawText: pages.rawText,
      })
      .from(pages)
      .where(eq(pages.documentId, documentId))
      .orderBy(asc(pages.pageNumber));
    const parsedRules = parseRules(sourcePages);
    const chunks = createRuleChunks(parsedRules);
    const contentLengths = chunks
      .map((chunk) => chunk.content.length)
      .filter((length) => length > 0)
      .sort((left, right) => left - right);
    const oversizedChunks = chunks.filter(
      (chunk) => chunk.content.length > 2_000,
    );
    const ruleFiveOneChunks = chunks.filter(
      (chunk) => chunk.ruleNumber === "5-1",
    );
    const unusuallyShortChunks = chunks.filter(
      (chunk) => chunk.content.length > 0 && chunk.content.length < 100,
    );

    if (oversizedChunks.length > 0) {
      throw new Error(`${oversizedChunks.length} chunks exceed 2,000 characters.`);
    }

    console.log({
      parsedRules: parsedRules.length,
      chunks: chunks.length,
      emptyChunks: chunks.filter((chunk) => chunk.content.length === 0).length,
      shortestNonEmptyChunk: contentLengths[0],
      medianNonEmptyChunk:
        contentLengths[Math.floor(contentLengths.length / 2)],
      longestChunk: contentLengths.at(-1),
      unusuallyShortChunks,
      ruleFiveOneChunks: ruleFiveOneChunks.map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        subsectionLabel: chunk.subsectionLabel,
        characters: chunk.content.length,
        startsOn: chunk.startPageLabel,
        endsOn: chunk.endPageLabel,
        preview: chunk.content.slice(0, 100),
      })),
    });
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
