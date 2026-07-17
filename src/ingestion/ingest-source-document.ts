import { stat } from "node:fs/promises";
import { eq } from "drizzle-orm";

import { createRuleChunks } from "../chunks/create-rule-chunks";
import { db } from "../db/client";
import { documents, pages, ruleChunks, rules } from "../db/schema";
import { parseRules } from "../rules/parse-rules";
import { extractPdfPages } from "./extract-pdf-pages";
import type { SourceDocument } from "./source-manifest";

export async function ingestSourceDocument(
  sourceDocument: SourceDocument,
  pdfPath: string,
) {
  const [fileStats, extractedPdf] = await Promise.all([
    stat(pdfPath),
    extractPdfPages(pdfPath),
  ]);

  if (extractedPdf.pages.length === 0) {
    throw new Error(`No pages were extracted from ${sourceDocument.id}.`);
  }

  const parsedRules = parseRules(extractedPdf.pages);

  if (parsedRules.length === 0) {
    throw new Error(`No rules were parsed from ${sourceDocument.id}.`);
  }

  const parsedChunks = createRuleChunks(parsedRules);

  if (parsedChunks.length === 0) {
    throw new Error(`No chunks were created from ${sourceDocument.id}.`);
  }

  const ingestedAt = new Date();
  const documentValues = {
    courtCode: sourceDocument.courtCode,
    courtName: sourceDocument.courtName,
    title: sourceDocument.title,
    documentType: sourceDocument.documentType,
    versionLabel: sourceDocument.versionLabel,
    status: sourceDocument.status,
    sourcePageUrl: sourceDocument.sourcePageUrl,
    downloadUrl: sourceDocument.downloadUrl,
    format: sourceDocument.format,
    pageCount: extractedPdf.pageCount,
    downloadedAt: fileStats.mtime,
    ingestedAt,
  };

  await db.transaction(async (transaction) => {
    await transaction
      .insert(documents)
      .values({
        id: sourceDocument.id,
        ...documentValues,
      })
      .onConflictDoUpdate({
        target: documents.id,
        set: documentValues,
      });

    await transaction
      .delete(ruleChunks)
      .where(eq(ruleChunks.documentId, sourceDocument.id));

    await transaction
      .delete(rules)
      .where(eq(rules.documentId, sourceDocument.id));

    await transaction
      .delete(pages)
      .where(eq(pages.documentId, sourceDocument.id));

    await transaction.insert(pages).values(
      extractedPdf.pages.map((page) => ({
        documentId: sourceDocument.id,
        pageNumber: page.pageNumber,
        printedPageLabel: page.printedPageLabel,
        rawText: page.rawText,
      })),
    );

    await transaction.insert(rules).values(
      parsedRules.map((rule) => ({
        documentId: sourceDocument.id,
        ruleNumber: rule.ruleNumber,
        sectionNumber: rule.sectionNumber,
        sectionTitle: rule.sectionTitle,
        title: rule.title,
        status: rule.status,
        movedTo: rule.movedTo,
        content: rule.content,
        startPageNumber: rule.startPageNumber,
        endPageNumber: rule.endPageNumber,
      })),
    );

    await transaction.insert(ruleChunks).values(
      parsedChunks.map((chunk) => ({
        documentId: sourceDocument.id,
        ruleNumber: chunk.ruleNumber,
        chunkIndex: chunk.chunkIndex,
        subsectionLabel: chunk.subsectionLabel,
        content: chunk.content,
        startPageNumber: chunk.startPageNumber,
        endPageNumber: chunk.endPageNumber,
      })),
    );
  });

  return {
    documentId: sourceDocument.id,
    documentCount: 1,
    pageCount: extractedPdf.pages.length,
    ruleCount: parsedRules.length,
    chunkCount: parsedChunks.length,
  };
}
