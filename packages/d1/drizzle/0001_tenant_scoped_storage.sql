ALTER TABLE `lti_clients` ADD `tenant_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `lti_deployments` ADD `tenant_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `lti_registration_sessions` ADD `tenant_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `lti_sessions` ADD `tenant_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `lti_nonces` ADD `tenant_id` text NOT NULL;--> statement-breakpoint
DROP TABLE `lti_deployments`;--> statement-breakpoint
DROP TABLE `lti_clients`;--> statement-breakpoint
CREATE TABLE `lti_clients` (
	`id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`platform_name` text NOT NULL,
	`iss` text NOT NULL,
	`client_id` text NOT NULL,
	`auth_url` text NOT NULL,
	`token_url` text NOT NULL,
	`jwks_url` text NOT NULL,
	PRIMARY KEY (`tenant_id`, `id`)
);--> statement-breakpoint
CREATE INDEX `lti_clients_issuer_client_idx` ON `lti_clients` (`tenant_id`,`client_id`,`iss`);--> statement-breakpoint
CREATE UNIQUE INDEX `lti_clients_iss_client_id_uniq` ON `lti_clients` (`tenant_id`,`iss`,`client_id`);--> statement-breakpoint
CREATE TABLE `lti_deployments` (
	`id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text NOT NULL,
	`deployment_id` text NOT NULL,
	`deployment_name` text,
	`deployment_description` text,
	PRIMARY KEY (`tenant_id`, `id`),
	FOREIGN KEY (`tenant_id`, `client_id`) REFERENCES `lti_clients`(`tenant_id`, `id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `lti_deployments_deployment_id_idx` ON `lti_deployments` (`tenant_id`,`deployment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `lti_deployments_client_deployment_uniq` ON `lti_deployments` (`tenant_id`,`client_id`,`deployment_id`);--> statement-breakpoint
CREATE TABLE `lti_registration_sessions__tenant_scoped` (
	`id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY (`tenant_id`, `id`)
);--> statement-breakpoint
INSERT INTO `lti_registration_sessions__tenant_scoped` (`id`, `tenant_id`, `payload`, `expires_at`)
SELECT `id`, `tenant_id`, `payload`, `expires_at` FROM `lti_registration_sessions`;--> statement-breakpoint
DROP TABLE `lti_registration_sessions`;--> statement-breakpoint
ALTER TABLE `lti_registration_sessions__tenant_scoped` RENAME TO `lti_registration_sessions`;--> statement-breakpoint
CREATE INDEX `lti_registration_sessions_expires_at_idx` ON `lti_registration_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `lti_sessions__tenant_scoped` (
	`id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY (`tenant_id`, `id`)
);--> statement-breakpoint
INSERT INTO `lti_sessions__tenant_scoped` (`id`, `tenant_id`, `payload`, `expires_at`)
SELECT `id`, `tenant_id`, `payload`, `expires_at` FROM `lti_sessions`;--> statement-breakpoint
DROP TABLE `lti_sessions`;--> statement-breakpoint
ALTER TABLE `lti_sessions__tenant_scoped` RENAME TO `lti_sessions`;--> statement-breakpoint
CREATE INDEX `lti_sessions_expires_at_idx` ON `lti_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `lti_nonces__tenant_scoped` (
	`nonce` text NOT NULL,
	`tenant_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY (`tenant_id`, `nonce`)
);--> statement-breakpoint
INSERT INTO `lti_nonces__tenant_scoped` (`nonce`, `tenant_id`, `expires_at`)
SELECT `nonce`, `tenant_id`, `expires_at` FROM `lti_nonces`;--> statement-breakpoint
DROP TABLE `lti_nonces`;--> statement-breakpoint
ALTER TABLE `lti_nonces__tenant_scoped` RENAME TO `lti_nonces`;--> statement-breakpoint
CREATE INDEX `lti_nonces_expires_at_idx` ON `lti_nonces` (`expires_at`);
