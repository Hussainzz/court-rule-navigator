import { extractPdfPages } from "../src/ingestion/extract-pdf-pages";
import { loadSourceManifest } from "../src/ingestion/source-manifest";

const pagesToInspect = [1, 7, 8, 9, 10, 81];

async function main() {
  const [sourceDocument] = loadSourceManifest();

  if (!sourceDocument) {
    throw new Error("The source manifest is empty.");
  }

  const pdfPath = `data/source-documents/${sourceDocument.id}.pdf`;
  const extractedPdf = await extractPdfPages(pdfPath);

  pagesToInspect.forEach((pageNumber) => {
    const page = extractedPdf.pages[pageNumber - 1];

    if (!page) {
      throw new Error(`PDF page ${pageNumber} does not exist.`);
    }

    console.log({
      physicalPageNumber: page.pageNumber,
      firstLines: page.rawText.split("\n").slice(0, 4),
    });
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
