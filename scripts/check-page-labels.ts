import { extractPdfPages } from "../src/ingestion/extract-pdf-pages";
import { loadSourceManifest } from "../src/ingestion/source-manifest";

async function main() {
  const [sourceDocument] = loadSourceManifest();

  if (!sourceDocument) {
    throw new Error("The source manifest is empty.");
  }

  const pdfPath = `data/source-documents/${sourceDocument.id}.pdf`;
  const extractedPdf = await extractPdfPages(pdfPath);
  const labels = extractedPdf.pages.map((page) => page.printedPageLabel);
  const missingLabels = labels.filter((label) => label === null);

  if (missingLabels.length > 0) {
    throw new Error(`${missingLabels.length} pages are missing printed labels.`);
  }

  if (new Set(labels).size !== labels.length) {
    throw new Error("Printed page labels are not unique.");
  }

  console.log({
    labelCount: labels.length,
    firstLabels: labels.slice(0, 10),
    lastLabel: labels.at(-1),
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
