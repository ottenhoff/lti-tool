CREATE TABLE "clients" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"iss" varchar(255) NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"auth_url" text NOT NULL,
	"token_url" text NOT NULL,
	"jwks_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"deployment_id" varchar(255) NOT NULL,
	"name" varchar(255),
	"description" text,
	"client_id" varchar(36) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nonces" (
	"nonce" varchar(255) PRIMARY KEY NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issuer_client_idx" ON "clients" USING btree ("client_id","iss");--> statement-breakpoint
CREATE UNIQUE INDEX "iss_client_id_unique" ON "clients" USING btree ("iss","client_id");--> statement-breakpoint
CREATE INDEX "deployment_id_idx" ON "deployments" USING btree ("deployment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_deployment_unique" ON "deployments" USING btree ("client_id","deployment_id");--> statement-breakpoint
CREATE INDEX "reg_sessions_expires_at_idx" ON "registration_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");
