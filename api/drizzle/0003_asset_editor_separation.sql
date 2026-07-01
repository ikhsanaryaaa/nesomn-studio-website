CREATE TYPE "public"."editor_type" AS ENUM('scene_editor', 'product_3d_editor');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "editor_type" "editor_type" DEFAULT 'scene_editor' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "version" text DEFAULT '1.0.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "status" "asset_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "is_marketplace" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "is_subscription_asset" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "thumbnail" text;--> statement-breakpoint
UPDATE "assets" SET "editor_type" = 'product_3d_editor' WHERE "type" IN ('mockup3d', 'asset3d');--> statement-breakpoint
UPDATE "assets" SET "status" = 'published';
