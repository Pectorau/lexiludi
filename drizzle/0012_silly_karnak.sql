CREATE TABLE `multiplayer_trade_offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`room_id` int NOT NULL,
	`round_id` int NOT NULL,
	`from_player_id` int NOT NULL,
	`to_player_id` int NOT NULL,
	`offered_letter` varchar(1) NOT NULL,
	`requested_letter` varchar(1) NOT NULL,
	`status` enum('pending','accepted','declined','expired','cancelled') NOT NULL DEFAULT 'pending',
	`expires_at` timestamp NOT NULL,
	`responded_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `multiplayer_trade_offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `multiplayer_trade_round_target_idx` ON `multiplayer_trade_offers` (`round_id`,`to_player_id`,`status`);--> statement-breakpoint
CREATE INDEX `multiplayer_trade_round_source_idx` ON `multiplayer_trade_offers` (`round_id`,`from_player_id`,`status`);
