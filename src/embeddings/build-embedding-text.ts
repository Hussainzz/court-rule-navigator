type EmbeddingTextInput = {
  courtName: string;
  documentTitle: string;
  versionLabel: string;
  ruleNumber: string;
  sectionNumber: string | null;
  sectionTitle: string | null;
  ruleTitle: string;
  ruleStatus: "current" | "withdrawn" | "moved";
  movedTo: string | null;
  subsectionLabel: string | null;
  content: string;
};

export function buildEmbeddingText(input: EmbeddingTextInput): string {
  const status =
    input.ruleStatus === "moved"
      ? `moved to Rule ${input.movedTo}`
      : input.ruleStatus;
  const lines = [
    `Court: ${input.courtName}`,
    `Document: ${input.documentTitle} (${input.versionLabel})`,
  ];

  if (input.sectionTitle) {
    const sectionNumber = input.sectionNumber
      ? `${input.sectionNumber} — `
      : "";
    lines.push(`Section: ${sectionNumber}${input.sectionTitle}`);
  }

  lines.push(
    `Rule: ${input.ruleNumber} — ${input.ruleTitle}`,
    `Status: ${status}`,
  );

  if (input.subsectionLabel) {
    lines.push(`Subsection: ${input.subsectionLabel}`);
  }

  if (input.content) {
    lines.push(`Content: ${input.content}`);
  }

  return lines.join("\n");
}
