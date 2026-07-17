import { extractPdfPages } from "../src/ingestion/extract-pdf-pages";
import { loadSourceManifest } from "../src/ingestion/source-manifest";

async function main() {
  const [sourceDocument] = loadSourceManifest();

  if (!sourceDocument) {
    throw new Error("The source manifest is empty.");
  }

  const pdfPath = `data/source-documents/${sourceDocument.id}.pdf`;
  const extractedPdf = await extractPdfPages(pdfPath);
  const firstPage = extractedPdf.pages[0];
  const lastPage = extractedPdf.pages.at(-1);

  if (extractedPdf.pages.length !== extractedPdf.pageCount) {
    throw new Error("The extracted page count does not match the PDF page count.");
  }

  extractedPdf.pages.forEach((page, index) => {
    const expectedPageNumber = index + 1;

    if (page.pageNumber !== expectedPageNumber) {
      throw new Error(
        `Expected page ${expectedPageNumber}, received page ${page.pageNumber}.`,
      );
    }
  });

  console.log({
    documentId: sourceDocument.id,
    reportedPageCount: extractedPdf.pageCount,
    extractedPageCount: extractedPdf.pages.length,
    firstPageNumber: firstPage?.pageNumber,
    lastPageNumber: lastPage?.pageNumber,
    firstPageCharacters: firstPage?.rawText.length,
    lastPageCharacters: lastPage?.rawText.length,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
