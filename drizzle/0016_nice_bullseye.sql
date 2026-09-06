CREATE TABLE `daily_challenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`daily_date` varchar(10) NOT NULL,
	`mode` enum('mystery','pyramid','auction') NOT NULL,
	`public_data` text NOT NULL,
	`secret_data` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_challenges_date_mode_unique` UNIQUE(`daily_date`,`mode`)
);
--> statement-breakpoint
CREATE TABLE `daily_runs` (
	`id` varchar(64) NOT NULL,
	`challenge_id` int NOT NULL,
	`owner_key` varchar(64) NOT NULL,
	`daily_date` varchar(10) NOT NULL,
	`mode` enum('mystery','pyramid','auction') NOT NULL,
	`run_nonce` varchar(64) NOT NULL,
	`status` enum('active','won','lost','abandoned') NOT NULL DEFAULT 'active',
	`state_data` text NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`score` int NOT NULL DEFAULT 0,
	`version` int NOT NULL DEFAULT 1,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_runs_owner_date_mode_nonce_unique` UNIQUE(`owner_key`,`daily_date`,`mode`,`run_nonce`)
);
--> statement-breakpoint
CREATE TABLE `game_identities` (
	`id` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_identities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `solo_game_sessions` (
	`id` varchar(64) NOT NULL,
	`owner_key` varchar(64) NOT NULL,
	`mode` enum('quiz','motus','definition','relation') NOT NULL,
	`status` enum('active','resolved','abandoned','expired') NOT NULL DEFAULT 'active',
	`public_data` text NOT NULL,
	`secret_data` text NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`max_attempts` int NOT NULL DEFAULT 1,
	`score` int NOT NULL DEFAULT 0,
	`expires_at` timestamp NOT NULL,
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `solo_game_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `daily_runs_owner_date_idx` ON `daily_runs` (`owner_key`,`daily_date`);--> statement-breakpoint
CREATE INDEX `daily_runs_challenge_idx` ON `daily_runs` (`challenge_id`);--> statement-breakpoint
CREATE INDEX `solo_game_sessions_owner_status_idx` ON `solo_game_sessions` (`owner_key`,`status`);--> statement-breakpoint
CREATE INDEX `solo_game_sessions_expiry_idx` ON `solo_game_sessions` (`expires_at`);
