CREATE TABLE `multiplayer_players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`room_id` int NOT NULL,
	`nickname` varchar(30) NOT NULL,
	`resume_token` varchar(80) NOT NULL,
	`is_host` int NOT NULL DEFAULT 0,
	`score` int NOT NULL DEFAULT 0,
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `multiplayer_players_id` PRIMARY KEY(`id`),
	CONSTRAINT `multiplayer_players_resume_token_unique` UNIQUE(`resume_token`)
);
--> statement-breakpoint
CREATE TABLE `multiplayer_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(8) NOT NULL,
	`game_mode` enum('quiz','motus') NOT NULL,
	`variant` varchar(32) NOT NULL,
	`status` enum('lobby','active','finished') NOT NULL DEFAULT 'lobby',
	`host_player_id` int,
	`current_round_index` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `multiplayer_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `multiplayer_rooms_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `multiplayer_rounds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`room_id` int NOT NULL,
	`position` int NOT NULL,
	`status` enum('active','resolved') NOT NULL DEFAULT 'active',
	`prompt` text NOT NULL,
	`public_data` text NOT NULL,
	`answer_key` text NOT NULL,
	`source_cnrtl_url` varchar(512),
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`resolved_at` timestamp,
	CONSTRAINT `multiplayer_rounds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `multiplayer_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`round_id` int NOT NULL,
	`player_id` int NOT NULL,
	`submission_type` enum('quiz','motus') NOT NULL,
	`payload` text NOT NULL,
	`feedback` text,
	`is_correct` int NOT NULL DEFAULT 0,
	`points` int NOT NULL DEFAULT 0,
	`attempt_index` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `multiplayer_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `multiplayer_players_room_idx` ON `multiplayer_players` (`room_id`);--> statement-breakpoint
CREATE INDEX `multiplayer_rooms_status_idx` ON `multiplayer_rooms` (`status`);--> statement-breakpoint
CREATE INDEX `multiplayer_rounds_room_position_idx` ON `multiplayer_rounds` (`room_id`,`position`);--> statement-breakpoint
CREATE INDEX `multiplayer_submissions_round_player_idx` ON `multiplayer_submissions` (`round_id`,`player_id`);
