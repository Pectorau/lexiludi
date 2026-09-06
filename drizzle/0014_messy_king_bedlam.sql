CREATE TABLE `multiplayer_tactical_bids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contract_id` int NOT NULL,
	`player_id` int NOT NULL,
	`mana_amount` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `multiplayer_tactical_bids_id` PRIMARY KEY(`id`),
	CONSTRAINT `multiplayer_tactical_bid_unique_idx` UNIQUE(`contract_id`,`player_id`)
);
--> statement-breakpoint
CREATE TABLE `multiplayer_tactical_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`room_id` int NOT NULL,
	`round_id` int NOT NULL,
	`from_player_id` int NOT NULL,
	`target_player_id` int,
	`contract_type` enum('letter','cryptohint','mana') NOT NULL,
	`offered_letter` varchar(1),
	`hint` text,
	`minimum_bid` int NOT NULL DEFAULT 0,
	`status` enum('open','awarded','expired','cancelled') NOT NULL DEFAULT 'open',
	`expires_at` timestamp NOT NULL,
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `multiplayer_tactical_contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `multiplayer_tactical_bid_contract_amount_idx` ON `multiplayer_tactical_bids` (`contract_id`,`mana_amount`);--> statement-breakpoint
CREATE INDEX `multiplayer_contract_round_status_idx` ON `multiplayer_tactical_contracts` (`round_id`,`status`);--> statement-breakpoint
CREATE INDEX `multiplayer_contract_source_idx` ON `multiplayer_tactical_contracts` (`from_player_id`,`created_at`);
