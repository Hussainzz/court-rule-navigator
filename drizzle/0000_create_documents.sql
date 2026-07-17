CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"court_code" text NOT NULL,
	"court_name" text NOT NULL,
	"title" text NOT NULL,
	"document_type" text NOT NULL,
	"version_label" text NOT NULL,
	"status" text NOT NULL,
	"source_page_url" text NOT NULL,
	"download_url" text NOT NULL,
	"format" text NOT NULL,
	"page_count" integer NOT NULL,
	"downloaded_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
