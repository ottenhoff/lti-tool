CREATE TABLE `lti_clients` (
	`id` varchar(36) NOT NULL,
	`platform_name` varchar(255) NOT NULL,
	`iss` varchar(255) NOT NULL,
	`client_id` varchar(255) NOT NULL,
	`auth_url` text NOT NULL,
	`token_url` text NOT NULL,
	`jwks_url` text NOT NULL,
	CONSTRAINT `lti_clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `lti_clients_iss_client_id_uniq` UNIQUE(`iss`,`client_id`)
);
--> statement-breakpoint
CREATE TABLE `lti_deployments` (
	`id` varchar(36) NOT NULL,
	`deployment_id` varchar(255) NOT NULL,
	`deployment_name` varchar(255),
	`deployment_description` text,
	`client_id` varchar(36) NOT NULL,
	CONSTRAINT `lti_deployments_id` PRIMARY KEY(`id`),
	CONSTRAINT `lti_deployments_client_deployment_uniq` UNIQUE(`client_id`,`deployment_id`)
);
--> statement-breakpoint
CREATE TABLE `lti_nonces` (
	`nonce` varchar(255) NOT NULL,
	`expires_at` bigint NOT NULL,
	CONSTRAINT `lti_nonces_nonce` PRIMARY KEY(`nonce`)
);
--> statement-breakpoint
CREATE TABLE `lti_registration_sessions` (
	`id` varchar(36) NOT NULL,
	`payload` json NOT NULL,
	`expires_at` bigint NOT NULL,
	CONSTRAINT `lti_registration_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lti_sessions` (
	`id` varchar(36) NOT NULL,
	`payload` json NOT NULL,
	`expires_at` bigint NOT NULL,
	CONSTRAINT `lti_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lti_deployments` ADD CONSTRAINT `lti_deployments_client_id_lti_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `lti_clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `lti_clients_issuer_client_idx` ON `lti_clients` (`client_id`,`iss`);--> statement-breakpoint
CREATE INDEX `lti_deployments_deployment_id_idx` ON `lti_deployments` (`deployment_id`);--> statement-breakpoint
CREATE INDEX `lti_registration_sessions_expires_at_idx` ON `lti_registration_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `lti_sessions_expires_at_idx` ON `lti_sessions` (`expires_at`);