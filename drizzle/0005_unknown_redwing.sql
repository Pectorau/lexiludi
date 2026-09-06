CREATE TABLE `multiplayer_joker_uses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`round_id` int NOT NULL,
	`player_id` int NOT NULL,
	`joker` enum('compass','tempo','second_chance') NOT NULL,
	`effect` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `multiplayer_joker_uses_id` PRIMARY KEY(`id`),
	CONSTRAINT `multiplayer_joker_round_player_kind_idx` UNIQUE(`round_id`,`player_id`,`joker`)
);
--> statement-breakpoint
ALTER TABLE `multiplayer_rooms` ADD `round_limit` int DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_rooms` ADD `round_duration_seconds` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_rooms` ADD `show_submissions` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_rounds` ADD `ends_at` timestamp;--> statement-breakpoint
CREATE INDEX `multiplayer_joker_round_idx` ON `multiplayer_joker_uses` (`round_id`);
