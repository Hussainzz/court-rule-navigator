import { loadEnvConfig } from "@next/env";
import { join } from "node:path";

import { loadSourceManifest } from "../src/ingestion/source-manifest";

loadEnvConfig(process.cwd());

async function main() {
  const documentId = process.argv[2];

  if (!documentId) {
    throw new Error("Provide a document id to ingest.");
  }

  const sourceDocument = loadSourceManifest().find(
    (document) => document.id === documentId,
  );

  if (!sourceDocument) {
    throw new Error(`Document ${documentId} is not in the source manifest.`);
  }

  const pdfPath = join(
    process.cwd(),
    "data",
    "source-documents",
    `${sourceDocument.id}.pdf`,
  );
  const [{ db }, { ingestSourceDocument }] = await Promise.all([
    import("../src/db/client"),
    import("../src/ingestion/ingest-source-document"),
  ]);

  try {
    const result = await ingestSourceDocument(sourceDocument, pdfPath);
    console.log(result);
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
