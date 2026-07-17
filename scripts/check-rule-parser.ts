import { loadEnvConfig } from "@next/env";
import { asc, eq } from "drizzle-orm";

import { pages } from "../src/db/schema";
import { parseRules, type ParsedRule } from "../src/rules/parse-rules";

loadEnvConfig(process.cwd());

function summarizeRule(rule: ParsedRule | undefined) {
  if (!rule) {
    return null;
  }

  return {
    ruleNumber: rule.ruleNumber,
    sectionNumber: rule.sectionNumber,
    sectionTitle: rule.sectionTitle,
    title: rule.title,
    status: rule.status,
    movedTo: rule.movedTo,
    startPageLabel: rule.startPageLabel,
    endPageLabel: rule.endPageLabel,
    contentCharacters: rule.content.length,
    contentPreview: rule.content.slice(0, 140),
  };
}

async function main() {
  const documentId = process.argv[2];

  if (!documentId) {
    throw new Error("Provide a document id to parse.");
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
    const withdrawnRules = parsedRules.filter(
      (rule) => rule.status === "withdrawn",
    );
    const movedRules = parsedRules.filter((rule) => rule.status === "moved");
    const unexpectedEmptyRules = parsedRules.filter(
      (rule) => rule.status === "current" && rule.content.length === 0,
    );
    const ruleOneFive = parsedRules.find(
      (rule) => rule.ruleNumber === "1-5",
    );

    console.log({
      parsedRules: parsedRules.length,
      firstRule: summarizeRule(parsedRules[0]),
      lastRule: summarizeRule(parsedRules.at(-1)),
      withdrawnRules: withdrawnRules.map(summarizeRule),
      movedRules: movedRules.map(summarizeRule),
      unexpectedEmptyRuleNumbers: unexpectedEmptyRules.map(
        (rule) => rule.ruleNumber,
      ),
      multiPageExample: summarizeRule(ruleOneFive),
    });
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
