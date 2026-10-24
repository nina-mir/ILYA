CREATE TABLE "gutenberg_catalog" (
	"gutenberg_id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"language" text NOT NULL,
	"source_url" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "gutenberg_catalog_search_idx" ON "gutenberg_catalog" USING gin (to_tsvector('simple', "title" || ' ' || "author"));