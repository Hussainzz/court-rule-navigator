CREATE TYPE "public"."rule_status" AS ENUM('current', 'withdrawn', 'moved');--> statement-breakpoint
CREATE TABLE "rules" (
	"document_id" text NOT NULL,
	"rule_number" text NOT NULL,
	"title" text NOT NULL,
	"status" "rule_status" NOT NULL,
	"moved_to" text,
	"content" text NOT NULL,
	"start_page_number" integer NOT NULL,
	"end_page_number" integer NOT NULL,
	CONSTRAINT "rules_document_id_rule_number_pk" PRIMARY KEY("document_id","rule_number"),
	CONSTRAINT "rules_page_range_check" CHECK ("rules"."start_page_number" <= "rules"."end_page_number")
);
--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_start_page_fk" FOREIGN KEY ("document_id","start_page_number") REFERENCES "public"."pages"("document_id","page_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_end_page_fk" FOREIGN KEY ("document_id","end_page_number") REFERENCES "public"."pages"("document_id","page_number") ON DELETE no action ON UPDATE no action;