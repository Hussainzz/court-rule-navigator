CREATE TABLE "pages" (
	"document_id" text NOT NULL,
	"page_number" integer NOT NULL,
	"printed_page_label" text,
	"raw_text" text NOT NULL,
	CONSTRAINT "pages_document_id_page_number_pk" PRIMARY KEY("document_id","page_number")
);
--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;