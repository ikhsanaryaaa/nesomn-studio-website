-- Additive portfolio tables only. No existing data is changed or seeded.
CREATE TABLE "portfolio_uploads" (
 "media_id" uuid PRIMARY KEY REFERENCES "media"("id") ON DELETE RESTRICT,
 "name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_works" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "slug" text NOT NULL UNIQUE,
 "title" text NOT NULL,
 "description" text NOT NULL DEFAULT '',
 "project_date" date,
 "client" text,
 "status" text NOT NULL DEFAULT 'draft',
 "is_sample" boolean NOT NULL DEFAULT false,
 "cover_media_id" uuid REFERENCES "portfolio_uploads"("media_id") ON DELETE RESTRICT,
 "link_label" text,
 "link_url" text,
 "revision" integer NOT NULL DEFAULT 1,
 "created_at" timestamptz NOT NULL DEFAULT now(),
 "updated_at" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "portfolio_status_check" CHECK ("status" IN ('draft','published')),
 CONSTRAINT "portfolio_revision_check" CHECK ("revision" > 0),
 CONSTRAINT "portfolio_link_pair_check" CHECK (("link_label" IS NULL) = ("link_url" IS NULL)),
 CONSTRAINT "portfolio_published_check" CHECK ("status" <> 'published' OR ("cover_media_id" IS NOT NULL AND "project_date" IS NOT NULL AND length(trim("description")) > 0))
);
--> statement-breakpoint
CREATE INDEX "portfolio_works_public_idx" ON "portfolio_works" ("status","project_date","created_at");
--> statement-breakpoint
CREATE TABLE "portfolio_gallery" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "work_id" uuid NOT NULL REFERENCES "portfolio_works"("id") ON DELETE CASCADE,
 "media_id" uuid NOT NULL REFERENCES "portfolio_uploads"("media_id") ON DELETE RESTRICT,
 "poster_media_id" uuid REFERENCES "portfolio_uploads"("media_id") ON DELETE RESTRICT,
 "alt" text NOT NULL DEFAULT '',
 "position" integer NOT NULL,
 CONSTRAINT "portfolio_gallery_position_unique" UNIQUE ("work_id","position"),
 CONSTRAINT "portfolio_gallery_position_check" CHECK ("position" >= 0)
);
