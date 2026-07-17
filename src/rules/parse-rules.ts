const pageHeaderPrefix = "USDC Local Civil Rules";
const ruleHeadingPattern = /^(\d+(?:\.\d+)?-\d+)\.\s+(.+)$/;
const sectionHeadingPattern =
  /^(\d+(?:\.\d+)?)\.?\s+([A-Z][A-Z0-9 ;,.&()/-]*)$/;
const withdrawnPattern = /\s*\[withdrawn\]\s*/i;
const movedPattern = /^\[moved to ([^\]]+)\]$/i;

export type RuleSourcePage = {
  pageNumber: number;
  printedPageLabel: string | null;
  rawText: string;
};

export type ParsedRuleLine = {
  text: string;
  pageNumber: number;
  pageLabel: string | null;
};

export type ParsedRule = {
  ruleNumber: string;
  sectionNumber: string | null;
  sectionTitle: string | null;
  title: string;
  status: "current" | "withdrawn" | "moved";
  movedTo: string | null;
  content: string;
  contentLines: ParsedRuleLine[];
  startPageNumber: number;
  endPageNumber: number;
  startPageLabel: string | null;
  endPageLabel: string | null;
};

type ActiveRule = Omit<ParsedRule, "content">;

type ActiveSection = {
  sectionNumber: string;
  sectionTitle: string;
};

function finishRule(activeRule: ActiveRule): ParsedRule {
  const [firstContentLine, secondContentLine] = activeRule.contentLines;
  const hasWrappedTitle =
    firstContentLine &&
    secondContentLine &&
    firstContentLine.text.length < 120 &&
    !firstContentLine.text.startsWith("(") &&
    !/[.!?;:]$/.test(firstContentLine.text) &&
    /^\(a\)\s+/.test(secondContentLine.text);

  if (hasWrappedTitle) {
    activeRule.title = `${activeRule.title} ${firstContentLine.text}`;
    activeRule.contentLines = activeRule.contentLines.slice(1);
  }

  return {
    ...activeRule,
    content: activeRule.contentLines
      .map((contentLine) => contentLine.text)
      .join("\n")
      .trim(),
  };
}

export function parseRules(sourcePages: RuleSourcePage[]): ParsedRule[] {
  const rules: ParsedRule[] = [];
  let activeRule: ActiveRule | null = null;
  let activeSection: ActiveSection | null = null;
  let skippingSectionHeading = false;

  for (const page of sourcePages) {
    if (!/^CIV-\d+$/.test(page.printedPageLabel ?? "")) {
      continue;
    }

    for (const rawLine of page.rawText.split("\n")) {
      const line = rawLine.trim();

      if (!line || line.startsWith(pageHeaderPrefix)) {
        continue;
      }

      const ruleHeading = line.match(ruleHeadingPattern);

      if (ruleHeading) {
        if (activeRule) {
          rules.push(finishRule(activeRule));
        }

        const rawTitle = ruleHeading[2].trim();
        const isWithdrawn = withdrawnPattern.test(rawTitle);
        const moved = rawTitle.match(movedPattern);

        activeRule = {
          ruleNumber: ruleHeading[1],
          sectionNumber: activeSection?.sectionNumber ?? null,
          sectionTitle: activeSection?.sectionTitle ?? null,
          title: moved
            ? `Moved to ${moved[1]}`
            : rawTitle.replace(withdrawnPattern, "").trim(),
          status: moved ? "moved" : isWithdrawn ? "withdrawn" : "current",
          movedTo: moved?.[1] ?? null,
          contentLines: [],
          startPageNumber: page.pageNumber,
          endPageNumber: page.pageNumber,
          startPageLabel: page.printedPageLabel,
          endPageLabel: page.printedPageLabel,
        };
        skippingSectionHeading = false;
        continue;
      }

      const sectionHeading = line.match(sectionHeadingPattern);

      if (sectionHeading) {
        if (activeRule) {
          rules.push(finishRule(activeRule));
          activeRule = null;
        }

        activeSection = {
          sectionNumber: sectionHeading[1],
          sectionTitle: sectionHeading[2].trim(),
        };
        skippingSectionHeading = true;
        continue;
      }

      if (skippingSectionHeading && line === line.toUpperCase()) {
        if (activeSection) {
          activeSection.sectionTitle = `${activeSection.sectionTitle} ${line}`;
        }

        continue;
      }

      skippingSectionHeading = false;

      if (activeRule) {
        activeRule.contentLines.push({
          text: line,
          pageNumber: page.pageNumber,
          pageLabel: page.printedPageLabel,
        });
        activeRule.endPageNumber = page.pageNumber;
        activeRule.endPageLabel = page.printedPageLabel;
      }
    }
  }

  if (activeRule) {
    rules.push(finishRule(activeRule));
  }

  return rules;
}
