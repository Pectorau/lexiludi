CREATE TABLE `grimoire_canvases` (
	`owner_key` varchar(64) NOT NULL,
	`offset_x` int NOT NULL DEFAULT 0,
	`offset_y` int NOT NULL DEFAULT 0,
	`zoom` int NOT NULL DEFAULT 100,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grimoire_canvases_owner_key` PRIMARY KEY(`owner_key`)
);
--> statement-breakpoint
CREATE TABLE `grimoire_placements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_key` varchar(64) NOT NULL,
	`lexical_entry_id` int NOT NULL,
	`theme_id` int,
	`x` int NOT NULL DEFAULT 0,
	`y` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grimoire_placements_id` PRIMARY KEY(`id`),
	CONSTRAINT `grimoire_placements_owner_entry_unique` UNIQUE(`owner_key`,`lexical_entry_id`)
);
--> statement-breakpoint
CREATE TABLE `grimoire_themes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_key` varchar(64) NOT NULL,
	`title` varchar(80) NOT NULL,
	`accent` varchar(24) NOT NULL DEFAULT 'violet',
	`x` int NOT NULL DEFAULT 0,
	`y` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grimoire_themes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `grimoire_placements_owner_theme_idx` ON `grimoire_placements` (`owner_key`,`theme_id`);--> statement-breakpoint
CREATE INDEX `grimoire_placements_entry_idx` ON `grimoire_placements` (`lexical_entry_id`);--> statement-breakpoint
CREATE INDEX `grimoire_themes_owner_idx` ON `grimoire_themes` (`owner_key`,`updated_at`);
