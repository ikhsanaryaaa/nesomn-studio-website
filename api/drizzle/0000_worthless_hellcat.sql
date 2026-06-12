CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."credit_reason" AS ENUM('subscription_grant', 'topup', 'usage', 'refund', 'admin_adjust');--> statement-breakpoint
CREATE TYPE "public"."plan_segment" AS ENUM('individual', 'team', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'canceled', 'expired', 'pending');--> statement-breakpoint
CREATE TYPE "public"."asset_tier" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('font', 'mockup3d', 'mockup2d', 'asset3d', 'graphic', 'motion');--> statement-breakpoint
CREATE TYPE "public"."bundle_type" AS ENUM('preset', 'custom');--> statement-breakpoint
CREATE TYPE "public"."project_kind" AS ENUM('scene2d', 'scene3d');--> statement-breakpoint
CREATE TYPE "public"."ai_job_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."ai_tab" AS ENUM('scene', 'motion');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('asset', 'bundle', 'topup', 'subscription');--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"avatar_url" text,
	"google_id" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" "credit_reason" NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"balance_after" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"credits" integer NOT NULL,
	"price_idr" numeric(12, 2) NOT NULL,
	"price_usd" numeric(12, 2) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_packs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"segment" "plan_segment" NOT NULL,
	"cycle" "billing_cycle" NOT NULL,
	"price_idr" numeric(12, 2) DEFAULT '0' NOT NULL,
	"price_usd" numeric(12, 2) DEFAULT '0' NOT NULL,
	"credit_quota" integer DEFAULT 0 NOT NULL,
	"max_concurrent_sessions" integer,
	"editor_access" jsonb NOT NULL,
	"commercial" boolean DEFAULT false NOT NULL,
	"is_enterprise" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'pending' NOT NULL,
	"cycle" "billing_cycle" NOT NULL,
	"segment" "plan_segment" NOT NULL,
	"gateway" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "asset_type" NOT NULL,
	"tier" "asset_tier" DEFAULT 'free' NOT NULL,
	"price_idr" numeric(12, 2) DEFAULT '0' NOT NULL,
	"price_usd" numeric(12, 2) DEFAULT '0' NOT NULL,
	"previews" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"file_key" text,
	"glb_file" text,
	"uv_map_info" jsonb,
	"popular" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "bundle_items" (
	"bundle_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	CONSTRAINT "bundle_items_bundle_id_asset_id_pk" PRIMARY KEY("bundle_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "bundle_type" DEFAULT 'preset' NOT NULL,
	"previews" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" "project_kind" NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"thumbnail_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"kind" "ai_kind" NOT NULL,
	"status" "ai_job_status" DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"credit_cost" integer DEFAULT 0 NOT NULL,
	"result_url" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"kind" "ai_kind" NOT NULL,
	"model_name" text NOT NULL,
	"api_key_encrypted" text,
	"base_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"credit_cost" integer DEFAULT 0 NOT NULL,
	"tab" "ai_tab" NOT NULL,
	"tier_access" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_providers_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"order_id" uuid,
	"file_key" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"ref_type" text NOT NULL,
	"ref_id" text NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit_price_idr" numeric(12, 2) DEFAULT '0' NOT NULL,
	"unit_price_usd" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "order_type" NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"amount_idr" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_usd" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"gateway" text,
	"gateway_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "credit_ledger_user_id_idx" ON "credit_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_jobs_user_id_idx" ON "ai_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_jobs_status_idx" ON "ai_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "licenses_user_id_idx" ON "licenses" USING btree ("user_id");