CREATE TABLE `clients` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`iss` varchar(255) NOT NULL,
	`clientId` varchar(255) NOT NULL,
	`authUrl` text NOT NULL,
	`tokenUrl` text NOT NULL,
	`jwksUrl` text NOT NULL,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `iss_client_id_unique` UNIQUE(`iss`,`clientId`)
);
--> statement-breakpoint
CREATE TABLE `deployments` (
	`id` varchar(36) NOT NULL,
	`deploymentId` varchar(255) NOT NULL,
	`name` varchar(255),
	`description` text,
	`clientId` varchar(36) NOT NULL,
	CONSTRAINT `deployments_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_deployment_unique` UNIQUE(`clientId`,`deploymentId`)
);
--> statement-breakpoint
CREATE TABLE `nonces` (
	`nonce` varchar(255) NOT NULL,
	`expiresAt` bigint NOT NULL,
	CONSTRAINT `nonces_nonce` PRIMARY KEY(`nonce`)
);
--> statement-breakpoint
CREATE TABLE `registrationSessions` (
	`id` varchar(36) NOT NULL,
	`data` json NOT NULL,
	`expiresAt` bigint NOT NULL,
	CONSTRAINT `registrationSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`data` json NOT NULL,
	`expiresAt` bigint NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `deployments` ADD CONSTRAINT `deployments_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `issuer_client_idx` ON `clients` (`clientId`,`iss`);--> statement-breakpoint
CREATE INDEX `deployment_id_idx` ON `deployments` (`deploymentId`);--> statement-breakpoint
CREATE INDEX `expires_at_idx` ON `registrationSessions` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `expires_at_idx` ON `sessions` (`expiresAt`);
