CREATE TABLE "rule_chunks" (
	"document_id" text NOT NULL,
	"rule_number" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"subsection_label" text,
	"content" text NOT NULL,
	"start_page_number" integer NOT NULL,
	"end_page_number" integer NOT NULL,
	CONSTRAINT "rule_chunks_document_id_rule_number_chunk_index_pk" PRIMARY KEY("document_id","rule_number","chunk_index"),
	CONSTRAINT "rule_chunks_index_check" CHECK ("rule_chunks"."chunk_index" > 0),
	CONSTRAINT "rule_chunks_page_range_check" CHECK ("rule_chunks"."start_page_number" <= "rule_chunks"."end_page_number")
);
--> statement-breakpoint
ALTER TABLE "rule_chunks" ADD CONSTRAINT "rule_chunks_rule_fk" FOREIGN KEY ("document_id","rule_number") REFERENCES "public"."rules"("document_id","rule_number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_chunks" ADD CONSTRAINT "rule_chunks_start_page_fk" FOREIGN KEY ("document_id","start_page_number") REFERENCES "public"."pages"("document_id","page_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_chunks" ADD CONSTRAINT "rule_chunks_end_page_fk" FOREIGN KEY ("document_id","end_page_number") REFERENCES "public"."pages"("document_id","page_number") ON DELETE no action ON UPDATE no action;