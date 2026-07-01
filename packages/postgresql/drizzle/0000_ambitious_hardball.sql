CREATE TABLE "lti_clients" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"platform_name" varchar(255) NOT NULL,
	"iss" varchar(255) NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"auth_url" text NOT NULL,
	"token_url" text NOT NULL,
	"jwks_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lti_deployments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"deployment_id" varchar(255) NOT NULL,
	"deployment_name" varchar(255),
	"deployment_description" text,
	"client_id" varchar(36) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lti_nonces" (
	"nonce" varchar(255) PRIMARY KEY NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lti_registration_sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lti_sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lti_deployments" ADD CONSTRAINT "lti_deployments_client_id_lti_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."lti_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lti_clients_issuer_client_idx" ON "lti_clients" USING btree ("client_id","iss");--> statement-breakpoint
CREATE UNIQUE INDEX "lti_clients_iss_client_id_uniq" ON "lti_clients" USING btree ("iss","client_id");--> statement-breakpoint
CREATE INDEX "lti_deployments_deployment_id_idx" ON "lti_deployments" USING btree ("deployment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lti_deployments_client_deployment_uniq" ON "lti_deployments" USING btree ("client_id","deployment_id");--> statement-breakpoint
CREATE INDEX "lti_registration_sessions_expires_at_idx" ON "lti_registration_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "lti_sessions_expires_at_idx" ON "lti_sessions" USING btree ("expires_at");