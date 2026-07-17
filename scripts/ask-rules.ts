import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [documentId, ...questionParts] = process.argv.slice(2);
  const question = questionParts.join(" ").trim();

  if (!documentId || !question) {
    throw new Error("Provide a document id followed by a question.");
  }

  const { db } = await import("../src/db/client");
  const { answerRuleQuestion } = await import(
    "../src/answers/answer-rule-question"
  );

  try {
    const result = await answerRuleQuestion({ documentId, question });

    console.log(`\nQuestion: ${question}\n`);
    console.log(result.answer);

    if (result.sources.length > 0) {
      console.log("\nVerified sources:");

      result.sources.forEach((source) => {
        console.log(
          `[${source.citationNumber}] Rule ${source.ruleNumber} — ${source.ruleTitle} (${source.pageRange})`,
        );
      });
    }

    if (result.model) {
      console.log(`\nModel: ${result.model}`);
    }
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
