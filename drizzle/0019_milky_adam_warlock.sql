CREATE TABLE `admin_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(64) NOT NULL,
	`target_type` varchar(64) NOT NULL,
	`target_id` varchar(128) NOT NULL,
	`admin_open_id` varchar(64) NOT NULL,
	`summary` varchar(240) NOT NULL,
	`metadata` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_system_configurations` (
	`key` varchar(64) NOT NULL,
	`value` text NOT NULL,
	`updated_by_open_id` varchar(64) NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_system_configurations_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `lexicon_curations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lexical_entry_id` int NOT NULL,
	`difficulty` enum('facile','moyen','difficile','diabolique') NOT NULL DEFAULT 'moyen',
	`frequency_weight` int NOT NULL DEFAULT 100,
	`tags` text,
	`is_active` int NOT NULL DEFAULT 1,
	`editorial_note` text,
	`updated_by_open_id` varchar(64) NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lexicon_curations_id` PRIMARY KEY(`id`),
	CONSTRAINT `lexicon_curations_lexical_entry_id_unique` UNIQUE(`lexical_entry_id`)
);
--> statement-breakpoint
CREATE INDEX `admin_audit_logs_created_idx` ON `admin_audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `admin_audit_logs_target_idx` ON `admin_audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `lexicon_curations_active_idx` ON `lexicon_curations` (`is_active`,`difficulty`);
