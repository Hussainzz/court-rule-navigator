ALTER TABLE "rule_chunks" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "rule_chunks" ADD COLUMN "embedded_at" timestamp with time zone;