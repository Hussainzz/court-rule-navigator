import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { extractPrintedPageLabel } from "./extract-printed-page-label";

export type ExtractedPage = {
  pageNumber: number;
  printedPageLabel: string | null;
  rawText: string;
};

export type ExtractedPdf = {
  pageCount: number;
  pages: ExtractedPage[];
};

export async function extractPdfPages(pdfPath: string): Promise<ExtractedPdf> {
  const pdfBytes = await readFile(pdfPath);
  const pdf = await getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const pages: ExtractedPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const rawText = textContent.items
        .filter((item) => "str" in item)
        .map((item) => `${item.str}${item.hasEOL ? "\n" : " "}`)
        .join("")
        .trim();

      pages.push({
        pageNumber,
        printedPageLabel: extractPrintedPageLabel(rawText),
        rawText,
      });
    }

    return {
      pageCount: pdf.numPages,
      pages,
    };
  } finally {
    await pdf.destroy();
  }
}
