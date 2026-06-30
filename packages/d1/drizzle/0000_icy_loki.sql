CREATE TABLE `lti_tool_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`iss` text NOT NULL,
	`client_id` text NOT NULL,
	`auth_url` text NOT NULL,
	`token_url` text NOT NULL,
	`jwks_url` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lti_tool_clients_issuer_client_idx` ON `lti_tool_clients` (`client_id`,`iss`);--> statement-breakpoint
CREATE UNIQUE INDEX `lti_tool_clients_iss_client_id_unique` ON `lti_tool_clients` (`iss`,`client_id`);--> statement-breakpoint
CREATE TABLE `lti_tool_deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`deployment_id` text NOT NULL,
	`name` text,
	`description` text,
	FOREIGN KEY (`client_id`) REFERENCES `lti_tool_clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lti_tool_deployments_deployment_id_idx` ON `lti_tool_deployments` (`deployment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `lti_tool_deployments_client_deployment_unique` ON `lti_tool_deployments` (`client_id`,`deployment_id`);--> statement-breakpoint
CREATE TABLE `lti_tool_nonces` (
	`nonce` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lti_tool_nonces_expires_at_idx` ON `lti_tool_nonces` (`expires_at`);--> statement-breakpoint
CREATE TABLE `lti_tool_registration_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lti_tool_registration_sessions_expires_at_idx` ON `lti_tool_registration_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `lti_tool_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lti_tool_sessions_expires_at_idx` ON `lti_tool_sessions` (`expires_at`);
