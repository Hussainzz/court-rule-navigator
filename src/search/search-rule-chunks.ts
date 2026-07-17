import {
  and,
  cosineDistance,
  eq,
  isNotNull,
  sql,
} from "drizzle-orm";

import { db } from "../db/client";
import { documents, ruleChunks, rules } from "../db/schema";
import { embedText } from "../embeddings/embed-text";

export const defaultMinimumSimilarity = 0.45;

type SearchRuleChunksInput = {
  documentId: string;
  query: string;
  limit?: number;
  minimumSimilarity?: number;
};

function normalizeForSectionMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function summarizeSqlParameter(parameter: unknown) {
  if (Array.isArray(parameter) && parameter.length === 768) {
    return `<embedding vector: ${parameter.length} values>`;
  }

  if (
    typeof parameter === "string" &&
    parameter.startsWith("[") &&
    parameter.endsWith("]") &&
    parameter.length > 1_000
  ) {
    return "<embedding vector: 768 values>";
  }

  return parameter;
}

export async function searchRuleChunks({
  documentId,
  query,
  limit = 3,
  minimumSimilarity = defaultMinimumSimilarity,
}: SearchRuleChunksInput) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new Error("Search query cannot be empty.");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("Search limit must be a whole number from 1 to 20.");
  }

  if (
    !Number.isFinite(minimumSimilarity) ||
    minimumSimilarity < -1 ||
    minimumSimilarity > 1
  ) {
    throw new Error("Minimum similarity must be a number from -1 to 1.");
  }

  const normalizedSectionQuery = normalizeForSectionMatch(normalizedQuery);
  const availableSections = await db
    .selectDistinct({
      sectionNumber: rules.sectionNumber,
      sectionTitle: rules.sectionTitle,
    })
    .from(rules)
    .where(
      and(
        eq(rules.documentId, documentId),
        isNotNull(rules.sectionNumber),
        isNotNull(rules.sectionTitle),
      ),
    );
  const matchedSection = availableSections.find((section) => {
    const normalizedTitle = normalizeForSectionMatch(
      section.sectionTitle ?? "",
    );
    const normalizedNumber = normalizeForSectionMatch(
      section.sectionNumber ?? "",
    );
    const titleWords = normalizedTitle.split(" ").filter(Boolean);
    const mentionsSectionTitle =
      titleWords.length > 1 &&
      ` ${normalizedSectionQuery} `.includes(` ${normalizedTitle} `);
    const mentionsSectionNumber =
      normalizedNumber.length > 0 &&
      ` ${normalizedSectionQuery} `.includes(
        ` section ${normalizedNumber} `,
      );

    return mentionsSectionTitle || mentionsSectionNumber;
  });
  const { embedding: queryEmbedding } = await embedText(normalizedQuery);
  const distance = cosineDistance(ruleChunks.embedding, queryEmbedding);

  const searchQuery = db
    .select({
      documentId: ruleChunks.documentId,
      courtName: documents.courtName,
      ruleNumber: ruleChunks.ruleNumber,
      sectionNumber: rules.sectionNumber,
      sectionTitle: rules.sectionTitle,
      ruleTitle: rules.title,
      ruleStatus: rules.status,
      chunkIndex: ruleChunks.chunkIndex,
      subsectionLabel: ruleChunks.subsectionLabel,
      content: ruleChunks.content,
      startPageNumber: ruleChunks.startPageNumber,
      endPageNumber: ruleChunks.endPageNumber,
      distance: distance.mapWith(Number),
      similarity: sql<number>`1 - (${distance})`.mapWith(Number),
    })
    .from(ruleChunks)
    .innerJoin(
      rules,
      and(
        eq(rules.documentId, ruleChunks.documentId),
        eq(rules.ruleNumber, ruleChunks.ruleNumber),
      ),
    )
    .innerJoin(documents, eq(documents.id, ruleChunks.documentId))
    .where(
      and(
        eq(ruleChunks.documentId, documentId),
        isNotNull(ruleChunks.embedding),
        matchedSection?.sectionNumber
          ? eq(rules.sectionNumber, matchedSection.sectionNumber)
          : undefined,
      ),
    )
    .orderBy(
      matchedSection?.sectionNumber
        ? sql`case when ${ruleChunks.ruleNumber} = ${`${matchedSection.sectionNumber}-1`} then 0 else 1 end`
        : distance,
      distance,
    )
    .limit(limit);
  const compiledQuery = searchQuery.toSQL();

  if (process.env.DEBUG_VECTOR_SEARCH === "true") {
    console.dir(
      {
        vectorSearch: {
          question: normalizedQuery,
          retrievalMode: matchedSection ? "section-title" : "semantic",
          matchedSection: matchedSection ?? null,
          embeddingDimensions: queryEmbedding.length,
          sql: compiledQuery.sql,
          parameters: compiledQuery.params.map(summarizeSqlParameter),
        },
      },
      { depth: null },
    );
  }

  const results = await searchQuery;

  const [bestResult] = results;

  if (matchedSection) {
    return results.map((result) => ({
      ...result,
      matchType: "section-title" as const,
    }));
  }

  if (!bestResult || bestResult.similarity < minimumSimilarity) {
    return [];
  }

  return results.filter(
    (result) => result.similarity >= minimumSimilarity,
  ).map((result) => ({
    ...result,
    matchType: "semantic" as const,
  }));
}
