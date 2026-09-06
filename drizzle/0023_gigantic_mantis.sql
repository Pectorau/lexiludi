ALTER TABLE `multiplayer_rooms` ADD `player_count` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `multiplayer_rooms` ADD `player_count` int NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE `multiplayer_rooms` AS room SET `player_count` = (SELECT COUNT(*) FROM `multiplayer_players` AS player WHERE player.`room_id` = room.`id`);--> statement-breakpoint
ALTER TABLE `multiplayer_players` ADD CONSTRAINT `multiplayer_players_room_nickname_unique` UNIQUE(`room_id`,`nickname`);--> statement-breakpoint
CREATE INDEX `multiplayer_rooms_lobby_capacity_idx` ON `multiplayer_rooms` (`status`,`player_count`);
