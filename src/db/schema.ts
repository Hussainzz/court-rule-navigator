import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";

export const ruleStatus = pgEnum("rule_status", [
  "current",
  "withdrawn",
  "moved",
]);

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  courtCode: text("court_code").notNull(),
  courtName: text("court_name").notNull(),
  title: text("title").notNull(),
  documentType: text("document_type").notNull(),
  versionLabel: text("version_label").notNull(),
  status: text("status").notNull(),
  sourcePageUrl: text("source_page_url").notNull(),
  downloadUrl: text("download_url").notNull(),
  format: text("format").notNull(),
  pageCount: integer("page_count").notNull(),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true })
    .notNull(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const pages = pgTable(
  "pages",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    printedPageLabel: text("printed_page_label"),
    rawText: text("raw_text").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.pageNumber] }),
  ],
);

export const rules = pgTable(
  "rules",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    ruleNumber: text("rule_number").notNull(),
    sectionNumber: text("section_number"),
    sectionTitle: text("section_title"),
    title: text("title").notNull(),
    status: ruleStatus("status").notNull(),
    movedTo: text("moved_to"),
    content: text("content").notNull(),
    startPageNumber: integer("start_page_number").notNull(),
    endPageNumber: integer("end_page_number").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.ruleNumber] }),
    foreignKey({
      name: "rules_start_page_fk",
      columns: [table.documentId, table.startPageNumber],
      foreignColumns: [pages.documentId, pages.pageNumber],
    }),
    foreignKey({
      name: "rules_end_page_fk",
      columns: [table.documentId, table.endPageNumber],
      foreignColumns: [pages.documentId, pages.pageNumber],
    }),
    check(
      "rules_page_range_check",
      sql`${table.startPageNumber} <= ${table.endPageNumber}`,
    ),
  ],
);

export const ruleChunks = pgTable(
  "rule_chunks",
  {
    documentId: text("document_id").notNull(),
    ruleNumber: text("rule_number").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    subsectionLabel: text("subsection_label"),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 768 }),
    embeddingModel: text("embedding_model"),
    embeddedAt: timestamp("embedded_at", { withTimezone: true }),
    startPageNumber: integer("start_page_number").notNull(),
    endPageNumber: integer("end_page_number").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.documentId, table.ruleNumber, table.chunkIndex],
    }),
    foreignKey({
      name: "rule_chunks_rule_fk",
      columns: [table.documentId, table.ruleNumber],
      foreignColumns: [rules.documentId, rules.ruleNumber],
    }).onDelete("cascade"),
    foreignKey({
      name: "rule_chunks_start_page_fk",
      columns: [table.documentId, table.startPageNumber],
      foreignColumns: [pages.documentId, pages.pageNumber],
    }),
    foreignKey({
      name: "rule_chunks_end_page_fk",
      columns: [table.documentId, table.endPageNumber],
      foreignColumns: [pages.documentId, pages.pageNumber],
    }),
    check("rule_chunks_index_check", sql`${table.chunkIndex} > 0`),
    check(
      "rule_chunks_page_range_check",
      sql`${table.startPageNumber} <= ${table.endPageNumber}`,
    ),
  ],
);
