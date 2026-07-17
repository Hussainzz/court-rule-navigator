import { loadEnvConfig } from "@next/env";
import { asc, eq } from "drizzle-orm";

import { pages } from "../src/db/schema";

loadEnvConfig(process.cwd());

const candidateHeadingPattern = /^(\d[\d.-]*-\d+)\.\s*(.*)$/;

type RuleCandidate = {
  pageNumber: number;
  printedPageLabel: string | null;
  ruleNumber: string;
  title: string;
};

function compareRuleNumbers(left: string, right: string): number {
  const [leftBase, leftLocal] = left.split("-").map(Number);
  const [rightBase, rightLocal] = right.split("-").map(Number);

  if (leftBase !== rightBase) {
    return leftBase - rightBase;
  }

  return leftLocal - rightLocal;
}

async function main() {
  const documentId = process.argv[2];

  if (!documentId) {
    throw new Error("Provide a document id to inspect.");
  }

  const { db } = await import("../src/db/client");

  try {
    const storedPages = await db
      .select({
        pageNumber: pages.pageNumber,
        printedPageLabel: pages.printedPageLabel,
        rawText: pages.rawText,
      })
      .from(pages)
      .where(eq(pages.documentId, documentId))
      .orderBy(asc(pages.pageNumber));

    const rulePages = storedPages.filter((page) =>
      /^CIV-\d+$/.test(page.printedPageLabel ?? ""),
    );
    const candidates: RuleCandidate[] = rulePages.flatMap((page) =>
      page.rawText.split("\n").flatMap((line) => {
        const match = line.trim().match(candidateHeadingPattern);

        if (!match) {
          return [];
        }

        return [
          {
            pageNumber: page.pageNumber,
            printedPageLabel: page.printedPageLabel,
            ruleNumber: match[1],
            title: match[2].trim(),
          },
        ];
      }),
    );
    const shapes = Map.groupBy(candidates, (candidate) =>
      candidate.ruleNumber.replace(/\d+/g, "N"),
    );
    const candidatesByNumber = Map.groupBy(
      candidates,
      (candidate) => candidate.ruleNumber,
    );
    const duplicates = [...candidatesByNumber.entries()].filter(
      ([, headings]) => headings.length > 1,
    );
    const missingTitles = candidates.filter(
      (candidate) => candidate.title.length === 0,
    );
    const withdrawn = candidates.filter((candidate) =>
      candidate.title.toLowerCase().includes("withdrawn"),
    );
    const outOfOrder = candidates.slice(1).flatMap((candidate, index) => {
      const previous = candidates[index];

      if (compareRuleNumbers(previous.ruleNumber, candidate.ruleNumber) < 0) {
        return [];
      }

      return [{ previous, candidate }];
    });
    const definiteMultiPageRules = candidates
      .slice(0, -1)
      .flatMap((candidate, index) => {
        const nextCandidate = candidates[index + 1];

        if (nextCandidate.pageNumber <= candidate.pageNumber + 1) {
          return [];
        }

        return [
          {
            ruleNumber: candidate.ruleNumber,
            startsOn: candidate.printedPageLabel,
            nextRuleNumber: nextCandidate.ruleNumber,
            nextRuleStartsOn: nextCandidate.printedPageLabel,
          },
        ];
      });

    console.log({
      inspectedPages: rulePages.length,
      candidateHeadings: candidates.length,
    });

    shapes.forEach((headings, shape) => {
      console.log({
        shape,
        count: headings.length,
        examples: headings.slice(0, 5),
      });
    });

    console.log({
      audit: {
        duplicateRuleNumbers: duplicates.length,
        missingTitles: missingTitles.length,
        withdrawnRules: withdrawn.length,
        orderingProblems: outOfOrder.length,
        definiteMultiPageRules: definiteMultiPageRules.length,
      },
      withdrawnExamples: withdrawn.slice(0, 5),
      multiPageExamples: definiteMultiPageRules.slice(0, 5),
    });
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
