CREATE TABLE `visual_editor_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`page` varchar(32) NOT NULL,
	`draft_config` text NOT NULL,
	`published_config` text NOT NULL,
	`updated_by_open_id` varchar(64) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visual_editor_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `visual_editor_pages_page_unique` UNIQUE(`page`)
);
--> statement-breakpoint
CREATE INDEX `visual_editor_pages_updated_idx` ON `visual_editor_pages` (`updated_at`);
