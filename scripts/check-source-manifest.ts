import { loadSourceManifest } from "../src/ingestion/source-manifest";

const documents = loadSourceManifest();

console.log({
  documentCount: documents.length,
  documentIds: documents.map((document) => document.id),
});
