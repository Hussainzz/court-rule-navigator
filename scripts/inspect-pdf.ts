import { extractPdfPages } from "../src/ingestion/extract-pdf-pages";
import { loadSourceManifest } from "../src/ingestion/source-manifest";

async function main() {
  const [sourceDocument] = loadSourceManifest();

  if (!sourceDocument) {
    throw new Error("The source manifest is empty.");
  }

  const pdfPath = `data/source-documents/${sourceDocument.id}.pdf`;
  const requestedPage = Number(process.argv[2] ?? "1");
  const extractedPdf = await extractPdfPages(pdfPath);

  if (
    !Number.isInteger(requestedPage) ||
    requestedPage < 1 ||
    requestedPage > extractedPdf.pageCount
  ) {
    throw new Error(`Page must be between 1 and ${extractedPdf.pageCount}.`);
  }

  const page = extractedPdf.pages[requestedPage - 1];

  console.log(`Document pages: ${extractedPdf.pageCount}`);
  console.log(`\n--- PDF page ${requestedPage} ---\n`);
  console.log(page?.rawText);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
