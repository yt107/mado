CREATE TABLE "calendar_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"widget_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url_encrypted" "bytea" NOT NULL,
	"color" text NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_subscriptions_name_length_check" CHECK (char_length("calendar_subscriptions"."name") between 1 and 50)
);
--> statement-breakpoint
CREATE TABLE "news_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"widget_id" uuid NOT NULL,
	"title" text NOT NULL,
	"feed_url" text NOT NULL,
	"sort_order" integer NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_feeds_widget_id_feed_url_unique" UNIQUE("widget_id","feed_url"),
	CONSTRAINT "news_feeds_title_length_check" CHECK (char_length("news_feeds"."title") between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "calendar_subscriptions" ADD CONSTRAINT "calendar_subscriptions_widget_id_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_feeds" ADD CONSTRAINT "news_feeds_widget_id_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_subscriptions_widget_id_idx" ON "calendar_subscriptions" USING btree ("widget_id");