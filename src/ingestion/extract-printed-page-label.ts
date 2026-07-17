const printedPageLabelPattern = /\b([A-Z]+-(?:\d+|[ivxlcdm]+))\s*$/i;

export function extractPrintedPageLabel(rawText: string): string | null {
  const [firstLine = ""] = rawText.split("\n", 1);
  const match = firstLine.match(printedPageLabelPattern);

  return match?.[1] ?? null;
}
