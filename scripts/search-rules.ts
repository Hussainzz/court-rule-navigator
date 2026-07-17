import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [documentId, ...queryParts] = process.argv.slice(2);
  const query = queryParts.join(" ").trim();

  if (!documentId || !query) {
    throw new Error("Provide a document id followed by a search question.");
  }

  const { db } = await import("../src/db/client");
  const { searchRuleChunks } = await import(
    "../src/search/search-rule-chunks"
  );

  try {
    const results = await searchRuleChunks({ documentId, query, limit: 3 });

    console.log(`\nQuestion: ${query}\n`);

    if (results.length === 0) {
      console.log("No relevant court rules found.");
      return;
    }

    results.forEach((result, index) => {
      const pageRange =
        result.startPageNumber === result.endPageNumber
          ? `PDF page ${result.startPageNumber}`
          : `PDF pages ${result.startPageNumber}-${result.endPageNumber}`;

      console.log(`${index + 1}. Rule ${result.ruleNumber} — ${result.ruleTitle}`);
      console.log(`   Match type: ${result.matchType}`);
      console.log(`   Similarity: ${result.similarity.toFixed(4)}`);
      console.log(`   Source: ${pageRange}`);
      console.log(`   ${result.content}\n`);
    });
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
