import { loadEnvConfig } from "@next/env";

import { activeCourtRules } from "../src/config/court-rules";

loadEnvConfig(process.cwd());

const documentId = activeCourtRules.documentId;
type SearchExample = {
  query: string;
  acceptableRules: string[] | null;
};

const examples: SearchExample[] = [
  {
    query:
      "What must the parties do before asking the court to resolve a discovery dispute?",
    acceptableRules: ["37-1"],
  },
  {
    query: "What is the maximum length of an opposition brief?",
    acceptableRules: ["7-3", "7-4"],
  },
  {
    query:
      "Can a lawyer who is not admitted in this district appear in a particular case?",
    acceptableRules: ["11-3"],
  },
  {
    query: "How can I ask the court to move a filing deadline?",
    acceptableRules: ["6-3"],
  },
  {
    query: "When must the parties file their joint case management statement?",
    acceptableRules: ["16-9"],
  },
  {
    query: "What must I submit when requesting attorney's fees?",
    acceptableRules: ["54-5"],
  },
  {
    query: "How do I ask the judge to reconsider an order?",
    acceptableRules: ["7-9"],
  },
  {
    query: "How do I renew my driver's license?",
    acceptableRules: null,
  },
  {
    query: "What temperature should I use to bake a pizza?",
    acceptableRules: null,
  },
  {
    query: "How can I reset the password for my email account?",
    acceptableRules: null,
  },
  {
    query: "Will it rain tomorrow afternoon?",
    acceptableRules: null,
  },
  {
    query: "How do I cancel my gym membership?",
    acceptableRules: null,
  },
];

async function main() {
  const { db } = await import("../src/db/client");
  const { searchRuleChunks } = await import(
    "../src/search/search-rule-chunks"
  );

  try {
    const inDomainScores: number[] = [];
    const outOfDomainScores: number[] = [];
    let passed = 0;
    let inDomainCount = 0;

    for (const example of examples) {
      const results = await searchRuleChunks({
        documentId,
        query: example.query,
        limit: 3,
        minimumSimilarity: -1,
      });
      const [topResult] = results;

      if (!topResult) {
        throw new Error(`Search returned no rows for: ${example.query}`);
      }

      const acceptableRules = example.acceptableRules;
      const relevantRank =
        acceptableRules === null
          ? null
          : results.findIndex((result) =>
              acceptableRules.includes(result.ruleNumber),
            ) + 1;
      const outcome =
        example.acceptableRules === null
          ? "OUT-OF-SCOPE EXAMPLE"
          : relevantRank !== null && relevantRank > 0
            ? "PASS"
            : "FAIL";
      const topSimilarity = Number(topResult.similarity.toFixed(4));

      if (example.acceptableRules === null) {
        outOfDomainScores.push(topSimilarity);
      } else {
        inDomainCount += 1;
        inDomainScores.push(topSimilarity);

        if (outcome === "PASS") {
          passed += 1;
        }
      }

      console.log({
        query: example.query,
        acceptableRules: example.acceptableRules ?? "no relevant rule",
        retrievedRules: results.map((result) => result.ruleNumber),
        relevantRank:
          relevantRank !== null && relevantRank > 0 ? relevantRank : null,
        topSimilarity,
        outcome,
      });
    }

    const lowestInDomainScore = Math.min(...inDomainScores);
    const highestOutOfDomainScore = Math.max(...outOfDomainScores);
    const scoreGap = lowestInDomainScore - highestOutOfDomainScore;

    console.log("\nSummary");
    console.log({
      recallAt3: `${passed}/${inDomainCount}`,
      lowestInDomainScore,
      highestOutOfDomainScore,
      scoreGap: Number(scoreGap.toFixed(4)),
      candidateThreshold:
        scoreGap > 0
          ? Number(
              ((lowestInDomainScore + highestOutOfDomainScore) / 2).toFixed(4),
            )
          : "No clean threshold in this sample",
    });
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
