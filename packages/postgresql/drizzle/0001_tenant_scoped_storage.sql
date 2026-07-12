ALTER TABLE "lti_clients" ADD COLUMN "tenant_id" varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE "lti_deployments" ADD COLUMN "tenant_id" varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE "lti_deployments" DROP CONSTRAINT "lti_deployments_client_id_lti_clients_id_fk";--> statement-breakpoint
ALTER TABLE "lti_clients" DROP CONSTRAINT "lti_clients_pkey";--> statement-breakpoint
ALTER TABLE "lti_clients" ADD CONSTRAINT "lti_clients_tenant_id_id_pk" PRIMARY KEY("tenant_id", "id");--> statement-breakpoint
ALTER TABLE "lti_deployments" DROP CONSTRAINT "lti_deployments_pkey";--> statement-breakpoint
ALTER TABLE "lti_deployments" ADD CONSTRAINT "lti_deployments_tenant_id_id_pk" PRIMARY KEY("tenant_id", "id");--> statement-breakpoint
DROP INDEX "lti_deployments_client_deployment_uniq";--> statement-breakpoint
CREATE UNIQUE INDEX "lti_deployments_client_deployment_uniq" ON "lti_deployments" USING btree ("tenant_id", "client_id", "deployment_id");--> statement-breakpoint
ALTER TABLE "lti_deployments" ADD CONSTRAINT "lti_deployments_tenant_client_fk" FOREIGN KEY ("tenant_id", "client_id") REFERENCES "lti_clients"("tenant_id", "id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lti_registration_sessions" ADD COLUMN "tenant_id" varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE "lti_sessions" ADD COLUMN "tenant_id" varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE "lti_registration_sessions" DROP CONSTRAINT "lti_registration_sessions_pkey";--> statement-breakpoint
ALTER TABLE "lti_registration_sessions" ADD CONSTRAINT "lti_registration_sessions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id");--> statement-breakpoint
ALTER TABLE "lti_sessions" DROP CONSTRAINT "lti_sessions_pkey";--> statement-breakpoint
ALTER TABLE "lti_sessions" ADD CONSTRAINT "lti_sessions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id");--> statement-breakpoint
ALTER TABLE "lti_nonces" ADD COLUMN "tenant_id" varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE "lti_nonces" DROP CONSTRAINT "lti_nonces_pkey";--> statement-breakpoint
ALTER TABLE "lti_nonces" ADD CONSTRAINT "lti_nonces_tenant_id_nonce_pk" PRIMARY KEY("tenant_id","nonce");--> statement-breakpoint
DROP INDEX "lti_clients_issuer_client_idx";--> statement-breakpoint
CREATE INDEX "lti_clients_issuer_client_idx" ON "lti_clients" USING btree ("tenant_id","client_id","iss");--> statement-breakpoint
DROP INDEX "lti_clients_iss_client_id_uniq";--> statement-breakpoint
CREATE UNIQUE INDEX "lti_clients_iss_client_id_uniq" ON "lti_clients" USING btree ("tenant_id","iss","client_id");--> statement-breakpoint
DROP INDEX "lti_deployments_deployment_id_idx";--> statement-breakpoint
CREATE INDEX "lti_deployments_deployment_id_idx" ON "lti_deployments" USING btree ("tenant_id","deployment_id");--> statement-breakpoint
ALTER TABLE "lti_clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lti_clients" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "lti_clients_tenant_policy" ON "lti_clients" USING ("tenant_id" = current_setting('app.tenant_id', true)) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));--> statement-breakpoint
ALTER TABLE "lti_deployments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lti_deployments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "lti_deployments_tenant_policy" ON "lti_deployments" USING ("tenant_id" = current_setting('app.tenant_id', true)) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));--> statement-breakpoint
ALTER TABLE "lti_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lti_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "lti_sessions_tenant_policy" ON "lti_sessions" USING ("tenant_id" = current_setting('app.tenant_id', true)) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));--> statement-breakpoint
ALTER TABLE "lti_nonces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lti_nonces" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "lti_nonces_tenant_policy" ON "lti_nonces" USING ("tenant_id" = current_setting('app.tenant_id', true)) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));--> statement-breakpoint
ALTER TABLE "lti_registration_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lti_registration_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "lti_registration_sessions_tenant_policy" ON "lti_registration_sessions" USING ("tenant_id" = current_setting('app.tenant_id', true)) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
