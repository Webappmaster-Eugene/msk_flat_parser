CREATE TABLE "apartments" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"price" numeric,
	"price_per_meter" numeric,
	"area" numeric,
	"floor" integer,
	"rooms" integer,
	"address" text,
	"building" text,
	"link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apartments_external_id_profile_id_key" UNIQUE("external_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "bot_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"command" text NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parsed_apartments" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"price" numeric,
	"price_per_meter" numeric,
	"area" numeric,
	"floor" integer,
	"rooms" integer,
	"address" text,
	"building" text,
	"link" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_changed_at" timestamp with time zone,
	"previous_status" text,
	CONSTRAINT "parsed_apartments_external_id_profile_id_key" UNIQUE("external_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "parsing_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"profile_name" text NOT NULL,
	"total_apartments" integer DEFAULT 0 NOT NULL,
	"booked_apartments" integer DEFAULT 0 NOT NULL,
	"available_apartments" integer DEFAULT 0 NOT NULL,
	"error" text,
	"duration_ms" integer,
	"parsed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"username" text,
	"first_name" text,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "subscribers_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE INDEX "idx_apartments_profile" ON "apartments" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_apartments_status" ON "apartments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_apartments_external" ON "apartments" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_bot_usage_chat_id" ON "bot_usage" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_bot_usage_command" ON "bot_usage" USING btree ("command");--> statement-breakpoint
CREATE INDEX "idx_bot_usage_executed_at" ON "bot_usage" USING btree ("executed_at");--> statement-breakpoint
CREATE INDEX "idx_parsed_apartments_profile" ON "parsed_apartments" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_parsed_apartments_status" ON "parsed_apartments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_parsed_apartments_external" ON "parsed_apartments" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_parsed_apartments_last_seen" ON "parsed_apartments" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_parsing_history_profile" ON "parsing_history" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_parsing_history_parsed_at" ON "parsing_history" USING btree ("parsed_at");--> statement-breakpoint
CREATE INDEX "idx_subscribers_chat_id" ON "subscribers" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_subscribers_active" ON "subscribers" USING btree ("is_active");