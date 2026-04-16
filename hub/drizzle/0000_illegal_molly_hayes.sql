CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"fingerprint" text,
	"status" text DEFAULT 'connected',
	"metadata" text NOT NULL,
	"resources" text,
	"fleets" text,
	"servers" text,
	"last_report_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "agents_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "formations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"description" text NOT NULL,
	"cpu" text NOT NULL,
	"memory" text NOT NULL,
	"tickrate" text NOT NULL,
	"yaml_config" text NOT NULL,
	"is_restricted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chariots_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"password" text,
	"role" text DEFAULT 'commander',
	CONSTRAINT "chariots_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_chariots_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."chariots_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_chariots_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."chariots_users"("id") ON DELETE cascade ON UPDATE no action;