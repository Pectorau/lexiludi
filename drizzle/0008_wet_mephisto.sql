CREATE TABLE `multiplayer_player_rewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`room_id` int NOT NULL,
	`player_id` int NOT NULL,
	`joker` enum('bonus_attempt','random_letter','peek') NOT NULL,
	`consumed_round_id` int,
	`granted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `multiplayer_player_rewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `multiplayer_joker_uses` MODIFY COLUMN `joker` enum('compass','tempo','second_chance','fog','shield','bonus_attempt','random_letter','peek') NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_rooms` ADD `title` varchar(60) DEFAULT 'Salon de mots' NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_rooms` ADD `visibility` enum('private','public') DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_rooms` ADD `is_hardcore` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `multiplayer_rewards_room_player_idx` ON `multiplayer_player_rewards` (`room_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `multiplayer_rewards_available_idx` ON `multiplayer_player_rewards` (`player_id`,`consumed_round_id`);
