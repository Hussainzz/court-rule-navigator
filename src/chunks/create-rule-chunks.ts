import type { ParsedRule, ParsedRuleLine } from "../rules/parse-rules";

const shortRuleLimit = 1_500;
const maximumChunkCharacters = 2_000;
const overlapCharacters = 200;
const subsectionPattern = /^\(([a-z])\)\s+/;

type RuleSection = {
  subsectionLabel: string | null;
  lines: ParsedRuleLine[];
};

export type RuleChunk = {
  ruleNumber: string;
  chunkIndex: number;
  subsectionLabel: string | null;
  content: string;
  startPageNumber: number;
  endPageNumber: number;
  startPageLabel: string | null;
  endPageLabel: string | null;
};

function linesToContent(lines: ParsedRuleLine[]): string {
  return lines.map((line) => line.text).join("\n").trim();
}

function splitAtTopLevelSubsections(lines: ParsedRuleLine[]): RuleSection[] {
  const sections: RuleSection[] = [];
  let currentSection: RuleSection = {
    subsectionLabel: null,
    lines: [],
  };
  let expectedLetterCode = "a".charCodeAt(0);

  for (const line of lines) {
    const subsection = line.text.match(subsectionPattern);
    const letter = subsection?.[1];
    const isExpectedTopLevelSubsection =
      letter?.charCodeAt(0) === expectedLetterCode;

    if (isExpectedTopLevelSubsection) {
      if (currentSection.lines.length > 0) {
        sections.push(currentSection);
      }

      currentSection = {
        subsectionLabel: `(${letter})`,
        lines: [line],
      };
      expectedLetterCode += 1;
      continue;
    }

    currentSection.lines.push(line);
  }

  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

function takeOverlap(lines: ParsedRuleLine[]): ParsedRuleLine[] {
  const overlap: ParsedRuleLine[] = [];
  let characters = 0;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    overlap.unshift(line);
    characters += line.text.length + 1;

    if (characters >= overlapCharacters) {
      break;
    }
  }

  return overlap;
}

function splitOversizedSection(section: RuleSection): RuleSection[] {
  if (linesToContent(section.lines).length <= maximumChunkCharacters) {
    return [section];
  }

  const parts: RuleSection[] = [];
  let currentLines: ParsedRuleLine[] = [];

  for (const line of section.lines) {
    const candidateLines = [...currentLines, line];

    if (
      currentLines.length > 0 &&
      linesToContent(candidateLines).length > maximumChunkCharacters
    ) {
      parts.push({
        subsectionLabel: section.subsectionLabel,
        lines: currentLines,
      });
      currentLines = takeOverlap(currentLines);

      while (
        currentLines.length > 0 &&
        linesToContent([...currentLines, line]).length >
          maximumChunkCharacters
      ) {
        currentLines.shift();
      }
    }

    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    parts.push({
      subsectionLabel: section.subsectionLabel,
      lines: currentLines,
    });
  }

  return parts;
}

function createChunk(
  rule: ParsedRule,
  section: RuleSection,
  chunkIndex: number,
): RuleChunk {
  const firstLine = section.lines[0];
  const lastLine = section.lines.at(-1);

  return {
    ruleNumber: rule.ruleNumber,
    chunkIndex,
    subsectionLabel: section.subsectionLabel,
    content: linesToContent(section.lines),
    startPageNumber: firstLine?.pageNumber ?? rule.startPageNumber,
    endPageNumber: lastLine?.pageNumber ?? rule.endPageNumber,
    startPageLabel: firstLine?.pageLabel ?? rule.startPageLabel,
    endPageLabel: lastLine?.pageLabel ?? rule.endPageLabel,
  };
}

export function createRuleChunks(rules: ParsedRule[]): RuleChunk[] {
  return rules.flatMap((rule) => {
    const sections =
      rule.content.length <= shortRuleLimit || rule.contentLines.length === 0
        ? [{ subsectionLabel: null, lines: rule.contentLines }]
        : splitAtTopLevelSubsections(rule.contentLines).flatMap(
            splitOversizedSection,
          );

    return sections.map((section, index) =>
      createChunk(rule, section, index + 1),
    );
  });
}
