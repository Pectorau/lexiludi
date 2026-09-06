CREATE TABLE `multiplayer_room_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`room_id` int NOT NULL,
	`round_id` int,
	`player_id` int,
	`event_type` varchar(32) NOT NULL,
	`summary` varchar(240) NOT NULL,
	`effect` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `multiplayer_room_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `multiplayer_players` ADD `is_ready` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `multiplayer_room_events_room_created_idx` ON `multiplayer_room_events` (`room_id`,`created_at`);
